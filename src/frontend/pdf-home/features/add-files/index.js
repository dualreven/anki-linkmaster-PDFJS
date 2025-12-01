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
import { getFileSelector } from "./file-selector.js";
import { getLogger } from "../../../common/utils/logger.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES, WEBSOCKET_MESSAGE_EVENTS, SEARCH_EVENTS, PDF_HOME_EVENTS } from "../../../common/event/event-constants.js";
import { showInfo, showSuccess, showInfoWithId, dismissById } from "../../../common/utils/notification.js";
import { notifyDomainError } from "../../../common/utils/domain-error-notifier.js";
import { createSubscriptionBag } from "../../../common/event/subscription-bag.js";

export class AddFilesFeature {
  name = AddFilesFeatureConfig.name;
  version = AddFilesFeatureConfig.version;
  dependencies = AddFilesFeatureConfig.dependencies;

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #subscriptionBag = null;
  #bridge = null;
  #genReqId() { return `add_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }

  async install(context) {
    this.#context = context;
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info("[AddFilesFeature] Installing...");

    this.#subscriptionBag = createSubscriptionBag({ loggerName: "AddFilesFeature.Subscriptions" });

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
      if (this.#subscriptionBag) {
        this.#subscriptionBag.clear();
        this.#subscriptionBag = null;
      }
    } finally {
      this.#bridge = null;
    }
    this.#logger?.info?.("[AddFilesFeature] Uninstalled");
  }

  #setupListeners() {
    // 监听“添加PDF”请求（来自 SearchBar / SearchFeature 转发）
    const unsub = this.#globalEventBus.on(SEARCH_EVENTS.ACTIONS.ADD_REQUESTED, async () => {
      try {
        await this.#handleAddRequested();
      } catch (e) {
        this.#logger.error("[AddFilesFeature] handleAddRequested failed", e);
        notifyDomainError({
          message: "添加PDF失败，请重试",
          logger: this.#logger,
          scope: "pdf-home:add-files:handleAddRequested",
          error: e
        });
      }
    }, { subscriberId: "AddFilesFeature" });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsub);
    }

    // 监听后端回执：添加完成/失败 → 反馈 + 触发刷新
    const unsubResp = this.#globalEventBus.on(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, (message) => {
      try {
        const t = String(message?.type || "");
        if (t === WEBSOCKET_MESSAGE_TYPES.ADD_PDF_COMPLETED) {
          const rid = message?.request_id;
          if (rid) { try { dismissById(rid); } catch { /* ignore */ } }
          const meta = message?.data?.file || message?.data || {};
          const title = meta?.title || meta?.filename || meta?.name || "PDF";
          try { showSuccess(`已添加：${title}`, 2500); } catch { /* ignore */ }
          // 触发一次“最近添加”视角的搜索刷新（前 N 条）
          this.#globalEventBus.emit(SEARCH_EVENTS.QUERY.REQUESTED, {
            searchText: "",
            sort: [{ field: "created_at", direction: "desc" }],
            pagination: { limit: 20, offset: 0, need_total: false }
          });
        }
      } catch (e) {
        // logger-guard
        void e;
      }
    }, { subscriberId: "AddFilesFeature:resp" });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubResp);
    }

    const unsubErr = this.#globalEventBus.on(WEBSOCKET_MESSAGE_EVENTS.ERROR, (message) => {
      try {
        const t = String(message?.type || message?.received_type || "");
        if (t === WEBSOCKET_MESSAGE_TYPES.ADD_PDF_FAILED) {
          const rid = message?.request_id;
          if (rid) { try { dismissById(rid); } catch { /* ignore */ } }
          const err = message?.error || message?.data || {};
          const tip = err?.message || "添加失败";
          notifyDomainError({
            message: String(tip),
            logger: this.#logger,
            scope: PDF_HOME_EVENTS.ADD_FILES.WS_ERROR,
            error: err
          });
        }
      } catch { /* ignore */ }
    }, { subscriberId: "AddFilesFeature:error" });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubErr);
    }
  }

  async #ensureBridge() {
    if (this.#bridge) {return this.#bridge;}
    this.#bridge = new QWebChannelBridge();
    await this.#bridge.initialize();
    return this.#bridge;
  }

  async #handleAddRequested() {
    this.#logger.info("[AddFilesFeature] Add requested → opening file dialog...");
    try { showInfo("请选择要添加的PDF文件", 2500); } catch { /* ignore */ }

    // 1) 选择文件（生产：QWebChannel；E2E：Stub，显式开启时）
    const options = {
      multiple: !!AddFilesFeatureConfig.config.multiple,
      fileType: AddFilesFeatureConfig.config.fileType || "pdf"
    };
    const selector = getFileSelector({
      bridgeFactory: async () => await this.#ensureBridge()
    });
    const files = await selector.selectFiles(options);

    if (!files || files.length === 0) {
      this.#logger.info("[AddFilesFeature] 用户取消选择或未选择文件");
      try { this.#logger.warn("已取消选择", { toast: { type: "warn", ms: 2000 } }); } catch { /* ignore */ }
      return;
    }

    this.#logger.info(`[AddFilesFeature] 选择到 ${files.length} 个文件，准备发送WS请求`);

    // 2) 逐个发送到后端（WS：pdf-library:add:requested）
    for (const filePath of files) {
      const name = String(filePath).split(/[\\/]/).pop();
      const request_id = this.#genReqId();
      const payload = {
        type: WEBSOCKET_MESSAGE_TYPES.ADD_PDF,
        timestamp: Date.now(),
        request_id,
        metadata: { version: "1.0.0" },
        data: {
          filepath: filePath
        }
      };
      this.#logger.info("[AddFilesFeature] 发送添加请求", { name });
      try { showInfoWithId(request_id, `正在添加：${name}`, 0); } catch { /* ignore */ }
      this.#globalEventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, payload);
    }
  }
}

export default AddFilesFeature;

