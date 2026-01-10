# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, Dict, Optional
import logging

from src.qt.compat import QWebSocket  # type: ignore

logger = logging.getLogger("backend-launcher.window-lifecycle")


class WindowLifecycleManager:
    """
    窗口生命周期管理器：
    - 以 client_id 为键管理窗口实例、应用对象以及对应的 QWebSocket 客户端；
    - 支持从“远程关闭请求”或“窗口自身 closeEvent”两个入口进行清理；
    - 遵循 Fail-Fast 原则：非法 client_id / 重复注册均视为错误。
    """

    def __init__(self, *, logger_obj: Optional[logging.Logger] = None) -> None:
        self._entries: Dict[str, Dict[str, Any]] = {}
        self._logger = logger_obj or logger

    # -------- 核心操作 --------

    def get_entry(self, client_id: str) -> Optional[Dict[str, Any]]:
        """
        只读查询窗口条目（用于 ensure_* 单例逻辑）。

        - 返回内部 entry 的浅拷贝，避免外部修改污染内部状态；
        - 未找到则返回 None；
        - client_id 为空则抛 ValueError（Fail-Fast）。
        """
        cid = (client_id or "").strip()
        if not cid:
            raise ValueError("WindowLifecycleManager.get_entry: client_id 不能为空")
        entry = self._entries.get(cid)
        return dict(entry) if entry is not None else None

    def register_window(
        self,
        client_id: str,
        app: Any,
        window: Any,
        meta: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        注册窗口实例。

        - client_id 必须为非空字符串；
        - 若相同 client_id 已存在且指向同一个 app/window，则视为幂等调用；
        - 若指向不同实例，则抛出 RuntimeError。
        """
        cid = (client_id or "").strip()
        if not cid:
            raise ValueError("WindowLifecycleManager.register_window: client_id 不能为空")
        if app is None or window is None:
            raise ValueError("WindowLifecycleManager.register_window: app/window 不能为空")

        existing = self._entries.get(cid)
        if existing is not None:
            if existing.get("app") is app and existing.get("window") is window:
                # 幂等：已注册同一窗口，跳过
                self._logger.debug(
                    "[WindowLifecycle] client_id=%s 已注册，同一实例重复调用 register_window 被忽略",
                    cid,
                )
                return
            raise RuntimeError(
                f"WindowLifecycleManager: client_id '{cid}' 已存在，且指向不同窗口实例"
            )

        entry = {
            "client_id": cid,
            "app": app,
            "window": window,
            "ws_client": None,
            "meta": dict(meta or {}),
            "closing": False,
        }
        self._entries[cid] = entry
        self._logger.info(
            "[WindowLifecycle] 注册窗口: client_id=%s, meta=%s",
            cid,
            entry["meta"],
        )

    def bind_ws_client(self, client_id: str, ws_client: QWebSocket) -> None:
        """
        绑定 QWebSocket 客户端到已注册的窗口。
        - 仅允许在窗口已注册的前提下绑定；
        - 重复绑定会覆盖旧引用。
        """
        cid = (client_id or "").strip()
        if not cid:
            raise ValueError("WindowLifecycleManager.bind_ws_client: client_id 不能为空")
        if ws_client is None:
            raise ValueError("WindowLifecycleManager.bind_ws_client: ws_client 不能为空")

        entry = self._entries.get(cid)
        if entry is None:
            raise KeyError(f"WindowLifecycleManager: 未找到 client_id={cid} 对应的窗口条目")
        if entry.get("closing"):
            self._logger.warning(
                "[WindowLifecycle] 尝试在 closing 状态下绑定 ws_client: client_id=%s",
                cid,
            )

        entry["ws_client"] = ws_client
        self._logger.info(
            "[WindowLifecycle] 绑定 ws_client 到窗口: client_id=%s",
            cid,
        )

    def close_window_by_id(self, client_id: str, *, reason: str = "requested") -> None:
        """
        通过 client_id 关闭窗口：
        - 标记 entry.closing=True；
        - 尝试调用 app.cleanup() 或 window.close()；
        - 关闭绑定的 ws_client（若仍处于连接状态）；
        - 从内部字典移除该条目。
        """
        cid = (client_id or "").strip()
        if not cid:
            raise ValueError("WindowLifecycleManager.close_window_by_id: client_id 不能为空")

        entry = self._entries.get(cid)
        if entry is None:
            raise KeyError(f"WindowLifecycleManager: 未找到 client_id={cid} 对应的窗口条目")

        entry["closing"] = True
        app = entry.get("app")
        window = entry.get("window")
        ws_client: Optional[QWebSocket] = entry.get("ws_client")

        self._logger.info(
            "[WindowLifecycle] 关闭窗口请求: client_id=%s, reason=%s",
            cid,
            reason,
        )

        # 先尝试调用应用层清理（通常会触发 window.close 和内部资源释放）
        try:
            if app is not None and hasattr(app, "cleanup"):
                app.cleanup()  # type: ignore[call-arg]
                self._logger.debug(
                    "[WindowLifecycle] 已调用 app.cleanup(): client_id=%s", cid
                )
            elif window is not None and hasattr(window, "close"):
                window.close()  # type: ignore[call-arg]
                self._logger.debug(
                    "[WindowLifecycle] 已调用 window.close(): client_id=%s", cid
                )
        except Exception as exc:
            self._logger.warning(
                "[WindowLifecycle] 关闭窗口时发生异常: client_id=%s, error=%s",
                cid,
                exc,
            )

        # 再关闭绑定的 QWebSocket（若仍连接）
        try:
            if ws_client is not None:
                try:
                    state = ws_client.state()
                except Exception:
                    state = None
                try:
                    from src.qt.compat import QAbstractSocket  # type: ignore
                    connected_state = QAbstractSocket.SocketState.ConnectedState
                except Exception:
                    connected_state = None

                if connected_state is None or state == connected_state:
                    try:
                        ws_client.close()
                    except Exception:
                        pass
        except Exception as exc:
            self._logger.warning(
                "[WindowLifecycle] 关闭 ws_client 时发生异常: client_id=%s, error=%s",
                cid,
                exc,
            )

        # 最终从表中移除
        self._entries.pop(cid, None)
        self._logger.info(
            "[WindowLifecycle] 已从注册表移除窗口: client_id=%s",
            cid,
        )

    def on_window_closed(self, window: Any) -> None:
        """
        在窗口自身 closeEvent 中调用，用于从“窗口事件”入口清理注册表。

        - 如 entry.closing=True，视为由 close_window_by_id 触发的关闭，仅做字典清理；
        - 如 entry.closing=False，视为窗口本地关闭，可根据需要检查并关闭 ws_client。
        """
        if window is None:
            return

        target_cid: Optional[str] = None
        target_entry: Optional[Dict[str, Any]] = None
        for cid, entry in list(self._entries.items()):
            if entry.get("window") is window:
                target_cid = cid
                target_entry = entry
                break

        if target_cid is None or target_entry is None:
            # 未找到匹配窗口，仅记录日志
            self._logger.debug(
                "[WindowLifecycle] on_window_closed 未找到匹配窗口条目，忽略。"
            )
            return

        closing_flag = bool(target_entry.get("closing"))
        ws_client: Optional[QWebSocket] = target_entry.get("ws_client")

        if not closing_flag:
            # 本地关闭：窗口先行关闭，这里作为兜底关闭 ws_client 并清理字典
            self._logger.info(
                "[WindowLifecycle] 检测到窗口本地关闭: client_id=%s", target_cid
            )
            try:
                if ws_client is not None:
                    try:
                        state = ws_client.state()
                    except Exception:
                        state = None
                    try:
                        from src.qt.compat import QAbstractSocket  # type: ignore
                        connected_state = QAbstractSocket.SocketState.ConnectedState
                    except Exception:
                        connected_state = None
                    if connected_state is None or state == connected_state:
                        try:
                            ws_client.close()
                        except Exception:
                            pass
            except Exception as exc:
                self._logger.warning(
                    "[WindowLifecycle] on_window_closed 关闭 ws_client 异常: client_id=%s, error=%s",
                    target_cid,
                    exc,
                )

        # 无论如何移除注册表记录
        self._entries.pop(target_cid, None)
        self._logger.info(
            "[WindowLifecycle] on_window_closed 已移除窗口条目: client_id=%s",
            target_cid,
        )

    def close_all(self, *, reason: str = "shutdown") -> None:
        """
        关闭所有已注册窗口与 ws-client。
        """
        for cid in list(self._entries.keys()):
            try:
                self.close_window_by_id(cid, reason=reason)
            except Exception as exc:
                self._logger.warning(
                    "[WindowLifecycle] close_all 关闭窗口失败: client_id=%s, error=%s",
                    cid,
                    exc,
                )
