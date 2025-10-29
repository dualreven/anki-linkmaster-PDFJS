import argparse
import sys
from src.qt.compat import QCoreApplication
from src.backend.msgCenter_server.standard_server import StandardWebSocketServer, setup_logging, get_port


def main():
    parser = argparse.ArgumentParser(description="Standard WebSocket Server")
    parser.add_argument("--port", type=int, help="Port to run the server on")
    parser.add_argument("--db-path", dest="db_path", type=str, default=None, help="SQLite database file path (optional)")
    parser.add_argument("--runtime-mode", dest="runtime_mode", type=str, choices=["anki", "single"], default=None,
                        help="Runtime mode for path resolution: anki|single")
    parser.add_argument("--ankiaddon-root-path", dest="ankiaddon_root_path", type=str, default=None,
                        help="Anki add-on root path (required when runtime-mode=anki)")
    parser.add_argument("--data-dir", dest="data_dir", type=str, default=None,
                        help="Explicit data directory; overrides runtime-mode resolution if provided")
    parser.add_argument("--static-dir", dest="static_dir", type=str, default=None,
                        help="Explicit static directory (for diagnostics only in WS server)")
    parser.add_argument("--pdfs-dir", dest="pdfs_dir", type=str, default=None,
                        help="Explicit pdfs directory (for diagnostics only in WS server)")
    args = parser.parse_args()

    app = QCoreApplication(sys.argv)
    setup_logging()
    port = get_port(args.port)

    server = StandardWebSocketServer(
        port=port,
        app=app,
        db_path=args.db_path,
        runtime_mode=args.runtime_mode,
        ankiaddon_root_path=args.ankiaddon_root_path,
        data_dir=args.data_dir,
        static_dir=args.static_dir,
        pdfs_dir=args.pdfs_dir,
    )
    if server.start():
        sys.exit(app.exec())
    sys.exit(1)


if __name__ == "__main__":
    main()

