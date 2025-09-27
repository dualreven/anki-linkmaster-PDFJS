#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import logging
import sys
import json
from pathlib import Path

from .core.service_manager import ServiceManager
from .core.port_manager import PortManager
from .services.persistent.ws_server_service import WsServerService
from .services.persistent.pdf_service import PdfHttpFileService
from .services.persistent.npm_service import NpmDevServerService

def setup_logging(project_root: Path):
    """Sets up logging for the ai-launcher."""
    logs_dir = project_root / "logs"
    logs_dir.mkdir(exist_ok=True)
    log_file = logs_dir / "ai-launcher.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.FileHandler(log_file, mode='w', encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog='ai-launcher', description='AI Launcher for project services')
    sub = p.add_subparsers(dest='cmd', required=True)

    sp_start = sub.add_parser('start', help='Start all services')
    sp_start.add_argument('--ws-port', type=int, help='Preferred WebSocket server port')
    sp_start.add_argument('--pdf-port', type=int, help='Preferred PDF HTTP server port')
    sp_start.add_argument('--npm-port', type=int, help='Preferred NPM dev server port')

    sub.add_parser('stop', help='Stop all services')
    sub.add_parser('status', help='Get status of all services')

    return p

def main() -> int:
    # Assume the project root is two levels up from this script's directory
    project_root = Path(__file__).resolve().parent.parent.parent
    setup_logging(project_root)
    
    logger = logging.getLogger("ai-launcher.main")

    mgr = ServiceManager()
    mgr.register('ws-server', WsServerService(project_root))
    mgr.register('pdf-file-server', PdfHttpFileService(project_root))
    mgr.register('npm-dev-server', NpmDevServerService(project_root))

    port_mgr = PortManager(project_root)
    
    p = build_parser()
    args = p.parse_args()

    if args.cmd == 'start':
        logger.info("Received 'start' command.")
        
        logger.info("Stopping existing services before starting...")
        mgr.stop_all()

        requested_ports = {
            "msgCenter_port": args.msgCenter_port,
            "pdfFile_port": args.pdfFile_port,
            "npm_port": args.npm_port,
        }
        requested_ports = {k: v for k, v in requested_ports.items() if v is not None}
        
        allocated_ports = port_mgr.allocate_ports(requested_ports)

        service_configs = {
            "msgCenter-server": {"port": allocated_ports.get("msgCenter_port")},
            "pdf-file-server": {"port": allocated_ports.get("pdfFile_port")},
            "npm-dev-server": {"port": allocated_ports.get("npm_port")},
        }

        ok = mgr.start_all(service_configs)
        
        print("\n--- Services Status ---")
        print(json.dumps(mgr.get_all_status(), indent=2))
        print("-----------------------\n")
        
        return 0 if ok else 1

    elif args.cmd == 'stop':
        logger.info("Received 'stop' command.")
        ok = mgr.stop_all()
        print("\n--- Services Status ---")
        print(json.dumps(mgr.get_all_status(), indent=2))
        print("-----------------------\n")
        return 0 if ok else 1

    elif args.cmd == 'status':
        logger.info("Received 'status' command.")
        print("\n--- Services Status ---")
        print(json.dumps(mgr.get_all_status(), indent=2))
        print("-----------------------\n")
        return 0
        
    else:
        p.print_help()
        return 2

if __name__ == '__main__':
    raise SystemExit(main())