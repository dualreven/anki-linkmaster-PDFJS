#!/usr/bin/env python3
"""
JavaScript Console Logger for PDF-Viewer

Monitors the Chrome DevTools Protocol remote debugging port to capture
JavaScript console output and logs it to logs/pdf-viewer-js.log using Python's
logging module.

This replaces the cross-layer QWebChannel log transmission approach for pdf-viewer.
"""

from __future__ import annotations

import json
import logging
import threading
import time
import websocket
import requests
from datetime import datetime
from pathlib import Path
from typing import Optional


class JSConsoleLogger:
    """Monitors Chrome DevTools Protocol for console messages and logs them."""

    def __init__(self, debug_port: int = 9223, log_file: Optional[str] = None):
        self.debug_port = debug_port
        self.log_file = log_file or str(Path.cwd() / 'logs' / 'pdf-viewer-js.log')
        self.ws: Optional[websocket.WebSocket] = None
        self.thread: Optional[threading.Thread] = None
        self.running = False

        # Setup logger for JS console output
        self._setup_js_logger()

    def _setup_js_logger(self) -> None:
        """Setup dedicated logger for JavaScript console output."""
        self.js_logger = logging.getLogger('pdf-viewer.js-console')
        self.js_logger.setLevel(logging.DEBUG)

        # Remove existing handlers
        self.js_logger.handlers.clear()

        # Create file handler
        handler = logging.FileHandler(self.log_file, encoding='utf-8', mode='w')
        formatter = logging.Formatter('[%(asctime)s.%(msecs)03d][%(levelname)s] %(message)s',
                                    datefmt='%H:%M:%S')
        handler.setFormatter(formatter)
        self.js_logger.addHandler(handler)

        # Prevent propagation to root logger to avoid duplicate logs in pdf-viewer.log
        self.js_logger.propagate = False

    def start(self) -> bool:
        """Start monitoring JavaScript console output."""
        if self.running:
            return True

        try:
            # Get WebSocket URL from Chrome DevTools Protocol
            response = requests.get(f'http://localhost:{self.debug_port}/json')
            if response.status_code != 200:
                print(f"Error: Failed to connect to debug port {self.debug_port}")
                return False

            tabs = response.json()
            if not tabs:
                print("Error: No debug targets available")
                return False

            # Use first tab (should be pdf-viewer)
            websocket_url = tabs[0]['webSocketDebuggerUrl']

            # Start WebSocket connection in separate thread
            self.running = True
            self.thread = threading.Thread(target=self._websocket_loop, args=(websocket_url,))
            self.thread.daemon = True
            self.thread.start()

            print(f"Info: Started PDF-Viewer JS console logger on debug port {self.debug_port}")
            return True

        except Exception as exc:
            print(f"Error: Failed to start PDF-Viewer JS console logger: {exc}")
            return False

    def stop(self) -> None:
        """Stop monitoring."""
        self.running = False
        if self.ws:
            self.ws.close()
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        print("Info: PDF-Viewer JS console logger stopped")

    def _websocket_loop(self, ws_url: str) -> None:
        """WebSocket loop to receive console messages."""
        try:
            self.ws = websocket.create_connection(ws_url)

            # Enable Runtime domain to receive console messages
            self.ws.send(json.dumps({
                'id': 1,
                'method': 'Runtime.enable'
            }))

            # Enable Console domain
            self.ws.send(json.dumps({
                'id': 2,
                'method': 'Console.enable'
            }))

            # Enable Page domain for PDF-specific events
            self.ws.send(json.dumps({
                'id': 3,
                'method': 'Page.enable'
            }))

            print("Info: Connected to PDF-Viewer Chrome DevTools Protocol WebSocket")

            while self.running:
                try:
                    message = self.ws.recv()
                    if message:
                        self._handle_message(json.loads(message))
                except websocket.WebSocketTimeoutError:
                    continue
                except Exception as exc:
                    if self.running:
                        print(f"Error: PDF-Viewer WebSocket error: {exc}")
                    break

        except Exception as exc:
            print(f"Error: PDF-Viewer WebSocket connection failed: {exc}")
        finally:
            if self.ws:
                self.ws.close()

    def _handle_message(self, message: dict) -> None:
        """Handle incoming DevTools Protocol message."""
        method = message.get('method')
        params = message.get('params', {})

        if method == 'Runtime.consoleAPICalled':
            self._handle_console_message(params)
        elif method == 'Console.messageAdded':
            self._handle_console_message(params.get('message', {}))
        elif method == 'Page.loadEventFired':
            self._log_page_event("Page load completed")
        elif method == 'Page.domContentLoadedEventFired':
            self._log_page_event("DOM content loaded")

    def _handle_console_message(self, params: dict) -> None:
        """Process console message and log it."""
        try:
            # Extract message details
            level = params.get('type', 'log').upper()
            args = params.get('args', [])

            # Convert arguments to string
            message_parts = []
            for arg in args:
                if isinstance(arg, dict):
                    if arg.get('type') == 'string':
                        message_parts.append(arg.get('value', ''))
                    elif 'description' in arg:
                        message_parts.append(arg['description'])
                    elif 'value' in arg:
                        message_parts.append(str(arg['value']))
                    else:
                        message_parts.append(json.dumps(arg))
                else:
                    message_parts.append(str(arg))

            message_text = ' '.join(message_parts)

            if not message_text:
                return

            # Add PDF-Viewer specific prefix for identification
            prefixed_message = f"[PDF-VIEWER] {message_text}"

            # Map console levels to logging levels
            log_level = {
                'LOG': logging.INFO,
                'INFO': logging.INFO,
                'WARN': logging.WARNING,
                'WARNING': logging.WARNING,
                'ERROR': logging.ERROR,
                'DEBUG': logging.DEBUG,
                'TRACE': logging.DEBUG
            }.get(level, logging.INFO)

            # Log the message
            self.js_logger.log(log_level, prefixed_message)

            # Special handling for PDF-specific messages
            if any(keyword in message_text.lower() for keyword in ['pdf', 'canvas', 'render', 'page', 'zoom']):
                self.js_logger.info(f"[PDF-SPECIFIC] {message_text}")

        except Exception as exc:
            print(f"Error: Failed to handle PDF-Viewer console message: {exc}")

    def _log_page_event(self, event_name: str) -> None:
        """Log page-level events."""
        try:
            self.js_logger.info(f"[PAGE-EVENT] {event_name}")
        except Exception as exc:
            print(f"Error: Failed to log page event: {exc}")


def main():
    """Test the PDF-Viewer JS console logger."""
    import sys

    debug_port = int(sys.argv[1]) if len(sys.argv) > 1 else 9223

    # Setup basic logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')

    logger = JSConsoleLogger(debug_port)

    if logger.start():
        try:
            print(f"Monitoring PDF-Viewer JavaScript console on debug port {debug_port}")
            print("Press Ctrl+C to stop...")
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nStopping...")
        finally:
            logger.stop()
    else:
        print(f"Failed to start PDF-Viewer console logger on port {debug_port}")
        sys.exit(1)


if __name__ == '__main__':
    main()