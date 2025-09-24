#!/usr/bin/env python3
"""
JavaScript Console Logger for PDF-Home

Monitors the Chrome DevTools Protocol remote debugging port to capture
JavaScript console output and logs it to logs/pdf-home-js.log using Python's
logging module.

This replaces the cross-layer QWebChannel log transmission approach.
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

    def __init__(self, debug_port: int = 9222, log_file: Optional[str] = None):
        self.debug_port = debug_port
        self.log_file = log_file or str(Path.cwd() / 'logs' / 'pdf-home-js.log')
        self.ws: Optional[websocket.WebSocket] = None
        self.thread: Optional[threading.Thread] = None
        self.running = False

        # Setup logger for JS console output
        self._setup_js_logger()

        # Setup logger for this module (prevent propagation to avoid mixing with pdf-home.log)
        self.logger = logging.getLogger('js_console_logger')
        self.logger.propagate = False

        # Create dedicated handler for JSConsoleLogger internal logs
        if not self.logger.handlers:
            # Create a separate log file for JSConsoleLogger internal logs
            from pathlib import Path
            internal_log_file = str(Path(self.log_file).parent / 'js-console-logger.log')
            handler = logging.FileHandler(internal_log_file, encoding='utf-8')
            formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(name)s: %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    def _setup_js_logger(self) -> None:
        """Setup dedicated logger for JavaScript console output."""
        self.js_logger = logging.getLogger('pdf-home.js-console')
        self.js_logger.setLevel(logging.DEBUG)

        # Remove existing handlers
        self.js_logger.handlers.clear()

        # Create file handler
        handler = logging.FileHandler(self.log_file, encoding='utf-8')
        formatter = logging.Formatter('[%(asctime)s.%(msecs)03d][%(levelname)s] %(message)s',
                                    datefmt='%H:%M:%S')
        handler.setFormatter(formatter)
        self.js_logger.addHandler(handler)

        # Prevent propagation to root logger
        self.js_logger.propagate = False

    def start(self) -> bool:
        """Start monitoring JavaScript console output."""
        if self.running:
            return True

        try:
            # Get WebSocket URL from Chrome DevTools Protocol
            response = requests.get(f'http://localhost:{self.debug_port}/json')
            if response.status_code != 200:
                self.logger.error(f"Failed to connect to debug port {self.debug_port}")
                return False

            tabs = response.json()
            if not tabs:
                self.logger.error("No debug targets available")
                return False

            # Use first tab (should be pdf-home)
            websocket_url = tabs[0]['webSocketDebuggerUrl']

            # Start WebSocket connection in separate thread
            self.running = True
            self.thread = threading.Thread(target=self._websocket_loop, args=(websocket_url,))
            self.thread.daemon = True
            self.thread.start()

            self.logger.info(f"Started JS console logger on debug port {self.debug_port}")
            return True

        except Exception as exc:
            self.logger.error(f"Failed to start JS console logger: {exc}")
            return False

    def stop(self) -> None:
        """Stop monitoring."""
        self.running = False
        if self.ws:
            self.ws.close()
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        self.logger.info("JS console logger stopped")

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

            self.logger.info("Connected to Chrome DevTools Protocol WebSocket")

            while self.running:
                try:
                    message = self.ws.recv()
                    if message:
                        self._handle_message(json.loads(message))
                except websocket.WebSocketTimeoutError:
                    continue
                except Exception as exc:
                    if self.running:
                        self.logger.error(f"WebSocket error: {exc}")
                    break

        except Exception as exc:
            self.logger.error(f"WebSocket connection failed: {exc}")
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

            # Map console levels to logging levels
            log_level = {
                'LOG': logging.INFO,
                'INFO': logging.INFO,
                'WARN': logging.WARNING,
                'WARNING': logging.WARNING,
                'ERROR': logging.ERROR,
                'DEBUG': logging.DEBUG
            }.get(level, logging.INFO)

            # Log the message
            self.js_logger.log(log_level, message_text)

        except Exception as exc:
            self.logger.error(f"Failed to handle console message: {exc}")

def main():
    """Test the JS console logger."""
    import sys

    debug_port = int(sys.argv[1]) if len(sys.argv) > 1 else 9222

    # Setup basic logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')

    logger = JSConsoleLogger(debug_port)

    if logger.start():
        try:
            print(f"Monitoring JavaScript console on debug port {debug_port}")
            print("Press Ctrl+C to stop...")
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nStopping...")
        finally:
            logger.stop()
    else:
        print(f"Failed to start console logger on port {debug_port}")
        sys.exit(1)


if __name__ == '__main__':
    main()