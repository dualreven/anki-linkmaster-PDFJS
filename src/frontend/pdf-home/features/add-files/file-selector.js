/**
 * @file FileSelector 抽象与 E2E 注入实现
 * @description
 * - 生产：通过 QWebChannel 触发 PyQt 的 QFileDialog
 * - 测试（E2E）：仅在显式开启时启用，从 window.__E2E_TEST_FILES__ 读取返回值
 * - 严格：未显式开启测试模式时绝不回退到 Stub；缺失 QWebChannel 时直接报错（Fail-Fast）
 */

import { getLogger } from "../../../common/utils/logger.js";

/**
 * 判断是否处于 E2E 文件选择测试模式
 * 显式条件（任一满足）：
 * - URL 参数 e2e=1 或 fileSelector=e2e
 * - window.__E2E_FILE_SELECTOR__ === true
 * - 存在 window.__E2E_TEST_FILES__ 且为数组
 */
function isE2ETestMode() {
  try {
    const url = new URL(String(window.location));
    const e2e = url.searchParams.get("e2e");
    const fs = url.searchParams.get("fileSelector");
    if (e2e === "1" || String(fs).toLowerCase() === "e2e") {
      return true;
    }
  } catch (e) {
    // logger-guard
    void e;
  }
  try {
    if (window.__E2E_FILE_SELECTOR__ === true) {return true;}
  } catch (e) {
    // logger-guard
    void e;
  }
  try {
    if (Array.isArray(window.__E2E_TEST_FILES__)) {return true;}
  } catch (e) {
    // logger-guard
    void e;
  }
  return false;
}

class QWebChannelFileSelector {
  #logger = getLogger("FileSelector/QWebChannel");
  #bridgeFactory;
  constructor(bridgeFactory) {
    this.#bridgeFactory = bridgeFactory;
  }
  async selectFiles(options = {}) {
    const bridge = await this.#bridgeFactory();
    // 直接委托给 bridge（原有语义）
    try {
      this.#logger.info("Selecting files via QWebChannel", { options });
    } catch (e) {
      // logger-guard
      void e;
    }
    return await bridge.selectFiles(options);
  }
}

class E2EStubFileSelector {
  #logger = getLogger("FileSelector/E2EStub");
  async selectFiles(_options = {}) {
    // 严格：仅从 __E2E_TEST_FILES__ 读取；缺失则抛错，禁止兜底
    const arr = (() => {
      try { return window.__E2E_TEST_FILES__; } catch (e) { void e; /* logger-guard */ return undefined; }
    })();
    if (!Array.isArray(arr) || arr.length === 0 || !arr.every(v => typeof v === "string" && v.length > 0)) {
      const err = new Error("E2EStubFileSelector: __E2E_TEST_FILES__ 缺失或无效（必须为非空字符串数组）");
      this.#logger.error(err.message);
      throw err;
    }
    this.#logger.info(`[E2E] 返回 ${arr.length} 个测试文件`);
    return arr;
  }
}

/**
 * 获取 FileSelector 实例（按环境选择）
 * @param {{ bridgeFactory: () => Promise<any>}} deps
 */
export function getFileSelector(deps = {}) {
  const logger = getLogger("FileSelector");
  if (isE2ETestMode()) {
    logger.info("检测到 E2E 文件选择测试模式，使用 E2EStubFileSelector");
    return new E2EStubFileSelector();
  }
  if (typeof deps.bridgeFactory !== "function") {
    throw new Error("getFileSelector: 缺少 bridgeFactory（生产模式必须提供）");
  }
  return new QWebChannelFileSelector(deps.bridgeFactory);
}
