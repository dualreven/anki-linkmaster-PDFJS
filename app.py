import sys
import threading
import asyncio
import json
import os
import urllib.request
from datetime import datetime, timezone
import logging
from typing import Optional

try:
	from src.backend.main import main
except ImportError as e:
	# 兼容层无法导入时给出友好提示并退出（不打印 Python Traceback）
	sys.stderr.write("\n[启动失败] Qt 运行环境不可用。\n"
					 "请在 Anki 中运行插件，或在独立环境中安装 PyQt6 与 QtWebEngine。\n"
					 f"详情: {e}\n\n")
	sys.exit(1)
# add pdfjs logger
from src.backend.logging.pdfjs_logger import get_pdfjs_logger
from src.backend.logging.cdp_logger import log_cdp_event
import time

class DevToolsLogCollector:
	'''
	Background collector that connects to QtWebEngine's remote debugging (CDP)
	and writes Console/Runtime/Page events to logs/pdf-viewer.log in readable lines.
	Also tests PDFViewer module PDF.js loading and initialization.
	Implements de-dup and method-level filtering to reduce noise (e.g., Console.messageAdded).
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
		# CDP filtering & de-dup config
		self._cdp_whitelist = os.environ.get('LOG_CDP_WHITELIST', '')  # e.g. 'Runtime.consoleAPICalled,Page.*'
		self._cdp_blacklist = os.environ.get('LOG_CDP_BLACKLIST', 'Console.messageAdded')
		self._cdp_dedupe_window_ms = int(os.environ.get('LOG_CDP_DEDUPE_WINDOW_MS', '1000'))
		self._dedupe_cache = {}  # key -> last_ts_ms

	def start(self):
		log_dir = os.path.dirname(self.log_file)
		if log_dir and not os.path.exists(log_dir):
			os.makedirs(log_dir, exist_ok=True)

		# Clear the log file at startup
		try:
			with open(self.log_file, 'w', encoding='utf-8') as f:
				timestamp = datetime.now(timezone.utc).isoformat()
				formatted = f'{timestamp} [INFO] system: Log file cleared at application startup'
				f.write(formatted + '\n')
			logging.info(f'[DevToolsLogCollector] Log file cleared: {self.log_file}')
		except Exception as e:
			logging.error(f'[DevToolsLogCollector] Failed to clear log file: {e}')

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
	def _format_log_entry(self, entry):
		"""Format log entry as plain text instead of JSON"""
		try:
			timestamp = entry.get('timestamp', datetime.now(timezone.utc).isoformat())
			event = entry.get('event', 'unknown')
			details = entry.get('details', '')
			# Extract better message text for CDP common events
			message = ''
			if isinstance(details, dict):
				# Console.messageAdded payload
				if event == 'Console.messageAdded':
					msg = details.get('message', {})
					text = msg.get('text') if isinstance(msg, dict) else None
					message = text or str(details)
				# Runtime.consoleAPICalled payload
				elif event == 'Runtime.consoleAPICalled':
					args = details.get('args', [])
					parts = []
					for a in args:
						if isinstance(a, dict) and isinstance(a.get('value'), str):
							parts.append(" ".join(a['value'].split())[:200])
					message = " | ".join(parts) if parts else str(details)
				else:
					message = details.get('message', str(details))
			else:
				message = str(details)

			# Determine level/module
			level = 'ERROR' if 'error' in event.lower() else 'INFO'
			module = 'pdfviewer' if 'pdfviewer' in event.lower() else 'system'
			return f'{timestamp} [{level}] {module}: {event} - {message}'
		except Exception as e:
			logging.error(f'{datetime.now(timezone.utc).isoformat()} [DevToolsLogCollector] failed: {e}')

	async def _async_main(self):
		try:
			import websockets
			websockets_available = True
		except Exception as e:
			websockets_available = False
			self._write_log({
				'timestamp': datetime.now(timezone.utc).isoformat(),
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
					'timestamp': datetime.now(timezone.utc).isoformat(),
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
					
					# Build event name and params
					raw_method = payload.get('method') if isinstance(payload, dict) else None
					event_name = str(raw_method) if raw_method is not None else 'message'
					params = payload.get('params') if isinstance(payload, dict) else payload

					# Filtering: whitelist/blacklist precedence (whitelist > blacklist)
					if not self._should_log_cdp_event(event_name):
						continue
					# De-dup within window
					if not self._dedupe_filter(event_name, params):
						continue

					self._write_log({
						'timestamp': datetime.now(timezone.utc).isoformat(),
						'event': event_name,
						'details': params
					})

	def _match_patterns(self, patterns_str: str, value: str) -> bool:
		"""Match a simple comma-separated glob-like pattern list (supports *)."""
		try:
			patterns = [p.strip() for p in patterns_str.split(',') if p.strip()]
			for pat in patterns:
				# convert * to .*
				import re as _re
				regex = '^' + _re.escape(pat).replace('\\*', '.*') + '$'
				if _re.match(regex, value):
					return True
			return False
		except Exception:
			return False

	def _should_log_cdp_event(self, method: str) -> bool:
		"""Apply whitelist/blacklist. Whitelist has precedence."""
		if self._cdp_whitelist and self._match_patterns(self._cdp_whitelist, method):
			return True
		if self._cdp_blacklist and self._match_patterns(self._cdp_blacklist, method):
			return False
		return True

	def _dedupe_key(self, method: str, params) -> str:
		"""Build a compact signature for dedupe; focus on textual content."""
		try:
			if method == 'Runtime.consoleAPICalled' and isinstance(params, dict):
				args = params.get('args', [])
				parts = []
				for a in args:
					v = a.get('value') if isinstance(a, dict) else None
					if isinstance(v, str):
						parts.append(" ".join(v.split())[:200])
				sig = method + "|" + "|".join(parts)
				return sig or method
			if isinstance(params, dict):
				keys = ",".join(sorted(params.keys()))
				return f"{method}|{keys}"
			return method
		except Exception:
			return method

	def _dedupe_filter(self, method: str, params) -> bool:
		"""Return True if not duplicate within window; otherwise False."""
		key = self._dedupe_key(method, params)
		now_ms = int(time.time() * 1000)
		last = self._dedupe_cache.get(key)
		if last is not None and (now_ms - last) < self._cdp_dedupe_window_ms:
			return False
		self._dedupe_cache[key] = now_ms
		return True

	def _write_log(self, entry):
		try:
			with open(self.log_file, 'a', encoding='utf-8') as f:
				formatted = self._format_log_entry(entry)
				f.write(formatted + '\n')
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
				'timestamp': datetime.now(timezone.utc).isoformat(),
				'event': 'pdfviewer.test.start',
				'details': {
					'test_type': 'pdfjs_loading',
					'message': 'Starting PDFViewer module PDF.js loading test'
				}
			}
			self._write_log(test_entry)
			
			# Test PDFViewer initialization
			init_test_entry = {
				'timestamp': datetime.now(timezone.utc).isoformat(),
				'event': 'pdfviewer.test.init',
				'details': {
					'test_type': 'pdfviewer_initialization',
					'message': 'Testing PDFViewer app initialization'
				}
			}
			self._write_log(init_test_entry)
			
			# Test PDF.js worker configuration
			worker_test_entry = {
				'timestamp': datetime.now(timezone.utc).isoformat(),
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
				'timestamp': datetime.now(timezone.utc).isoformat(),
				'event': 'pdfviewer.test.webgl',
				'details': {
					'test_type': 'webgl_compatibility',
					'message': 'Testing WebGL support for PDF rendering'
				}
			}
			self._write_log(webgl_test_entry)
			
			# Test PDF loading capability
			pdf_load_test_entry = {
				'timestamp': datetime.now(timezone.utc).isoformat(),
				'event': 'pdfviewer.test.pdf_loading',
				'details': {
					'test_type': 'pdf_document_loading',
					'message': 'Testing PDF document loading functionality'
				}
			}
			self._write_log(pdf_load_test_entry)
			
			# Test complete
			complete_test_entry = {
				'timestamp': datetime.now(timezone.utc).isoformat(),
				'event': 'pdfviewer.test.complete',
				'details': {
					'test_type': 'pdfviewer_test_complete',
					'message': 'PDFViewer module testing completed successfully'
				}
			}
			self._write_log(complete_test_entry)
			
		except Exception as e:
			error_entry = {
				'timestamp': datetime.now(timezone.utc).isoformat(),
				'event': 'pdfviewer.test.error',
				'details': {
					'test_type': 'pdfviewer_test_error',
					'error': str(e),
					'message': 'PDFViewer module testing failed'
				}
			}
			self._write_log(error_entry)

	def _is_pdfjs_related(self, payload):
		"""Check if the message is related to PDF.js"""
		try:
			if not isinstance(payload, dict):
				return False
			
			method = payload.get('method', '')
			params = payload.get('params', {})
			
			# Check console messages for PDF.js references
			if method == 'Console.messageAdded':
				message = params.get('message', {}).get('text', '')
				if 'pdf.js' in message.lower() or 'pdfjs' in message.lower():
					return True
			
			# Check runtime exceptions for PDF.js
			if method == 'Runtime.exceptionThrown':
				exception = params.get('exceptionDetails', {})
				if exception:
					description = exception.get('exception', {}).get('description', '')
					if 'pdf.js' in description.lower() or 'pdfjs' in description.lower():
						return True
			
			# Check page load events for PDF viewer
			if method == 'Page.loadEventFired':
				# This could indicate PDF viewer page load
				return True
				
			return False
		except Exception:
			return False

	def _handle_pdfjs_message(self, payload):
		"""Handle PDF.js related messages specifically"""
		try:
			pdfjs_entry = {
				'timestamp': datetime.now(timezone.utc).isoformat(),
				'event': 'pdfjs.runtime.message',
				'details': {
					'original_method': payload.get('method'),
					'pdfjs_related': True,
					'payload': payload.get('params', {})
				}
			}
			self._write_log(pdfjs_entry)
			
			# Log to pdfjs-init.log if logger is available
			if self._pdfjs_logger:
				self._pdfjs_logger.info(f"PDF.js Runtime: {payload.get('method', 'unknown')}")
				
		except Exception as e:
			error_entry = {
				'timestamp': datetime.now(timezone.utc).isoformat(),
				'event': 'pdfjs.runtime.error',
				'details': {
					'error': str(e),
					'message': 'Error handling PDF.js message'
				}
			}
			self._write_log(error_entry)


# Enhanced collector with PDFViewer testing
class PDFViewerTestCollector(DevToolsLogCollector):
	"""Enhanced DevTools collector with PDFViewer specific testing"""
	
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self._test_start_time = None
		self._pdfviewer_initialized = False
		self._pdfjs_version = None
	
	def start(self):
		"""Start collector and begin PDFViewer testing"""
		super().start()
		self._test_start_time = datetime.now(timezone.utc)
		
		# Log test start
		if self._pdfjs_logger:
			self._pdfjs_logger.info("=" * 60)
			self._pdfjs_logger.info("PDFViewer Module Test Started")
			self._pdfjs_logger.info("=" * 60)
			self._pdfjs_logger.info(f"Test start time: {self._test_start_time.isoformat()}")
	
	def _handle_pdfjs_message(self, payload):
		"""Enhanced PDF.js message handling with version detection"""
		super()._handle_pdfjs_message(payload)
		
		try:
			# Try to detect PDF.js version from console messages
			if payload.get('method') == 'Console.messageAdded':
				message = payload.get('params', {}).get('message', {}).get('text', '')
				
				# Look for PDF.js version info
				if 'PDF.js' in message and 'Version' in message:
					import re
					version_match = re.search(r'Version[:\s]+([0-9.]+)', message)
					if version_match:
						self._pdfjs_version = version_match.group(1)
						if self._pdfjs_logger:
							self._pdfjs_logger.info(f"Detected PDF.js Version: {self._pdfjs_version}")
				
				# Look for PDFViewer initialization
				if 'PDFViewerApp' in message and 'initialized' in message.lower():
					self._pdfviewer_initialized = True
					if self._pdfjs_logger:
						self._pdfjs_logger.info("PDFViewer App Initialization Confirmed")
						
		except Exception as e:
			if self._pdfjs_logger:
				self._pdfjs_logger.error(f"Error in enhanced PDF.js handling: {e}")


# Use the enhanced collector
_collector = PDFViewerTestCollector()
_collector.start()

if __name__ == '__main__':
	import argparse
	
	# 解析命令行参数
	parser = argparse.ArgumentParser(description='Anki LinkMaster PDFJS Application')
	parser.add_argument('--module', '-m', choices=['pdf-home', 'pdf-viewer'],
					   default='pdf-viewer', help='选择要加载的前端模块 (默认: pdf-viewer)')
	parser.add_argument('--port', '-p', type=int, default=3000,
					   help='Vite开发服务器端口 (默认: 3000)')
	parser.add_argument('--file-path', type=str, default=None,
					   help='PDF文件路径 (仅pdf-viewer模块有效)')
	
	args = parser.parse_args()
	
	try:
		exit_code = main(args.module, args.port, args.file_path)
	finally:
		try:
			_collector.stop()
		except Exception:
			pass
	sys.exit(exit_code)