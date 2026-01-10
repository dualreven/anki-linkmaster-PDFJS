from typing import Callable, Dict, Any, Optional

# 路由项的函数签名：handler(request_id, data) -> dict（ctx 由闭包捕获）
RouteHandler = Callable[[Optional[str], Dict[str, Any]], Dict[str, Any]]


def build_router(ctx: Any) -> Dict[str, RouteHandler]:
    """
    根据上下文（StandardWebSocketServer 实例）构建消息路由表。
    采用闭包绑定 ctx，直接调用各领域处理器函数，入口类无需保留大量 handle_* 包装。
    """
    # 延迟导入，避免循环依赖
    from src.backend.msgCenter_server.handlers.storage_kv import kv_get, kv_set, kv_delete
    from src.backend.msgCenter_server.handlers.storage_fs import fs_read, fs_write
    from src.backend.msgCenter_server.handlers.capability import discover as capability_discover, describe as capability_describe
    from src.backend.msgCenter_server.handlers.pdf_library import (
        list_files as pdf_list,
        add_pdf as pdf_add,
        remove_batch as pdf_remove_batch,
        open_viewer_ack as pdf_viewer_ack,
        open_home_ack as pdf_home_ack,
        detail as pdf_detail,
        record_update as pdf_record_update,
        config_read as pdf_config_read,
        config_write as pdf_config_write,
    )
    # search 需要原始消息，仍由入口包装（保留 ctx.handle_pdf_search_request）
    from src.backend.msgCenter_server.handlers.pdf_viewer.annotation import list_annotations, save_annotation, delete_annotation
    from src.backend.msgCenter_server.handlers.pdf_viewer.annotation_bulk_get import annotation_bulk_get
    from src.backend.msgCenter_server.handlers.pdf_viewer.anchor import (
        get_anchor, list_anchors, create_anchor, update_anchor, delete_anchor, activate_anchor
    )
    from src.backend.msgCenter_server.handlers.pdf_viewer.viewer import register_viewer, navigate_viewer_validator
    from src.backend.msgCenter_server.handlers.pdf_viewer.bookmark import list_bookmarks, save_bookmarks
    from src.backend.msgCenter_server.handlers.pdf_viewer.outline import (
        list_outline, create_outline, update_outline, delete_outline, reorder_outline, bulk_save_outline
    )
    from src.backend.msgCenter_server.handlers.infra.debug import read_debug_info
    from src.backend.msgCenter_server.handlers.misc import heartbeat, console_log
    from src.backend.msgCenter_server.handlers.pdf_viewer.pdf_pages import load_page, preload_pages, clear_cache
    from src.backend.msgCenter_server.handlers.card_planner.final_output import card_planner_final_output

    def wrap(fn):
        return lambda request_id, data: fn(ctx, request_id, data)

    return {
        # storage-kv / fs
        "storage-kv:get:requested": wrap(kv_get),
        "storage-kv:set:requested": wrap(kv_set),
        "storage-kv:delete:requested": wrap(kv_delete),
        "storage-fs:read:requested": wrap(fs_read),
        "storage-fs:write:requested": wrap(fs_write),
        # capability
        "capability:discover:requested": lambda rid, data: capability_discover(ctx, rid),
        "capability:describe:requested": lambda rid, data: capability_describe(ctx, rid, data),
        # pdf-library（search 仍走入口包装以传 raw_message）
        "pdf-library:list:requested": wrap(pdf_list),
        "pdf-library:add:requested": wrap(pdf_add),
        "pdf-library:remove:requested": wrap(pdf_remove_batch),
        "pdf-library:viewer:requested": wrap(pdf_viewer_ack),
        "pdf-library:info:requested": wrap(pdf_detail),
        "pdf-library:record-update:requested": wrap(pdf_record_update),
        "pdf-library:config-read:requested": lambda rid, data: pdf_config_read(ctx, rid),
        "pdf-library:config-write:requested": wrap(pdf_config_write),
        "pdf-library:search:requested": ctx.handle_pdf_search_request,  # 需要 raw_message
        # pdf-home
        "pdf-home:open:requested": wrap(pdf_home_ack),
        # annotation
        "annotation:list:requested": wrap(list_annotations),
        "annotation:save:requested": wrap(save_annotation),
        "annotation:delete:requested": wrap(delete_annotation),
        "annotation:bulk-get:requested": wrap(annotation_bulk_get),
        # card-planner
        "card-planner:final-output:requested": wrap(card_planner_final_output),
        # anchor
        "anchor:get:requested": wrap(get_anchor),
        "anchor:list:requested": wrap(list_anchors),
        "anchor:create:requested": wrap(create_anchor),
        "anchor:update:requested": wrap(update_anchor),
        "anchor:delete:requested": wrap(delete_anchor),
        "anchor:activate:requested": wrap(activate_anchor),
        # viewer
        "pdf-viewer:register:requested": wrap(register_viewer),
        "pdf-viewer:navigate:requested": wrap(navigate_viewer_validator),
        # bookmark
        "bookmark:list:requested": wrap(list_bookmarks),
        "bookmark:save:requested": wrap(save_bookmarks),
        # outline（2025-11-06：改为 pdf-viewer 前缀）
        "pdf-viewer:outline-list:request": wrap(list_outline),
        "pdf-viewer:outline-create:request": wrap(create_outline),
        "pdf-viewer:outline-update:request": wrap(update_outline),
        "pdf-viewer:outline-delete:request": wrap(delete_outline),
        "pdf-viewer:outline-reorder:request": wrap(reorder_outline),
        "pdf-viewer:outline-bulk-save:request": wrap(bulk_save_outline),
        # debug
        "debug-info:read:requested": lambda rid, data: read_debug_info(ctx, rid),
        # pdf-page
        "pdf-page:load:requested": wrap(load_page),
        "pdf-page:preload:requested": wrap(preload_pages),
        "pdf-page:cache-clear:requested": wrap(clear_cache),
        # system
        "system:heartbeat:requested": wrap(heartbeat),
        # app-window（窗口生命周期管理）
        #  注意：
        #  - 实际的打开/关闭逻辑由 BackendLauncher._on_msgcenter_message 处理；
        #  - 这里只返回协议层的成功响应，避免 StandardServer 将合法消息视为 UNKNOWN_MESSAGE_TYPE。
        "app-window:open:requested": lambda rid, data: {
            "type": "app-window:open:completed",
            "request_id": rid or "unknown",
            "status": "success",
            "message": "窗口打开请求已接受",
            "code": 200,
        },
        "app-window:close:requested": lambda rid, data: {
            "type": "app-window:close:completed",
            "request_id": rid or "unknown",
            "status": "success",
            "message": "窗口关闭请求已接受",
            "code": 200,
        },
        # console（非三段式历史信号）
        "console_log": wrap(console_log),
    }
