/**
 * @file QWebChannel 桥接封装
 * @module QWebChannelBridge
 * @description 封装 QWebChannel 连接逻辑，提供 Promise 风格的 API
 */

import { getLogger } from "../../common/utils/logger.js";

/**
 * QWebChannel 桥接类
 *
 * 封装与 PyQt 后端的通信，提供简洁的 Promise API。
 *
 * @class QWebChannelBridge
 */
export class QWebChannelBridge {
    #logger;
    #bridge = null;
    #isReady = false;
    #initPromise = null;

    constructor() {
        this.#logger = getLogger("QWebChannelBridge");
        this.#logger.info("QWebChannelBridge 实例创建");
    }

    /**
     * 初始化 QWebChannel 连接
     *
     * 等待 Qt WebChannel 传输层准备就绪，然后建立连接。
     * 可以多次调用，但只会初始化一次。
     *
     * @returns {Promise<void>}
     */
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

        this.#initPromise = new Promise((resolve, reject) => {
            // 检查 QWebChannel 是否可用
            if (typeof QWebChannel === 'undefined') {
                const error = 'QWebChannel 未定义，请确保 qwebchannel.js 已加载';
                this.#logger.error(error);
                reject(new Error(error));
                return;
            }

            // 检查 Qt WebChannel 传输层是否可用
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
                        this.#connectToChannel(resolve, reject);
                    } else if (elapsedTime >= maxWaitTime) {
                        clearInterval(checkTransport);
                        const error = 'Qt WebChannel 传输层超时未就绪';
                        this.#logger.error(error);
                        reject(new Error(error));
                    }
                }, checkInterval);

                return;
            }

            // 传输层已就绪，直接连接
            this.#connectToChannel(resolve, reject);
        });

        return this.#initPromise;
    }

    /**
     * 连接到 QWebChannel
     * @param {Function} resolve - Promise resolve 函数
     * @param {Function} reject - Promise reject 函数
     * @private
     */
    #connectToChannel(resolve, reject) {
        try {
            this.#logger.info("正在连接 QWebChannel...");

            new QWebChannel(window.qt.webChannelTransport, (channel) => {
                this.#logger.info("QWebChannel 连接成功");

                // 获取 pyqtBridge 对象
                if (!channel.objects.pyqtBridge) {
                    const error = 'pyqtBridge 对象未注册';
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

    /**
     * 检查 QWebChannel 是否已初始化
     * @returns {boolean}
     */
    isReady() {
        return this.#isReady;
    }

    /**
     * 测试连接
     *
     * 调用 PyQt 端的 testConnection 方法，验证通信是否正常。
     *
     * @returns {Promise<string>} 测试消息
     * @throws {Error} 如果 QWebChannel 未初始化
     */
    async testConnection() {
        this.#logger.info("调用 testConnection");

        if (!this.#isReady) {
            throw new Error('QWebChannel 未初始化，请先调用 initialize()');
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

    /**
     * 选择文件
     *
     * 调用 PyQt 原生文件选择对话框，让用户选择文件。
     *
     * @param {Object} options - 选项
     * @param {boolean} options.multiple - 是否允许多选，默认 true
     * @param {string} options.fileType - 文件类型，'pdf' 或 'all'，默认 'pdf'
     * @returns {Promise<string[]>} 文件路径数组
     * @throws {Error} 如果 QWebChannel 未初始化
     *
     * @example
     * const files = await bridge.selectFiles({ multiple: true, fileType: 'pdf' });
     * // 返回: ['C:/path/file1.pdf', 'C:/path/file2.pdf']
     */
    async selectFiles(options = {}) {
        const { multiple = true, fileType = 'pdf' } = options;

        this.#logger.info(`[阶段2] 调用 selectFiles: multiple=${multiple}, fileType=${fileType}`);

        if (!this.#isReady) {
            throw new Error('QWebChannel 未初始化，请先调用 initialize()');
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
                this.#logger.info('[阶段2] 用户取消了文件选择或未选择文件');
                return [];
            }

            this.#logger.info(`[阶段2] 收到 ${files.length} 个文件路径:`);
            files.forEach((file, i) => {
                this.#logger.info(`[阶段2]   文件${i + 1}: ${file}`);
            });

            return files;

        } catch (error) {
            this.#logger.error('[阶段2] selectFiles 失败:', error);
            throw error;
        }
    }

    /**
     * 显示确认对话框
     *
     * 调用 PyQt 原生确认对话框，让用户确认操作。
     *
     * @param {string} title - 对话框标题
     * @param {string} message - 提示消息
     * @returns {Promise<boolean>} 用户是否确认 (true=确认, false=取消)
     * @throws {Error} 如果 QWebChannel 未初始化
     *
     * @example
     * const confirmed = await bridge.showConfirmDialog('确认删除', '确定要删除此文件吗？');
     * if (confirmed) {
     *     // 执行删除操作
     * }
     */
    async showConfirmDialog(title, message) {
        this.#logger.info(`[删除-阶段1] 调用 showConfirmDialog: title="${title}"`);
        this.#logger.info(`[删除-阶段1] 消息: ${message}`);

        if (!this.#isReady) {
            throw new Error('QWebChannel 未初始化，请先调用 initialize()');
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

            this.#logger.info(`[删除-阶段1] 用户选择: ${confirmed ? '确认' : '取消'}`);
            return confirmed;

        } catch (error) {
            this.#logger.error('[删除-阶段1] showConfirmDialog 失败:', error);
            throw error;
        }
    }

    /**
     * 获取桥接对象（用于调试）
     * @returns {Object|null} PyQt 桥接对象
     */
    getBridge() {
        return this.#bridge;
    }

    /**
     * 批量打开 pdf-viewer 窗口（通过 PyQt 桥接，不使用外部 launcher）。
     * @param {{ pdfIds: string[] }} options
     * @returns {Promise<boolean>} 是否成功触发打开动作
     */
    async openPdfViewers(options = {}) {
        const { pdfIds = [], items = null } = options;
        this.#logger.info(`[阅读] 调用 openPdfViewers, 选中数量=${pdfIds.length}${items ? `, items=${items.length}` : ''}`);

        if (!this.#isReady) {
            throw new Error('QWebChannel 未初始化，请先调用 initialize()');
        }

        try {
            const ok = await new Promise((resolve, reject) => {
                try {
                    if (items && typeof this.#bridge.openPdfViewersEx === 'function') {
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
            this.#logger.error('[阅读] openPdfViewers 失败:', error);
            throw error;
        }
    }

    /**
     * 兼容方法：携带元信息的打开（优先调用 PyQt 的 openPdfViewersEx）
     * @param {{ pdfIds?: string[], items: Array<{ id?: string, filename?: string, file_path?: string }> }} payload
     * @returns {Promise<boolean>}
     */
    async openPdfViewersWithMeta(payload) {
        if (!this.#isReady) {
            throw new Error('QWebChannel 未初始化，请先调用 initialize()');
        }
        try {
            const ok = await new Promise((resolve, reject) => {
                try {
                    if (typeof this.#bridge.openPdfViewersEx === 'function') {
                        const result = this.#bridge.openPdfViewersEx(payload);
                        resolve(!!result);
                    } else if (Array.isArray(payload?.pdfIds)) {
                        const result = this.#bridge.openPdfViewers(payload.pdfIds);
                        resolve(!!result);
                    } else {
                        resolve(false);
                    }
                } catch (error) {
                    reject(error);
                }
            });
            return !!ok;
        } catch (e) {
            this.#logger.error('[阅读] openPdfViewersWithMeta 失败:', e);
            throw e;
        }
    }
}
