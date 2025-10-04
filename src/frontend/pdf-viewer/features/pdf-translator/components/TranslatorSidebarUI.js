/**
 * 翻译侧边栏UI组件
 * @file 渲染翻译侧边栏界面，显示翻译结果和历史记录
 * @module TranslatorSidebarUI
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { PDF_TRANSLATOR_EVENTS } from '../events.js';

/**
 * 翻译侧边栏UI类
 * @class TranslatorSidebarUI
 */
export class TranslatorSidebarUI {
  #eventBus;
  #logger;
  #contentElement;
  #currentTranslation = null;
  #translationHistory = [];
  #unsubs = [];

  /**
   * 构造函数
   * @param {EventBus} eventBus - 事件总线
   * @param {Object} options - 配置选项
   */
  constructor(eventBus, options = {}) {
    this.#eventBus = eventBus;
    this.#logger = getLogger('TranslatorSidebarUI');
    this.#contentElement = null;
  }

  /**
   * 初始化侧边栏
   */
  initialize() {
    this.#logger.info('Initializing TranslatorSidebarUI...');

    // 创建内容容器
    this.#contentElement = document.createElement('div');
    this.#contentElement.className = 'translator-sidebar-content';
    this.#contentElement.style.cssText = `
      height: 100%;
      overflow-y: auto;
      padding: 16px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    // 渲染初始UI
    this.#renderUI();

    // 监听翻译完成事件
    this.#setupEventListeners();

    this.#logger.info('TranslatorSidebarUI initialized');
  }

  /**
   * 获取内容元素（供SidebarManager使用）
   * @returns {HTMLElement} 内容元素
   */
  getContentElement() {
    return this.#contentElement;
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 监听翻译完成事件
    this.#unsubs.push(
      this.#eventBus.on(
        PDF_TRANSLATOR_EVENTS.TRANSLATE.COMPLETED,
        (data) => this.#handleTranslationCompleted(data),
        { subscriberId: 'TranslatorSidebarUI' }
      )
    );

    // 监听翻译失败事件
    this.#unsubs.push(
      this.#eventBus.on(
        PDF_TRANSLATOR_EVENTS.TRANSLATE.FAILED,
        (data) => this.#handleTranslationFailed(data),
        { subscriberId: 'TranslatorSidebarUI' }
      )
    );
  }

  /**
   * 渲染UI
   * @private
   */
  #renderUI() {
    if (!this.#contentElement) return;

    this.#contentElement.innerHTML = '';

    // 设置栏（翻译引擎选择）
    const settingsSection = this.#createSettingsSection();
    this.#contentElement.appendChild(settingsSection);

    // 实时翻译区
    const translationSection = this.#createTranslationSection();
    this.#contentElement.appendChild(translationSection);

    // 翻译历史
    const historySection = this.#createHistorySection();
    this.#contentElement.appendChild(historySection);
  }

  /**
   * 创建设置区域
   * @private
   * @returns {HTMLElement}
   */
  #createSettingsSection() {
    const section = document.createElement('div');
    section.className = 'translator-settings';
    section.style.cssText = `
      margin-bottom: 16px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 6px;
    `;

    const label = document.createElement('label');
    label.style.cssText = `
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 6px;
      font-weight: 500;
    `;
    label.textContent = '翻译引擎';

    const select = document.createElement('select');
    select.style.cssText = `
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
      background: white;
      cursor: pointer;
    `;
    select.innerHTML = `
      <option value="deepl">DeepL (推荐)</option>
      <option value="google">Google Translate</option>
      <option value="local" disabled>本地词典 (即将支持)</option>
    `;

    select.addEventListener('change', (e) => {
      this.#eventBus.emit(PDF_TRANSLATOR_EVENTS.ENGINE.CHANGED, {
        engine: e.target.value
      });
      this.#logger.info(`Translation engine changed to: ${e.target.value}`);
    });

    section.appendChild(label);
    section.appendChild(select);

    return section;
  }

  /**
   * 创建翻译结果区域
   * @private
   * @returns {HTMLElement}
   */
  #createTranslationSection() {
    const section = document.createElement('div');
    section.className = 'translator-result';
    section.id = 'translator-result-section';
    section.style.cssText = `
      margin-bottom: 20px;
      padding: 16px;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      min-height: 200px;
    `;

    if (this.#currentTranslation) {
      section.innerHTML = this.#renderTranslationResult(this.#currentTranslation);
    } else {
      section.innerHTML = `
        <div style="text-align: center; color: #999; padding: 40px 20px;">
          <div style="font-size: 48px; margin-bottom: 12px;">🌐</div>
          <div style="font-size: 14px;">选中文本即可自动翻译</div>
          <div style="font-size: 12px; margin-top: 8px; color: #bbb;">
            最少选中 3 个字符
          </div>
        </div>
      `;
    }

    return section;
  }

  /**
   * 渲染翻译结果
   * @private
   * @param {Object} translation - 翻译数据
   * @returns {string} HTML字符串
   */
  #renderTranslationResult(translation) {
    return `
      <div class="translation-content">
        <!-- 原文 -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; color: #666; margin-bottom: 6px; font-weight: 500;">
            原文
          </div>
          <div style="
            padding: 12px;
            background: #f9f9f9;
            border-left: 3px solid #2196F3;
            font-size: 14px;
            line-height: 1.6;
            word-break: break-word;
          ">
            ${this.#escapeHtml(translation.original)}
          </div>
        </div>

        <!-- 译文 -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; color: #666; margin-bottom: 6px; font-weight: 500;">
            译文
          </div>
          <div style="
            padding: 12px;
            background: #f0f7ff;
            border-left: 3px solid #4CAF50;
            font-size: 14px;
            line-height: 1.6;
            word-break: break-word;
          ">
            ${this.#escapeHtml(translation.translation)}
          </div>
        </div>

        <!-- 操作按钮 -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button
            class="translator-action-btn translator-create-annotation-btn"
            style="
              flex: 1;
              min-width: 100px;
              padding: 8px 16px;
              background: #9C27B0;
              color: white;
              border: none;
              border-radius: 4px;
              font-size: 13px;
              cursor: pointer;
              transition: background 0.2s;
            "
            onmouseover="this.style.background='#7B1FA2'"
            onmouseout="this.style.background='#9C27B0'"
          >
            📌 制作标注
          </button>
          <button
            class="translator-action-btn translator-create-card-btn"
            style="
              flex: 1;
              min-width: 100px;
              padding: 8px 16px;
              background: #2196F3;
              color: white;
              border: none;
              border-radius: 4px;
              font-size: 13px;
              cursor: pointer;
              transition: background 0.2s;
            "
            onmouseover="this.style.background='#1976D2'"
            onmouseout="this.style.background='#2196F3'"
          >
            📇 制作卡片
          </button>
          <button
            class="translator-action-btn translator-copy-btn"
            style="
              flex: 1;
              min-width: 100px;
              padding: 8px 16px;
              background: #4CAF50;
              color: white;
              border: none;
              border-radius: 4px;
              font-size: 13px;
              cursor: pointer;
              transition: background 0.2s;
            "
            onmouseover="this.style.background='#388E3C'"
            onmouseout="this.style.background='#4CAF50'"
          >
            📋 复制译文
          </button>
          <button
            class="translator-action-btn translator-speak-btn"
            style="
              padding: 8px 16px;
              background: #FF9800;
              color: white;
              border: none;
              border-radius: 4px;
              font-size: 13px;
              cursor: pointer;
              transition: background 0.2s;
            "
            onmouseover="this.style.background='#F57C00'"
            onmouseout="this.style.background='#FF9800'"
          >
            🔊 朗读
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 创建历史记录区域
   * @private
   * @returns {HTMLElement}
   */
  #createHistorySection() {
    const section = document.createElement('div');
    section.className = 'translator-history';
    section.style.cssText = `
      margin-bottom: 16px;
    `;

    // 标题栏（可折叠）
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      cursor: pointer;
      user-select: none;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 14px;
      font-weight: 500;
      color: #333;
    `;
    title.textContent = `📚 翻译历史 (${this.#translationHistory.length})`;

    const toggleIcon = document.createElement('span');
    toggleIcon.textContent = '▾';
    toggleIcon.style.cssText = `
      font-size: 12px;
      color: #666;
    `;

    header.appendChild(title);
    header.appendChild(toggleIcon);

    // 历史列表容器
    const listContainer = document.createElement('div');
    listContainer.className = 'translator-history-list';
    listContainer.style.cssText = `
      max-height: 300px;
      overflow-y: auto;
      margin-top: 8px;
    `;

    if (this.#translationHistory.length === 0) {
      listContainer.innerHTML = `
        <div style="
          text-align: center;
          color: #999;
          font-size: 13px;
          padding: 20px;
        ">
          暂无翻译历史
        </div>
      `;
    } else {
      listContainer.innerHTML = this.#translationHistory
        .map((item, index) => this.#renderHistoryItem(item, index))
        .join('');
    }

    // 折叠/展开功能
    header.addEventListener('click', () => {
      const isHidden = listContainer.style.display === 'none';
      listContainer.style.display = isHidden ? 'block' : 'none';
      toggleIcon.textContent = isHidden ? '▾' : '▸';
    });

    section.appendChild(header);
    section.appendChild(listContainer);

    return section;
  }

  /**
   * 渲染历史记录项
   * @private
   * @param {Object} item - 历史记录项
   * @param {number} index - 索引
   * @returns {string} HTML字符串
   */
  #renderHistoryItem(item, index) {
    return `
      <div
        class="history-item"
        style="
          padding: 10px;
          margin-bottom: 8px;
          background: #f9f9f9;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        "
        onmouseover="this.style.background='#f0f0f0'"
        onmouseout="this.style.background='#f9f9f9'"
        data-index="${index}"
      >
        <div style="
          font-size: 13px;
          color: #333;
          margin-bottom: 4px;
          font-weight: 500;
        ">
          ${this.#escapeHtml(item.original.substring(0, 30))}${item.original.length > 30 ? '...' : ''}
        </div>
        <div style="
          font-size: 12px;
          color: #666;
        ">
          ${this.#escapeHtml(item.translation.substring(0, 40))}${item.translation.length > 40 ? '...' : ''}
        </div>
        <div style="
          font-size: 11px;
          color: #999;
          margin-top: 4px;
        ">
          ${new Date(item.timestamp).toLocaleTimeString('zh-CN')}
        </div>
      </div>
    `;
  }

  /**
   * 处理翻译完成事件
   * @private
   * @param {Object} data - 翻译数据
   */
  #handleTranslationCompleted(data) {
    this.#logger.info('Translation completed:', data);

    // 保存当前翻译结果
    this.#currentTranslation = data;

    // 添加到历史记录
    this.#translationHistory.unshift({
      ...data,
      timestamp: Date.now()
    });

    // 限制历史记录数量（最多保留50条）
    if (this.#translationHistory.length > 50) {
      this.#translationHistory = this.#translationHistory.slice(0, 50);
    }

    // 重新渲染UI
    this.#renderUI();

    // 绑定按钮事件（在DOM更新后）
    setTimeout(() => {
      this.#bindActionButtons();
      this.#bindHistoryItemClick();
    }, 0);
  }

  /**
   * 处理翻译失败事件
   * @private
   * @param {Object} data - 错误数据
   */
  #handleTranslationFailed(data) {
    this.#logger.error('Translation failed:', data);

    const resultSection = this.#contentElement?.querySelector('#translator-result-section');
    if (resultSection) {
      resultSection.innerHTML = `
        <div style="text-align: center; color: #f44336; padding: 40px 20px;">
          <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
          <div style="font-size: 14px; font-weight: 500;">翻译失败</div>
          <div style="font-size: 12px; margin-top: 8px; color: #999;">
            ${this.#escapeHtml(data.error || '未知错误')}
          </div>
        </div>
      `;
    }
  }

  /**
   * 绑定操作按钮事件
   * @private
   */
  #bindActionButtons() {
    // 制作标注按钮
    const createAnnotationBtn = this.#contentElement?.querySelector('.translator-create-annotation-btn');
    if (createAnnotationBtn && this.#currentTranslation) {
      createAnnotationBtn.addEventListener('click', () => {
        this.#handleCreateAnnotation(this.#currentTranslation);
      });
    }

    // 制作卡片按钮
    const createCardBtn = this.#contentElement?.querySelector('.translator-create-card-btn');
    if (createCardBtn && this.#currentTranslation) {
      createCardBtn.addEventListener('click', () => {
        this.#handleCreateCard(this.#currentTranslation);
      });
    }

    // 复制译文按钮
    const copyBtn = this.#contentElement?.querySelector('.translator-copy-btn');
    if (copyBtn && this.#currentTranslation) {
      copyBtn.addEventListener('click', () => {
        this.#handleCopyTranslation(this.#currentTranslation.translation);
      });
    }

    // 朗读按钮
    const speakBtn = this.#contentElement?.querySelector('.translator-speak-btn');
    if (speakBtn && this.#currentTranslation) {
      speakBtn.addEventListener('click', () => {
        this.#handleSpeak(this.#currentTranslation.original);
      });
    }
  }

  /**
   * 绑定历史记录点击事件
   * @private
   */
  #bindHistoryItemClick() {
    const historyItems = this.#contentElement?.querySelectorAll('.history-item');
    historyItems?.forEach(item => {
      item.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        const historyItem = this.#translationHistory[index];
        if (historyItem) {
          this.#currentTranslation = historyItem;
          this.#renderUI();
          setTimeout(() => {
            this.#bindActionButtons();
            this.#bindHistoryItemClick();
          }, 0);
        }
      });
    });
  }

  /**
   * 处理制作标注
   * @private
   * @param {Object} translation - 翻译数据
   */
  #handleCreateAnnotation(translation) {
    this.#logger.info('Creating annotation from translation...');

    // 验证是否有位置信息和Range数据
    if (!translation.pageNumber || !translation.position) {
      this.#showToast('无法创建标注：缺少位置信息', 'error');
      this.#logger.warn('Cannot create annotation: missing pageNumber or position', translation);
      return;
    }

    if (!translation.rangeData || translation.rangeData.length === 0) {
      this.#showToast('无法创建标注：缺少文本选择数据', 'error');
      this.#logger.warn('Cannot create annotation: missing rangeData', translation);
      return;
    }

    // 构建标注内容（原文+译文）
    const annotationContent = `📝 原文:\n${translation.original}\n\n✅ 译文:\n${translation.translation}`;

    // 创建文本高亮类型的标注（带评论）
    const annotationData = {
      type: 'text-highlight',  // 文本高亮类型
      pageNumber: translation.pageNumber,
      data: {
        selectedText: translation.original,  // 原始选中的文本
        highlightColor: 'yellow',  // 高亮颜色
        textRanges: translation.rangeData,  // Range数据（序列化后的）
        boundingBox: translation.position,  // 边界框
        comment: annotationContent  // 添加评论（包含原文和译文）
      }
    };

    this.#logger.info('Annotation data prepared:', annotationData);

    // 发出创建标注事件（全局事件，供AnnotationFeature监听）
    this.#eventBus.emit('annotation:create:requested', {
      annotation: annotationData
    }, { actorId: 'TranslatorSidebarUI' });

    // 显示成功提示
    this.#showToast('✅ 标注已创建');
    this.#logger.info('Annotation creation requested');
  }

  /**
   * 处理制作卡片
   * @private
   * @param {Object} translation - 翻译数据
   */
  #handleCreateCard(translation) {
    this.#logger.info('Creating card from translation...');

    // 发送全局事件到卡片功能域
    this.#eventBus.emitGlobal(PDF_TRANSLATOR_EVENTS.CARD.CREATE_REQUESTED, {
      cardData: {
        front: translation.original,
        back: translation.translation,
        source: this.#buildSourceInfo(),
        tags: ['翻译', 'PDF', translation.language?.source || 'unknown'],
        extras: translation.extras || {}
      },
      source: 'translator'
    });

    // 显示成功提示（临时）
    this.#showToast('卡片创建请求已发送');
  }

  /**
   * 处理复制译文
   * @private
   * @param {string} text - 要复制的文本
   */
  #handleCopyTranslation(text) {
    navigator.clipboard.writeText(text).then(() => {
      this.#logger.info('Translation copied to clipboard');
      this.#showToast('译文已复制到剪贴板');
    }).catch(err => {
      this.#logger.error('Failed to copy translation:', err);
      this.#showToast('复制失败', 'error');
    });
  }

  /**
   * 处理朗读
   * @private
   * @param {string} text - 要朗读的文本
   */
  #handleSpeak(text) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US'; // 可以根据语言自动检测
      window.speechSynthesis.speak(utterance);
      this.#logger.info('Speaking text:', text);
    } else {
      this.#logger.warn('Speech synthesis not supported');
      this.#showToast('浏览器不支持语音朗读', 'error');
    }
  }

  /**
   * 构建来源信息
   * @private
   * @returns {string}
   */
  #buildSourceInfo() {
    const fileName = window.PDF_PATH?.split('/').pop() || 'Unknown';
    // TODO: 获取当前页码
    const pageNumber = 1;
    return `${fileName} - 第${pageNumber}页`;
  }

  /**
   * 显示提示消息
   * @private
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型 (success|error)
   */
  #showToast(message, type = 'success') {
    // 简单的toast实现（后续可以替换为更好的UI组件）
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#4CAF50' : '#f44336'};
      color: white;
      border-radius: 4px;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 2000);
  }

  /**
   * 转义HTML
   * @private
   * @param {string} text - 要转义的文本
   * @returns {string} 转义后的文本
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 销毁组件
   */
  destroy() {
    this.#logger.info('Destroying TranslatorSidebarUI...');

    // 取消所有事件订阅
    this.#unsubs.forEach(unsub => {
      try {
        unsub();
      } catch (err) {
        this.#logger.warn('Failed to unsubscribe:', err);
      }
    });
    this.#unsubs = [];

    // 移除DOM元素
    if (this.#contentElement && this.#contentElement.parentNode) {
      this.#contentElement.parentNode.removeChild(this.#contentElement);
    }

    this.#contentElement = null;
    this.#currentTranslation = null;
    this.#translationHistory = [];

    this.#logger.info('TranslatorSidebarUI destroyed');
  }
}
