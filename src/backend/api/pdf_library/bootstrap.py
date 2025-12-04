from __future__ import annotations
from typing import List, Optional
from pathlib import Path
import importlib.util
import logging
from ...database.config import get_db_path, get_connection_options, resolve_db_base_dir  # type: ignore
from ...database.connection import DatabaseConnectionManager  # type: ignore
from ...database.executor import SQLExecutor  # type: ignore
from ...database.plugin.event_bus import EventBus  # type: ignore
from ...database.plugin.plugin_registry import TablePluginRegistry  # type: ignore
from ...database.plugins.pdf_info_plugin import PDFInfoTablePlugin  # type: ignore
from ...database.plugins.pdf_annotation_plugin import PDFAnnotationTablePlugin  # type: ignore
from ...database.plugins.pdf_annotation_tags_plugin import PDFAnnotationTagsTablePlugin  # type: ignore
from ...database.plugins.pdf_annotation_relation_plugin import PDFAnnotationRelationTablePlugin  # type: ignore
from ...database.plugins.pdf_bookmark_plugin import PDFBookmarkTablePlugin  # type: ignore
from ...database.plugins.pdf_bookanchor_plugin import PDFBookanchorTablePlugin  # type: ignore
from ...database.plugins.search_condition_plugin import SearchConditionTablePlugin  # type: ignore


def register_plugins(api) -> None:
    for plugin in (
        api._pdf_info_plugin,
        api._annotation_plugin,
        api._annotation_tags_plugin,
        api._annotation_relation_plugin,
        api._bookmark_plugin,
        api._bookanchor_plugin,
        api._search_condition_plugin,
    ):
        try:
            api._registry.register(plugin)
        except ValueError:
            pass
    api._registry.enable_all()


def load_default_service(relparts: List[str], class_name: str):
    base = Path(__file__).parent.parent  # src/backend/api/pdf_library
    file_path = base.joinpath(*relparts)
    if not file_path.exists():
        return None
    module_name = "_api_" + "_" + "_".join([p.replace("-", "_") for p in relparts[:-1]])
    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    svc_cls = getattr(module, class_name, None)
    return svc_cls() if svc_cls else None


def auto_register_default_services(api) -> None:
    if not api._services.has("pdf-home.search"):
        try:
            svc = load_default_service(["..", "pdf-home", "search", "service.py"], "DefaultSearchService")
            if svc:
                api._services.register("pdf-home.search", svc)
        except Exception as exc:  # pragma: no cover
            api._logger.warning("auto-register search service failed: %s", exc)

    if not api._services.has("pdf-home.add"):
        try:
            svc = load_default_service(["..", "pdf-home", "add", "service.py"], "DefaultAddService")
            if svc:
                api._services.register("pdf-home.add", svc)
        except Exception as exc:  # pragma: no cover
            api._logger.warning("auto-register add service failed: %s", exc)

    if not api._services.has("pdf-viewer.bookmark"):
        try:
            svc = load_default_service(["..", "pdf-viewer", "bookmark", "service.py"], "DefaultBookmarkService")
            if svc:
                api._services.register("pdf-viewer.bookmark", svc)
        except Exception as exc:  # pragma: no cover
            api._logger.warning("auto-register bookmark service failed: %s", exc)

def initialize(
    api,
    db_path: Optional[str],
    *,
    logger: Optional[logging.Logger],
    event_bus: Optional[EventBus],
    pdf_manager,
    service_registry,
) -> None:
    api._logger = logger or logging.getLogger("pdf.library.api")
    api._db_path = db_path or str(get_db_path())
    try:
        (logging.getLogger("pdf.library.api") if logger is None else logger).info(
            "Using DB path: %s", api._db_path
        )
    except Exception:
        pass
    options = get_connection_options()
    api._connection_manager = DatabaseConnectionManager(api._db_path, **options)
    api._executor = SQLExecutor(api._connection_manager.get_connection())
    api._event_bus = event_bus or EventBus()
    try:
        TablePluginRegistry.reset_instance()
    except Exception:
        pass
    api._registry = TablePluginRegistry.get_instance(api._executor, api._event_bus, api._logger)
    api._pdf_info_plugin = PDFInfoTablePlugin(api._executor, api._event_bus, api._logger)
    api._annotation_plugin = PDFAnnotationTablePlugin(api._executor, api._event_bus, api._logger)
    api._annotation_tags_plugin = PDFAnnotationTagsTablePlugin(api._executor, api._event_bus, api._logger)
    api._annotation_relation_plugin = PDFAnnotationRelationTablePlugin(api._executor, api._event_bus, api._logger)
    api._bookmark_plugin = PDFBookmarkTablePlugin(api._executor, api._event_bus, api._logger)
    api._bookanchor_plugin = PDFBookanchorTablePlugin(api._executor, api._event_bus, api._logger)
    api._search_condition_plugin = SearchConditionTablePlugin(api._executor, api._event_bus, api._logger)
    register_plugins(api)
    api._services = service_registry
    auto_register_default_services(api)
    api._pdf_manager = pdf_manager
    if api._pdf_manager is None:
        try:
            from ...pdf_manager.standard_manager import StandardPDFManager as _StdMgr  # type: ignore
            from pathlib import Path as _Path
            base_dir = resolve_db_base_dir()
            data_dir_abs = str(_Path(base_dir) / "data")
            api._pdf_manager = _StdMgr(data_dir=data_dir_abs)
            try:
                (api._logger or logging.getLogger("pdf.library.api")).info(
                    "PDFManager fallback init with data_dir=%s", data_dir_abs
                )
            except Exception:
                pass
        except Exception as exc:  # pragma: no cover
            api._logger.warning("StandardPDFManager init failed: %s", exc)
            api._pdf_manager = None
