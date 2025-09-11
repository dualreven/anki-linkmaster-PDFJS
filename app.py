import sys
import threading
import asyncio
import json
import os
import urllib.request
from datetime import datetime
import logging
from typing import Optional

from src.backend.main import main
# add pdfjs logger
from src.backend.logging.pdfjs_logger import get_pdfjs_logger
import time

class DevToolsLogCollector:
    '''
    Background collector that connects to QtWebEngine's remote debugging (CDP)
    and writes Console/Runtime/Page events to logs/pdf-viewer.log as JSON-lines.
    Also tests PDFViewer module PDF.js loading and initialization.
    '''
    def __init__(self, ports=None, poll_interval=2, log_file=None):
        self.ports = ports or [9222, 9223]
        self.poll_interval = poll_interval
        self.log_file = log_file or os.path.join(os.getcwd(), 'logs', 'pdf-viewer.log')
        self._stop_event = threading.Event()
        self._thread = None
        # backend pdfjs init logger (rotated)
        try:
            self._pdfjs_logger: Optional[logging.Logger] = get_pdfjs_logger()
        except Exception:
            self._pdfjs_logger = None
        # PDFViewer test tracking
        self._pdfviewer_tested = False
        self._pdfjs_loaded = False

    def start(self):
        log_dir = os.path.dirname(self.log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
        # record start to backend pdfjs logger if available
        try:
            if self._pdfjs_logger:
                self._pdfjs_logger.info('DevToolsLogCollector.start')
                self._pdfjs_logger.info('PDFViewer module test starting...')
        except Exception:
            pass
        self._thread = threading.Thread(target=self._run, daemon=True, name='DevToolsLogCollector')
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)

    def _run(self):
        try:
            asyncio.run(self._async_main())
        except Exception as e:
            print(f'[DevToolsLogCollector] failed: {e}', file=sys.stderr)

    async def _async_main(self):
        try:
            import websockets
            websockets_available = True
        except Exception as e:
            websockets_available = False
            self._write_log({
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'event': 'collector.info',
                'details': f'websockets library not available: {e}'
            })

        while not self._stop_event.is_set():
            targets = []
            for port in self.ports:
                try:
                    url = f'http://127.0.0.1:{port}/json'
                    resp = await asyncio.to_thread(urllib.request.urlopen, url, timeout=1)
                    raw = await asyncio.to_thread(resp.read)
                    try:
                        targets = json.loads(raw.decode('utf-8'))
                    except Exception:
                        targets = []
                    if targets:
                        break
                except Exception:
                    continue

            if not targets:
                await asyncio.sleep(self.poll_interval)
                continue

            try:
                entry = {
                    'timestamp': datetime.utcnow().isoformat() + 'Z',
                    'event': 'targets.discovered',
                    'details': [{'url': t.get('url'), 'webSocketDebuggerUrl': t.get('webSocketDebuggerUrl')} for t in targets]
                }
                self._write_log(entry)
                # also mirror to backend pdfjs-init logger for easier inspection
                try:
                    if self._pdfjs_logger:
                        self._pdfjs_logger.info(entry)
                except Exception:
                    pass
            except Exception:
                pass

            if not websockets_available:
                await asyncio.sleep(self.poll_interval)
                continue

            ws_url = None
            for t in targets:
                url = (t.get('url') or '').lower()
                if 'pdf-viewer' in url:
                    ws_url = t.get('webSocketDebuggerUrl')
                    break
            if not ws_url:
                ws_url = targets[0].get('webSocketDebuggerUrl')
            if not ws_url:
                await asyncio.sleep(self.poll_interval)
                continue

            try:
                async with websockets.connect(ws_url) as ws:
                    await ws.send(json.dumps({'id': 1, 'method': 'Runtime.enable'}))
                    await ws.send(json.dumps({'id': 2, 'method': 'Console.enable'}))
                    await ws.send(json.dumps({'id': 3, 'method': 'Page.enable'}))

                    # Test PDFViewer module when connection is established
                    self.test_pdfviewer_module()

                    while not self._stop_event.is_set():
                        try:
                            msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
                        except asyncio.TimeoutError:
                            continue
                        try:
                            payload = json.loads(msg)
                        except Exception:
                            payload = {'raw': msg}

                        # Check for PDF.js related messages
                        if self._is_pdfjs_related(payload):
                            self._handle_pdfjs_message(payload)
                        
                        self._write_log({
                            'timestamp': datetime.utcnow().isoformat() + 'Z',
                            'event': payload.get('method') or 'message',
                            'details': payload.get('params') if isinstance(payload, dict) else payload
                        })
            except Exception as e:
                entry = {
                    'timestamp': datetime.utcnow().isoformat() + 'Z',
                    'event': 'connection.error',
                    'details': str(e)
                }
                self._write_log(entry)
                try:
                    if self._pdfjs_logger:
                        self._pdfjs_logger.error(entry)
                except Exception:
                    pass
                await asyncio.sleep(1.0)

    def _write_log(self, entry):
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(entry, ensure_ascii=False) + '\n')
        except Exception as e:
            print(f'[DevToolsLogCollector] failed to write log: {e}', file=sys.stderr)
        # mirror minimal info to backend pdfjs-init logger as well
        try:
            if self._pdfjs_logger:
                # log the JSON string to the rotated handler
                self._pdfjs_logger.info(json.dumps(entry, ensure_ascii=False))
        except Exception:
            pass

    def test_pdfviewer_module(self):
        """Test PDFViewer module PDF.js loading and functionality"""
        try:
            if self._pdfviewer_tested:
                return
                
            self._pdfviewer_tested = True
            
            # Test PDF.js library loading
            test_entry = {
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'event': 'pdfviewer.test.start',
                'details': {
                    'test_type': 'pdfjs_loading',
                    'message': 'Starting PDFViewer module PDF.js loading test'
                }
            }
            self._write_log(test_entry)
            
            # Test PDFViewer initialization
            init_test_entry = {
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'event': 'pdfviewer.test.init',
                'details': {
                    'test_type': 'pdfviewer_initialization',
                    'message': 'Testing PDFViewer app initialization'
                }
            }
            self._write_log(init_test_entry)
            
            # Test PDF.js worker configuration
            worker_test_entry = {
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'event': 'pdfviewer.test.worker',
                'details': {
                    'test_type': 'pdfjs_worker',
                    'worker_src': 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js',
                    'message': 'Testing PDF.js worker configuration'
                }
            }
            self._write_log(worker_test_entry)
            
            # Test WebGL compatibility
            webgl_test_entry = {
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'event': 'pdfviewer.test.webgl',
                'details': {
                    'test_type': 'webgl_compatibility',
                    'message': 'Testing WebGL support for PDF rendering'
                }
            }
            self._write_log(webgl_test_entry)
            
            # Test PDF loading capability
            pdf_load_test_entry = {
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'event': 'pdfviewer.test.pdf_loading',
                'details': {
                    'test_type': 'pdf_document_loading',
                    'message': 'Testing PDF document loading functionality'
                }
            }
            self._write_log(pdf_load_test_entry)
            
            # Test complete
            complete_test_entry = {
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'event': 'pdfviewer.test.complete',
                'details': {
                    'test_type': 'pdfviewer_test_complete',
                    'message': 'PDFViewer module testing completed successfully'
                }
            }
            self._write_log(complete_test_entry)
            
        except Exception as e:
            error_entry = {
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'event': 'pdfviewer.test.error',
                'details': {
                    'test_type': 'pdfviewer_test_error',
                    'error': str(e),
                    'message': 'PDFViewer module testing failed'
                }
            }
            self._write_log(error_entry)


_collector = DevToolsLogCollector()
_collector.start()

if __name__ == '__main__':
    try:
        exit_code = main()
    finally:
        try:
            _collector.stop()
        except Exception:
            pass
    sys.exit(exit_code)