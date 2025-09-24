# Module Requirements Summary

This document captures the target architecture and requirements across frontend (pdf-home, pdf-viewer), backend servers (WebSocket, HTTP file, PDF business), logging system, and the modular AI launcher. It reflects current implementation status and concrete next steps. All file IO must explicitly use UTF-8 and ensure newlines are correct.

## Overview
- Separation of concerns and layered boundaries
  - Frontend apps are pure UI modules: use shared infra (event bus, logger, ws-client), and communicate with Python only via QWebChannel where needed.
  - Backend servers are headless services: WebSocket forwarder, HTTP file server, future PDF business server.
  - Logging is split by layer: frontend console captured via DevTools, backend via Python logging.
  - AI Launcher is modular: services are short, composable, start/stop/status, and independently testable.

## Frontend: pdf-home (Pure UI)
- Responsibilities
  - UI-only: list, selection, actions, and UI events.
  - Dependencies: `src/frontend/common/event/event-bus.js`, `src/frontend/common/utils/logger.js`, `src/frontend/common/ws/ws-client.js`.
  - QWebChannel: managed in frontend (see `src/frontend/pdf-home/qwebchannel-manager.js`).
  - Remote debugging: enable QtWebEngine remote debug; JS console captured by a Python sidecar.
- Key files
  - `src/frontend/pdf-home/index.js`
  - `src/frontend/pdf-home/container/app-container.js`
  - `src/frontend/pdf-home/qwebchannel-manager.js`
  - `src/frontend/common/*` (shared infra)
- Logging
  - JS console captured to `logs/pdf-home-js.log` via DevTools (CDP) consumer.

## Frontend: pdf-viewer (Pure UI)
- Responsibilities
  - UI-only: rendering canvas, zoom/navigation controls, and viewer UI events.
  - Use the same shared infra as pdf-home (event bus/logger/ws-client) for consistency.
  - May use QWebChannel only for narrowly defined bridge calls.
- Key files
  - `src/frontend/pdf-viewer/launcher.py` (standalone runner; resolves ports; sets QWebChannel)
  - `src/frontend/pdf-viewer/ui-manager-core.js` (core UI manager; relies on #elements/#state only)
  - `src/frontend/pdf-viewer/js_console_logger.py` (per-PDF console capture wrapper)
- Logging
  - Per-PDF console logs written to `logs/pdf-viewer-<pdf-id>-js.log` (UTF-8), captured via DevTools.

## Backend: WebSocket Server (Forwarder only)
- Responsibilities
  - Headless forwarder: receive and route messages between frontend and backend logic.
  - Decoupled from UI; no PyQt UI concerns.
- Key files
  - `src/backend/websocket/standard_server.py` (Qt-based server class)
  - Bound/started from application bootstrap (verify QApplication is not a hard dependency for headless usage).
- Requirements
  - Pure message forwarding, no UI logic.
  - Export connection status and simple admin metrics if practical.

## Backend: HTTP File Server (PDF files only)
- Responsibilities
  - Serve PDF files and static content.
  - Support Range requests; robust error handling; UTF-8 logs.
- Key file
  - `src/backend/http_server.py`
- Notes
  - Already implemented with diagnostic logging and port selection.

## Backend: PDF Business Server (TBD)
- Responsibilities
  - Handle PDF domain commands received via WebSocket (e.g., load/remove/metadata).
  - Interact with storage, indexing, or processing pipelines.
- Requirements
  - Independent module, headless.
  - Clear command schema and ACK/error replies over WebSocket.
  - Testable with scripted message flows.
- Next steps
  - Introduce `src/backend/services/pdf_business_server.py` providing a minimal command handler and registering with the WebSocket forwarder.

## Logging System
- Frontend logs
  - Use QtWebEngine remote debugging to emit console logs to a local DevTools endpoint.
  - Python sidecar connects to DevTools WS and writes to UTF-8 log files.
    - pdf-home: `logs/pdf-home-js.log`
    - pdf-viewer: `logs/pdf-viewer-<pdf-id>-js.log`
  - JS modules may log to console via shared logger; captured by the sidecar.
- Backend logs
  - Python `logging` used everywhere.
  - Ensure per-run truncation where appropriate (`mode='w'`) and consistent UTF-8 encoding.

## AI Launcher (Modular)
- Goals
  - Short, modular services with start/stop/status lifecycle.
  - Independent execution and testing for each service.
- Current skeleton
  - `ai-scripts/ai_launcher/core/service_manager.py` (registry + lifecycle)
  - `ai-scripts/ai_launcher/core/process_manager.py` (UTF-8 subprocess handling)
  - `ai-scripts/ai_launcher/core/types.py` (IService protocol)
  - Services (examples):
    - `ai-scripts/ai_launcher/services/persistent/ws_service.py` (WebSocket forwarder)
    - `ai-scripts/ai_launcher/services/persistent/pdf_service.py` (HTTP file server)
    - `ai-scripts/ai_launcher/services/persistent/npm_service.py` (Vite dev server)
  - CLI & example runner:
    - `ai-scripts/ai_launcher/cli/command_parser.py`
    - `ai-scripts/ai_launcher/example_run.py`

## Naming & I/O Policy
- Directories use kebab-case (e.g., `pdf-home`, `pdf-viewer`), not snake_case.
- All file IO must specify UTF-8 explicitly.
- Ensure newline correctness (\n) in generated/updated files.

## Testability & Independence
- Every module must be runnable in isolation and have a minimal verification path:
  - pdf-home / pdf-viewer: standalone launchers verify UI and logging.
  - WebSocket forwarder: echo/route tests via WS client.
  - HTTP file server: health endpoint + Range request tests.
  - AI launcher: service start/stop/status smoke tests.

## Implementation Status (snapshot)
- pdf-home: pure UI with shared infra and DevTools logging (done).
- pdf-viewer: pure UI; DevTools per-PDF logging wrapper added; private field usage corrected; shared infra alignment to be reviewed.
- WebSocket server: forwarder present; verify decoupling from UI bootstrap.
- HTTP file server: implemented.
- PDF business server: not yet implemented (next step).
- AI launcher: modular skeleton added; extend with health checks and service registration.

## Next Steps
1) Implement minimal `pdf_business_server` and wire to WebSocket forwarder.
2) Confirm pdf-viewer uses shared EventBus/WS client uniformly.
3) Add health checks and E2E scripts to AI launcher.
4) Harden logging rotation/truncation policies as needed.

