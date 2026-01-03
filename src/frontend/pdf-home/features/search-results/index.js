/**
 * SearchResults Feature - 搜索结果展示功能
 * 显示和管理PDF搜索结果列表
 * 详细说明：docs/standards/pdf-home-search-results.md
 */

import { ResultsRenderer } from "./components/results-renderer.js";
import "./styles/search-results.css";
import { createSubscriptionBag } from "../../../common/event/subscription-bag.js";
import { createSearchResultsLayoutController } from "./search-results-layout.js";
import { createSearchResultsResultsUpdater } from "./search-results-results-update.js";
import { installSearchResultsSubscriptions } from "./search-results-subscriptions.js";
import { ensureSearchResultsHeaderActions } from "./search-results-header-actions.js";
import { installSearchResultsEventBridge } from "./search-results-event-bridge.js";

export class SearchResultsFeature {
  name = "search-results";
  version = "1.0.0";
  dependencies = [];
  // 测试可注入：桥接工厂（生产为 null => new QWebChannelBridge）
  static bridgeFactory = null;
  static setBridgeFactory(factory) { SearchResultsFeature.bridgeFactory = factory; }

  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #subscriptionBag = null;

  // 渲染器
  #resultsRenderer = null;
  #resultsContainer = null;
  #headerElement = null;
  #qwcBridge = null;
  #layoutController = null;
  #resultsUpdater = null;

  // 当前结果
  #currentResults = [];
  #pendingFocusIds = null;

  #layoutPreferenceKey = ["pdf-home","search-results","layout"].join("/");

  // 内部请求超时时间
  #requestTimeoutMs = 3000;
  // 是否允许当缺少 file_path 时通过 WS 向后端补全（默认关闭，遵循隔离优先）
  #allowWsDetailFallback = false;
  // 最近一次搜索请求的分页限制（兜底用）
  #lastRequestedPageLimit = null;

  /**
   * 安装Feature
   */
  async install(context) {
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;
    // 生成一次性订阅者ID前缀（避免跨多次安装冲突）
    const sidBase = `sr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;

    this.#subscriptionBag = createSubscriptionBag({ loggerName: "SearchResultsFeature.Subscriptions" });
    this.#layoutController = createSearchResultsLayoutController({
      logger: this.#logger,
      preferenceKey: this.#layoutPreferenceKey,
      getResultsContainer: () => this.#resultsContainer,
    });

    this.#logger.info("[SearchResultsFeature] Installing...");

    try {
      // 1. 创建结果容器
      this.#createResultsContainer();
      this.#logger.info("[SearchResultsFeature] Step1: Container created");

      // 2. 初始化渲染器
      this.#resultsRenderer = new ResultsRenderer(this.#logger, this.#scopedEventBus);
      this.#logger.info("[SearchResultsFeature] Step2: Renderer constructed");

      this.#resultsUpdater = createSearchResultsResultsUpdater({
        logger: this.#logger,
        resultsRenderer: this.#resultsRenderer,
        getResultsContainer: () => this.#resultsContainer,
        getHeaderElement: () => this.#headerElement,
        getLastRequestedPageLimit: () => this.#lastRequestedPageLimit,
        getPendingFocusIds: () => this.#pendingFocusIds,
        setPendingFocusIds: (v) => { this.#pendingFocusIds = v; },
        setCurrentResults: (v) => { this.#currentResults = v; },
        getCurrentResults: () => this.#currentResults,
      });

      // 2.1 移除 QWebChannel 作为强依赖；改为通过 WebSocket 向 msgCenter 发送“打开查看器”请求
      // 如需兼容旧版桥接，可在测试工厂中注入 bridge，但生产默认不再依赖 QWebChannel。
      try {
        if (SearchResultsFeature.bridgeFactory) {
          this.#qwcBridge = SearchResultsFeature.bridgeFactory();
          await this.#qwcBridge?.initialize?.();
          this.#logger.info("[SearchResultsFeature] QWebChannelBridge（可选）已初始化");
        }
      } catch (e) {
        this.#logger.warn("[SearchResultsFeature] QWebChannelBridge 初始化（可选）失败，忽略", e);
      }

      // 3. 监听筛选结果更新事件（来自filter插件）
      installSearchResultsSubscriptions({
        logger: this.#logger,
        name: this.name,
        sidBase,
        globalEventBus: this.#globalEventBus,
        subscriptionBag: this.#subscriptionBag,
        setLastRequestedPageLimit: (v) => { this.#lastRequestedPageLimit = v; },
        setPendingFocusIds: (v) => { this.#pendingFocusIds = v; },
        applyPendingFocus: () => this.#resultsUpdater.applyPendingFocus(),
        handleResultsUpdate: (payload) => this.#resultsUpdater.handleResultsUpdate(payload),
      });
      this.#logger.info("[SearchResultsFeature] Step3: Subscribed to filter events");

      // 4. 监听条目事件（转发到全局）
      installSearchResultsEventBridge({
        logger: this.#logger,
        name: this.name,
        sidBase,
        scopedEventBus: this.#scopedEventBus,
        globalEventBus: this.#globalEventBus,
        subscriptionBag: this.#subscriptionBag,
        qwcBridge: this.#qwcBridge,
        allowWsDetailFallback: this.#allowWsDetailFallback,
        requestTimeoutMs: this.#requestTimeoutMs,
      });
      this.#logger.info("[SearchResultsFeature] Step4: Event bridge set up");

      // 5. 渲染初始空状态
      this.#resultsRenderer.render(this.#resultsContainer, []);
      this.#logger.info("[SearchResultsFeature] Step5: Initial render completed");

      this.#logger.info("[SearchResultsFeature] Installed successfully");
    } catch (error) {
      this.#logger.error("[SearchResultsFeature] Installation failed", error);
      throw error;
    }
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info("[SearchResultsFeature] Uninstalling...");

    // 取消事件订阅
    if (this.#subscriptionBag) {
      this.#subscriptionBag.clear();
      this.#subscriptionBag = null;
    }

    // 销毁渲染器
    if (this.#resultsRenderer) {
      this.#resultsRenderer.destroy();
      this.#resultsRenderer = null;
    }

    this.#resultsUpdater = null;

    // 移除DOM
    if (this.#resultsContainer) {
      this.#resultsContainer.remove();
      this.#resultsContainer = null;
    }

    this.#layoutController = null;

    this.#logger.info("[SearchResultsFeature] Uninstalled");
  }

  /**
   * 创建结果容器
   * @private
   */
  #createResultsContainer() {
    // 查找现有容器
    const mainContent = document.querySelector(".main-content");
    if (!mainContent) {
      throw new Error("Main content container not found");
    }

    // 获取或创建header
    this.#headerElement = mainContent.querySelector(".search-results-header");
    if (!this.#headerElement) {
      throw new Error("Search results header not found in index.html");
    }

    // 在header中添加批量操作按钮
    ensureSearchResultsHeaderActions({
      logger: this.#logger,
      headerElement: this.#headerElement,
      layoutController: this.#layoutController,
      getCurrentResults: () => this.#currentResults,
      globalEventBus: this.#globalEventBus,
      scopedEventBus: this.#scopedEventBus,
      documentRef: document,
    });

    // 获取或创建结果容器
    this.#resultsContainer = mainContent.querySelector("#pdf-table-container");
    if (!this.#resultsContainer) {
      // 创建新容器（如果index.html中没有）
      this.#resultsContainer = document.createElement("div");
      this.#resultsContainer.id = "pdf-table-container";
      this.#headerElement.insertAdjacentElement("afterend", this.#resultsContainer);
    }

    this.#resultsContainer.classList.add("search-results-container");

    this.#logger.debug("[SearchResultsFeature] Results container created");

    this.#layoutController.restoreLayoutPreference();
  }
}

export default SearchResultsFeature;
