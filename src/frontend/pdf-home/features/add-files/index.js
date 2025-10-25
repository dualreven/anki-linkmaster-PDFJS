/**
 * AddFiles Feature - 负责“添加PDF”按钮的事件桥接
 * 流程：
 * 1) 监听全局事件 'search:add:requested'
 * 2) 通过 QWebChannelBridge 打开原生文件选择器
 * 3) 将用户选择的文件路径逐个通过 WS 发送到后端（pdf-library:add:requested）
 *
 * 说明：
 * - 不依赖 legacy 的 pdf-list 功能
 * - 保持 UTF-8 与 \n 输出约束
 */

import { AddFilesFeatureConfig } from "./feature.config.js";
import { QWebChannelBridge } from "../../qwebchannel/qwebchannel-bridge.js";
import { getLogger } from "../../../common/utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES, WEBSOCKET_MESSAGE_EVENTS } from "../../../common/event/event-constants.js";
import { info as toastInfo, warning as toastWarning, error as toastError, success as toastSuccess, pending as toastPending, dismissById } from "../../../common/utils/thirdparty-toast.js";

export class AddFilesFeature {
  name = AddFilesFeatureConfig.name;
  version = AddFilesFeatureConfig.version;
  dependencies = AddFilesFeatureConfig.dependencies;

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #unsubscribers = [];
  #bridge = null;
  #genReqId() { return `add_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }

  async install(context) {
    this.#context = context;
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info("[AddFilesFeature] Installing...");

    try {
      // 懒初始化 QWebChannelBridge（仅在首次点击时初始化）
      // 这里不立即初始化，以避免启动阶段的时序问题
      this.#setupListeners();
      this.#logger.info("[AddFilesFeature] Installed successfully");
      // 标记已使用，避免私有未使用告警
      void this.#context;
      void this.#scopedEventBus;
    } catch (e) {
      this.#logger.error("[AddFilesFeature] Installation failed", e);
      throw e;
    }
  }

  async uninstall() {
    this.#logger?.info?.("[AddFilesFeature] Uninstalling...");
    try {
      this.#unsubscribers.forEach((fn) => {
        try {
          if (typeof fn === "function") { fn(); }
        } catch { /* ignore */ }
      });
      this.#unsubscribers = [];
    } finally {
      this.#bridge = null;
    }
    this.#logger?.info?.("[AddFilesFeature] Uninstalled");
  }

  #setupListeners() {
    // 监听“添加PDF”请求（来自 SearchBar / SearchFeature 转发）
    const unsub = this.#globalEventBus.on("search:add:requested", async () => {
      try {
        await this.#handleAddRequested();
      } catch (e) {
        this.#logger.error("[AddFilesFeature] handleAddRequested failed", e);
        try { toastError("添加PDF失败，请重试", 4000); } catch { /* ignore */ }
      }
    }, { subscriberId: "AddFilesFeature" });
    this.#unsubscribers.push(unsub);

    // 监听后端回执：添加完成/失败 → 反馈 + 触发刷新
    const unsubResp = this.#globalEventBus.on(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, (message) => {
      try {
        const t = String(message?.type || "");
        if (t === WEBSOCKET_MESSAGE_TYPES.ADD_PDF_COMPLETED) {
          const rid = message?.request_id;
          if (rid) { try { dismissById(rid); } catch { /* ignore */ } }
          const meta = message?.data?.file || message?.data || {};
          const title = meta?.title || meta?.filename || meta?.name || "PDF";
          try { toastSuccess(`已添加：${title}`, 2500); } catch { /* ignore */ }
          // 触发一次“最近添加”视角的搜索刷新（前 N 条）
          this.#globalEventBus.emit("search:query:requested", {
            searchText: "",
            sort: [{ field: "created_at", direction: "desc" }],
            pagination: { limit: 20, offset: 0, need_total: false }
          });
        }
      } catch (e) {
        // 忽略解析错误，避免影响其他监听器
      }
    }, { subscriberId: "AddFilesFeature:resp" });
    this.#unsubscribers.push(unsubResp);

    const unsubErr = this.#globalEventBus.on(WEBSOCKET_MESSAGE_EVENTS.ERROR, (message) => {
      try {
        const t = String(message?.type || message?.received_type || "");
        if (t === "pdf-library:add:failed") {
          const rid = message?.request_id;
          if (rid) { try { dismissById(rid); } catch { /* ignore */ } }
          const err = message?.error || message?.data || {};
          const tip = err?.message || "添加失败";
          try { toastError(tip, 4000); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }, { subscriberId: "AddFilesFeature:error" });
    this.#unsubscribers.push(unsubErr);
  }

  async #ensureBridge() {
    if (this.#bridge) {return this.#bridge;}
    this.#bridge = new QWebChannelBridge();
    await this.#bridge.initialize();
    return this.#bridge;
  }

  async #handleAddRequested() {
    this.#logger.info("[AddFilesFeature] Add requested → opening file dialog...");
    try { toastInfo("请选择要添加的PDF文件", 2500); } catch { /* ignore */ }

    // 1) 打开原生文件对话框
    const bridge = await this.#ensureBridge();
    const options = {
      multiple: !!AddFilesFeatureConfig.config.multiple,
      fileType: AddFilesFeatureConfig.config.fileType || "pdf"
    };
    const files = await bridge.selectFiles(options);

    if (!files || files.length === 0) {
      this.#logger.info("[AddFilesFeature] 用户取消选择或未选择文件");
      try { toastWarning("已取消选择", 2000); } catch { /* ignore */ }
      return;
    }

    this.#logger.info(`[AddFilesFeature] 选择到 ${files.length} 个文件，准备发送WS请求`);

    // 2) 逐个发送到后端（WS：pdf-library:add:requested）
    for (const filePath of files) {
      const name = String(filePath).split(/[\\/]/).pop();
      const request_id = this.#genReqId();
      const payload = {
        type: WEBSOCKET_MESSAGE_TYPES.ADD_PDF,
        request_id,
        data: {
          name,
          filepath: filePath
        }
      };
      this.#logger.info("[AddFilesFeature] 发送添加请求", { name });
      try { toastPending(request_id, `正在添加：${name}`, 0); } catch { /* ignore */ }
      this.#globalEventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, payload);
    }
  }
}

export default AddFilesFeature;
