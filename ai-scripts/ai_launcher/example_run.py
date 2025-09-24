#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

from .core.service_manager import ServiceManager
from .cli.command_parser import build_parser
from .services.persistent.ws_service import WebSocketForwarderService
from .services.persistent.pdf_service import PdfHttpFileService
from .services.persistent.npm_service import NpmDevServerService


def main() -> int:
    mgr = ServiceManager()
    # Register example services
    mgr.register('ws-forwarder', WebSocketForwarderService())
    mgr.register('pdf-file-server', PdfHttpFileService())
    mgr.register('npm-dev-server', NpmDevServerService())

    p = build_parser()
    args = p.parse_args()

    if args.cmd == 'start':
        ok = mgr.start(args.name)
        print('OK' if ok else 'FAIL')
        return 0 if ok else 1
    elif args.cmd == 'stop':
        ok = mgr.stop(args.name)
        print('OK' if ok else 'FAIL')
        return 0 if ok else 1
    elif args.cmd == 'status':
        print(mgr.all_status())
        return 0
    else:
        p.print_help()
        return 2


if __name__ == '__main__':
    raise SystemExit(main())

