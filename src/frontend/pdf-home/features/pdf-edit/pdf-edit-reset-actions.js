import { WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";

/**
 * @param {object} params
 * @param {object} params.record
 * @param {import("../../../common/ws/ws-client.js").WSClient|null} params.wsClient
 * @param {(title:string,message:string)=>Promise<boolean>} params.confirm
 * @param {(message:string)=>void} params.showGlobalError
 * @param {(message:string)=>void} params.showGlobalWarning
 */
export function bindPdfEditResetActions({
  record,
  wsClient,
  confirm,
  showGlobalError,
  showGlobalWarning,
}) {
  const fileId = record?.pdf_id || record?.id || record?.filename;
  const pdfUuid = record?.pdf_id || record?.id; // 期望是12位十六进制

  const warnInvalidId = () => {
    showGlobalWarning("无法识别PDF ID，重置可能不会同步到后端");
  };

  const btnBookmarks = document.getElementById("reset-bookmarks-btn");
  if (btnBookmarks) {
    btnBookmarks.addEventListener("click", async () => {
      try {
        if (!pdfUuid) {
          warnInvalidId();
        }
        const ok = await confirm(
          "重置大纲",
          "已切换为“大纲（Outline）”存储，不再支持 legacy 的书签批量重置。请在 PDF 查看器的“大纲侧栏”中管理节点。",
        );
        if (!ok) {return;}
        showGlobalWarning("已弃用“批量重置书签”。请在查看器内用大纲面板进行增删改。");
      } catch (err) {
        showGlobalError(`重置书签失败: ${err?.message || err}`);
      }
    });
  }

  const btnReading = document.getElementById("reset-reading-btn");
  if (btnReading) {
    btnReading.addEventListener("click", async () => {
      try {
        if (!fileId) {
          warnInvalidId();
        }
        const ok = await confirm("重置阅读进度", "确定要重置阅读进度吗？这将清零阅读时长与最近访问时间。");
        if (!ok) {return;}
        if (!wsClient) {
          showGlobalError("WebSocket未连接，无法执行重置");
          return;
        }
        await wsClient.request(
          WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED,
          { file_id: fileId, updates: { total_reading_time: 0, visited_at: 0 } },
          { timeout: 8000, metadata: { version: "1.0.0" } },
        );
        showGlobalWarning("阅读进度已重置");
      } catch (err) {
        showGlobalError(`重置阅读进度失败: ${err?.message || err}`);
      }
    });
  }
}

