/**
 * QWebChannelBridge
 * 说明（详细）：`docs/standards/qwebchannel-bridge.md`
 */

import { getLogger } from "../../common/utils/logger.js";
import { showSuccess } from "../../common/utils/notification.js";
import { notifyDomainError } from "../../common/utils/domain-error-notifier.js";
import { PDF_HOME_EVENTS } from "../../common/event/event-constants.js";

export class QWebChannelBridge {
  #logger;
  #bridge = null;
  #isReady = false;
  #initPromise = null;

  constructor() {
    this.#logger = getLogger("QWebChannelBridge");
    this.#logger.info("QWebChannelBridge 实例创建");
  }

  async initialize() {
    // 如果已经初始化，直接返回
    if (this.#isReady) {
      this.#logger.debug("QWebChannel 已经初始化，跳过");
      return;
    }

    // 如果正在初始化，等待之前的初始化完成
    if (this.#initPromise) {
      this.#logger.debug("QWebChannel 正在初始化，等待完成");
      return this.#initPromise;
    }

    // 开始初始化
    this.#logger.info("开始初始化 QWebChannel...");

    const getGlobalQWebChannel = () => {
      try {
        return (typeof window !== "undefined" ? window.QWebChannel : undefined) ||
          (typeof globalThis !== "undefined" ? globalThis.QWebChannel : undefined);
      } catch (e) {
        // logger-guard
        void e;
        return undefined;
      }
    };

    const ensureQWebChannelScript = () => {
      try {
        // 若已存在全局对象，直接完成
        if (getGlobalQWebChannel()) {return Promise.resolve(true);}
        // 查找已存在的脚本标签
        const exists = Array.from(document.getElementsByTagName("script")).some(sc => {
          const src = sc.getAttribute("src") || "";
          return src.includes("/js/qwebchannel.js") || src.endsWith("qwebchannel.js");
        });
        if (exists) {return Promise.resolve(true);}
        // 动态注入脚本
        const sc = document.createElement("script");
        sc.src = "/js/qwebchannel.js";
        sc.async = false; // 保持执行顺序
        const p = new Promise((resolve) => {
          sc.onload = () => resolve(true);
          sc.onerror = () => resolve(false);
        });
        (document.head || document.body || document.documentElement).appendChild(sc);
        return p;
      } catch (e) {
        // logger-guard
        void e;
        return Promise.resolve(false);
      }
    };

    this.#initPromise = new Promise((resolve, reject) => {
      (async () => {
        // 等待 QWebChannel 可用（在 ESM 模块中需从 window/globalThis 读取）
        let QWC = getGlobalQWebChannel();
        if (!QWC) {
          this.#logger.warn("QWebChannel 未定义，尝试动态注入 /js/qwebchannel.js ...");
          await ensureQWebChannelScript();
          const maxWait = 10000; // 最多等待10秒
          const step = 100;
          let waited = 0;
          const t = setInterval(() => {
            waited += step;
            QWC = getGlobalQWebChannel();
            if (QWC) {
              clearInterval(t);
              this.#logger.info("QWebChannel 已注入");
              // 继续后续传输层检查
              proceed();
            } else if (waited >= maxWait) {
              clearInterval(t);
              const error = "QWebChannel 未定义：qwebchannel.js 未能注入或加载超时";
              this.#logger.error(error);
              reject(new Error(error));
            }
          }, step);
          return; // 等待回调继续
        }

        // 检查 Qt WebChannel 传输层是否可用
        const proceed = () => {
          // 传输层已就绪，直接连接
          this.#connectToChannel(resolve, reject);
        };

        if (!window.qt || !window.qt.webChannelTransport) {
          this.#logger.warn("Qt WebChannel 传输层未就绪，等待...");

          // 等待传输层就绪（最多等待10秒）
          const checkInterval = 100;
          const maxWaitTime = 10000;
          let elapsedTime = 0;

          const checkTransport = setInterval(() => {
            elapsedTime += checkInterval;

            if (window.qt && window.qt.webChannelTransport) {
              clearInterval(checkTransport);
              this.#logger.info("Qt WebChannel 传输层已就绪");
              proceed();
            } else if (elapsedTime >= maxWaitTime) {
              clearInterval(checkTransport);
              const error = "Qt WebChannel 传输层超时未就绪";
              this.#logger.error(error);
              reject(new Error(error));
            }
          }, checkInterval);

          return;
        }

        // 传输层已就绪，直接连接
        proceed();
      })().catch(reject);
    });

    return this.#initPromise;
  }

  #connectToChannel(resolve, reject) {
    try {
      this.#logger.info("正在连接 QWebChannel...");

      const QWC = (typeof window !== "undefined" ? window.QWebChannel : undefined) || (typeof globalThis !== "undefined" ? globalThis.QWebChannel : undefined);
      if (!QWC) {throw new Error("QWebChannel 全局对象缺失");}
      new QWC(window.qt.webChannelTransport, (channel) => {
        this.#logger.info("QWebChannel 连接成功");

        // 获取 pyqtBridge 对象
        if (!channel.objects.pyqtBridge) {
          const error = "pyqtBridge 对象未注册";
          this.#logger.error(error);
          reject(new Error(error));
          return;
        }

        this.#bridge = channel.objects.pyqtBridge;
        this.#isReady = true;

        this.#logger.info("QWebChannel 初始化完成");
        this.#logger.debug("可用的桥接方法:", Object.keys(this.#bridge));

        resolve();
      });

    } catch (error) {
      this.#logger.error("连接 QWebChannel 失败:", error);
      reject(error);
    }
  }

  isReady() {
    return this.#isReady;
  }

  async testConnection() {
    this.#logger.info("调用 testConnection");

    if (!this.#isReady) {
      throw new Error("QWebChannel 未初始化，请先调用 initialize()");
    }

    try {
      // 将同步调用包装成 Promise
      const result = await new Promise((resolve, reject) => {
        try {
          const message = this.#bridge.testConnection();
          resolve(message);
        } catch (error) {
          reject(error);
        }
      });

      this.#logger.info("testConnection 返回:", result);
      return result;

    } catch (error) {
      this.#logger.error("testConnection 失败:", error);
      throw error;
    }
  }

  async selectFiles(options = {}) {
    const { multiple = true, fileType = "pdf" } = options;

    this.#logger.info(`[阶段2] 调用 selectFiles: multiple=${multiple}, fileType=${fileType}`);

    if (!this.#isReady) {
      throw new Error("QWebChannel 未初始化，请先调用 initialize()");
    }

    try {
      // 调用 PyQt 方法并包装成 Promise
      const files = await new Promise((resolve, reject) => {
        try {
          const result = this.#bridge.selectFiles(multiple, fileType);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!files || files.length === 0) {
        this.#logger.info("[阶段2] 用户取消了文件选择或未选择文件");
        return [];
      }

      this.#logger.info(`[阶段2] 收到 ${files.length} 个文件路径:`);
      files.forEach((file, i) => {
        this.#logger.info(`[阶段2]   文件${i + 1}: ${file}`);
      });

      return files;

    } catch (error) {
      this.#logger.error("[阶段2] selectFiles 失败:", error);
      throw error;
    }
  }

  async showConfirmDialog(title, message) {
    this.#logger.info(`[删除-阶段1] 调用 showConfirmDialog: title="${title}"`);
    this.#logger.info(`[删除-阶段1] 消息: ${message}`);

    if (!this.#isReady) {
      throw new Error("QWebChannel 未初始化，请先调用 initialize()");
    }

    try {
      // 调用 PyQt 方法并包装成 Promise
      const confirmed = await new Promise((resolve, reject) => {
        try {
          const result = this.#bridge.showConfirmDialog(title, message);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.#logger.info(`[删除-阶段1] 用户选择: ${confirmed ? "确认" : "取消"}`);
      return confirmed;

    } catch (error) {
      this.#logger.error("[删除-阶段1] showConfirmDialog 失败:", error);
      throw error;
    }
  }

  getBridge() {
    return this.#bridge;
  }

  async openPdfViewers(options = {}) {
    const { pdfIds = [], items = null } = options;
    this.#logger.info(`[阅读] 调用 openPdfViewers, 选中数量=${pdfIds.length}${items ? `, items=${items.length}` : ""}`);

    if (!this.#isReady) {
      throw new Error("QWebChannel 未初始化，请先调用 initialize()");
    }

    try {
      const ok = await new Promise((resolve, reject) => {
        try {
          if (items && typeof this.#bridge.openPdfViewersEx === "function") {
            const result = this.#bridge.openPdfViewersEx({ pdfIds, items });
            resolve(!!result);
            return;
          }
          const result = this.#bridge.openPdfViewers(pdfIds);
          resolve(!!result);
        } catch (error) {
          reject(error);
        }
      });
      this.#logger.info(`[阅读] openPdfViewers 返回: ${ok}`);
      return !!ok;
    } catch (error) {
      this.#logger.error("[阅读] openPdfViewers 失败:", error);
      throw error;
    }
  }

  async openPdfViewersWithMeta(payload) {
    // 通知：统一使用 notification/logger（禁止直接导入 thirdparty-toast）

    this.#logger.info("[QWC步骤1] openPdfViewersWithMeta 被调用", { payload });

    if (!this.#isReady) {
      notifyDomainError({
        message: "❌ [QWC] QWebChannel 未初始化",
        logger: this.#logger,
        scope: PDF_HOME_EVENTS.QWEBCHANNEL.INIT
      });
      throw new Error("QWebChannel 未初始化，请先调用 initialize()");
    }

    this.#logger.info("[QWC步骤2] 检查可用方法", {
      hasOpenPdfViewersEx: typeof this.#bridge.openPdfViewersEx === "function",
      hasOpenPdfViewers: typeof this.#bridge.openPdfViewers === "function",
      bridgeKeys: Object.keys(this.#bridge || {})
    });

    try {
      const result = await new Promise((resolve, reject) => {
        try {
          if (typeof this.#bridge.openPdfViewersEx === "function") {
            this.#logger.info("[QWC步骤3] 调用 openPdfViewersEx", { payload });
            const ret = this.#bridge.openPdfViewersEx(payload);
            this.#logger.info("[QWC步骤4] openPdfViewersEx 返回", { result: ret });
            resolve(ret);
          } else if (Array.isArray(payload?.pdfIds)) {
            this.#logger.warn("[QWC步骤3] openPdfViewersEx 不存在，回退到 openPdfViewers");
            const ret = this.#bridge.openPdfViewers(payload.pdfIds);
            this.#logger.info("[QWC步骤4] openPdfViewers 返回", { result: ret });
            resolve(ret);
          } else {
            notifyDomainError({
              message: "❌ 无可用的PyQt方法",
              logger: this.#logger,
              scope: "pdf-home:qwebchannel:openPdfViewersWithMeta:no-method",
              error: { payload }
            });
            this.#logger.error("[QWC] 无可用方法", { payload });
            resolve({ success: false, error: "无可用的PyQt方法" });
          }
        } catch (error) {
          notifyDomainError({
            message: `❌ PyQt 调用异常: ${error.message}`,
            logger: this.#logger,
            scope: "pdf-home:qwebchannel:openPdfViewersWithMeta:invoke",
            error
          });
          this.#logger.error("[QWC] PyQt 调用失败", error);
          reject(error);
        }
      });

      // 处理返回值：支持旧的 bool 类型和新的 dict 类型
      let success = false;
      let errorInfo = null;

      if (typeof result === "object" && result !== null) {
        // 新格式：{ success: bool, error?: string, traceback?: string, ... }
        success = result.success === true;
        if (!success && result.error) {
          errorInfo = {
            message: result.error,
            traceback: result.traceback,
            step: result.step,
            pdf_id: result.pdf_id
          };
        }
      } else {
        // 旧格式：bool
        success = !!result;
      }

      if (success) {
        // 最终成功阶段 toast（保留）
        if (typeof result === "object" && result.opened_count !== undefined) {
          showSuccess(`✅ 成功打开 ${result.opened_count}/${result.total_count} 个PDF窗口`, 3000);
          this.#logger.info("[QWC步骤5] openPdfViewersWithMeta 完成", { result });
        } else {
          showSuccess("✅ PDF窗口已打开", 3000);
          this.#logger.info("[QWC步骤5] openPdfViewersWithMeta 完成", { success });
        }
      } else {
        // 最终失败阶段 toast（保留）
        if (errorInfo) {
          const errorMsg = errorInfo.message || "未知错误";
          const step = errorInfo.step || "unknown";
          const pdfId = errorInfo.pdf_id || "";

          notifyDomainError({
            message: `❌ ${errorMsg}`,
            logger: this.#logger,
            scope: "pdf-home:qwebchannel:openPdfViewersWithMeta:result-error",
            error: errorInfo
          });
          this.#logger.error("[QWC] PyQt 返回错误", errorInfo);

          // 如果有堆栈跟踪，在控制台输出详细信息
          if (errorInfo.traceback) {
            this.#logger.error("[QWC] PyQt 堆栈跟踪:", errorInfo.traceback);
            this.#logger.error("PyQt 后端错误详情：");
            this.#logger.error(`  步骤: ${step}`);
            if (pdfId) {this.#logger.error(`  PDF ID: ${pdfId}`);}
            this.#logger.error(`  错误: ${errorMsg}`);
            this.#logger.error("  堆栈跟踪:");
            this.#logger.error(errorInfo.traceback);
          }

          // 显示建议性的 toast
          if (step === "load_module") {
            this.#logger.warn("⚠️ 无法加载 pdf-viewer 模块，请检查项目结构", { toast: { type: "warn", ms: 4000 } });
          } else if (step === "qapp_check") {
            this.#logger.warn("⚠️ QApplication 未初始化，请检查 PyQt 环境", { toast: { type: "warn", ms: 4000 } });
          } else if (step === "create_window") {
            this.#logger.warn(`⚠️ 创建窗口失败 (PDF: ${pdfId})`, { toast: { type: "warn", ms: 4000 } });
          } else if (step === "show_window") {
            this.#logger.warn(`⚠️ 显示窗口失败 (PDF: ${pdfId})`, { toast: { type: "warn", ms: 4000 } });
          }
        } else {
          notifyDomainError({
            message: "❌ PyQt 返回失败",
            logger: this.#logger,
            scope: "pdf-home:qwebchannel:openPdfViewersWithMeta:false"
          });
          this.#logger.warn("[QWC] openPdfViewersWithMeta 返回 false");
        }
      }

      return success;
    } catch (e) {
      notifyDomainError({
        message: `❌ 打开失败: ${e.message}`,
        logger: this.#logger,
        scope: "pdf-home:qwebchannel:openPdfViewersWithMeta:exception",
        error: e
      });
      this.#logger.error("[阅读] openPdfViewersWithMeta 失败:", e);
      throw e;
    }
  }
}
