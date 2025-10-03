/**
 * 高级筛选构建器UI组件
 * 提供可视化的条件构建界面
 */

import { FieldCondition } from '../services/filter-conditions.js';
import { CompositeCondition } from '../services/filter-conditions.js';

export class FilterBuilder {
  #logger = null;
  #eventBus = null;
  #filterManager = null;
  #container = null;
  #conditionsList = [];

  /**
   * 创建FilterBuilder实例
   * @param {Object} logger - 日志记录器
   * @param {Object} eventBus - 事件总线
   * @param {Object} filterManager - 筛选管理器
   */
  constructor(logger, eventBus, filterManager) {
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#filterManager = filterManager;
  }

  /**
   * 渲染到指定容器
   * @param {HTMLElement} container - 容器元素
   */
  render(container) {
    this.#container = container;
    this.#container.innerHTML = this.#getTemplate();
    this.#setupEventListeners();
    this.#logger.info('[FilterBuilder] Rendered');
  }

  /**
   * 获取HTML模板
   * @private
   */
  #getTemplate() {
    return `
      <div class="filter-builder" hidden>
        <!-- 头部 -->
        <div class="filter-builder-header">
          <h3>🎚️ 高级筛选</h3>
          <button class="btn-collapse" aria-label="收起" title="收起">▲</button>
        </div>

        <!-- 主体 -->
        <div class="filter-builder-body">
          <!-- 条件列表 -->
          <div class="conditions-builder" id="conditions-builder">
            <div class="empty-state">
              <p>暂无筛选条件</p>
              <button class="btn-add-first">添加第一个条件</button>
            </div>
          </div>

          <!-- 添加条件按钮 -->
          <div class="add-condition-row">
            <button class="btn-add-condition">+ 添加条件</button>
          </div>
        </div>

        <!-- 底部操作 -->
        <div class="filter-builder-footer">
          <div class="preview">
            <strong>预览:</strong>
            <span id="conditions-preview">无条件</span>
          </div>
          <div class="actions">
            <button class="btn-reset">重置</button>
            <button class="btn-apply">应用筛选</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 显示构建器
   */
  show() {
    const builderElement = this.#container.querySelector('.filter-builder');
    if (builderElement) {
      builderElement.hidden = false;
      this.#loadCurrentConditions();
      this.#logger.info('[FilterBuilder] Shown');
    }
  }

  /**
   * 隐藏构建器
   */
  hide() {
    const builderElement = this.#container.querySelector('.filter-builder');
    if (builderElement) {
      builderElement.hidden = true;
      this.#logger.info('[FilterBuilder] Hidden');
    }
  }

  /**
   * 添加条件行
   * @param {Object} config - 条件配置
   */
  addConditionRow(config = {}) {
    const rowId = `cond_${Date.now()}`;
    const row = {
      id: rowId,
      field: config.field || 'filename',
      operator: config.operator || 'contains',
      value: config.value || '',
      logic: config.logic || 'AND'  // 与下一个条件的逻辑关系
    };

    this.#conditionsList.push(row);
    this.#renderConditions();
    this.#updatePreview();
    this.#logger.debug('[FilterBuilder] Added condition row', row);
  }

  /**
   * 移除条件行
   * @param {string} rowId - 行ID
   */
  removeConditionRow(rowId) {
    const index = this.#conditionsList.findIndex(r => r.id === rowId);
    if (index > -1) {
      this.#conditionsList.splice(index, 1);
      this.#renderConditions();
      this.#updatePreview();
      this.#logger.debug('[FilterBuilder] Removed condition row', rowId);
    }
  }

  /**
   * 渲染条件列表
   * @private
   */
  #renderConditions() {
    const builderDiv = this.#container.querySelector('#conditions-builder');

    if (this.#conditionsList.length === 0) {
      builderDiv.innerHTML = `
        <div class="empty-state">
          <p>暂无筛选条件</p>
          <button class="btn-add-first">添加第一个条件</button>
        </div>
      `;

      // 绑定添加第一个条件按钮
      builderDiv.querySelector('.btn-add-first').addEventListener('click', () => {
        this.addConditionRow();
      });

      return;
    }

    // 渲染每个条件行
    const rowsHtml = this.#conditionsList.map((row, index) => {
      return `
        <div class="condition-row" data-id="${row.id}">
          <!-- 逻辑操作符（不显示在第一行） -->
          ${index > 0 ? `
            <div class="logic-selector">
              <select class="logic-select" data-id="${row.id}">
                <option value="AND" ${row.logic === 'AND' ? 'selected' : ''}>且 (AND)</option>
                <option value="OR" ${row.logic === 'OR' ? 'selected' : ''}>或 (OR)</option>
              </select>
            </div>
          ` : '<div class="logic-placeholder">筛选条件</div>'}

          <!-- 条件编辑器 -->
          <div class="condition-editor">
            <!-- 字段选择 -->
            <select class="field-select" data-id="${row.id}">
              <option value="filename" ${row.field === 'filename' ? 'selected' : ''}>文件名</option>
              <option value="tags" ${row.field === 'tags' ? 'selected' : ''}>标签</option>
              <option value="rating" ${row.field === 'rating' ? 'selected' : ''}>评分</option>
              <option value="review_count" ${row.field === 'review_count' ? 'selected' : ''}>复习次数</option>
              <option value="file_size" ${row.field === 'file_size' ? 'selected' : ''}>文件大小</option>
              <option value="created_at" ${row.field === 'created_at' ? 'selected' : ''}>创建时间</option>
              <option value="last_accessed_at" ${row.field === 'last_accessed_at' ? 'selected' : ''}>访问时间</option>
            </select>

            <!-- 操作符选择 -->
            <select class="operator-select" data-id="${row.id}">
              ${this.#getOperatorOptions(row.field, row.operator)}
            </select>

            <!-- 值输入 -->
            <input
              type="text"
              class="value-input"
              data-id="${row.id}"
              value="${row.value}"
              placeholder="输入筛选值..."
            >

            <!-- 删除按钮 -->
            <button class="btn-remove-row" data-id="${row.id}" aria-label="删除" title="删除条件">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');

    builderDiv.innerHTML = rowsHtml;

    // 绑定事件
    this.#bindConditionRowEvents();
  }

  /**
   * 获取操作符选项（根据字段类型）
   * @private
   */
  #getOperatorOptions(field, currentOperator) {
    let operators = [];

    // 根据字段类型返回不同的操作符
    const stringFields = ['filename', 'tags'];
    const numberFields = ['rating', 'review_count', 'file_size'];
    const dateFields = ['created_at', 'updated_at', 'last_accessed_at'];

    if (stringFields.includes(field)) {
      operators = [
        { value: 'contains', label: '包含' },
        { value: 'not_contains', label: '不包含' },
        { value: 'eq', label: '等于' },
        { value: 'starts_with', label: '开头是' },
        { value: 'ends_with', label: '结尾是' }
      ];
    } else if (numberFields.includes(field)) {
      operators = [
        { value: 'eq', label: '等于' },
        { value: 'ne', label: '不等于' },
        { value: 'gt', label: '大于' },
        { value: 'lt', label: '小于' },
        { value: 'gte', label: '大于等于' },
        { value: 'lte', label: '小于等于' }
      ];
    } else if (dateFields.includes(field)) {
      operators = [
        { value: 'eq', label: '等于' },
        { value: 'gt', label: '之后' },
        { value: 'lt', label: '之前' },
        { value: 'in_range', label: '范围内' }
      ];
    }

    return operators.map(op => {
      const selected = op.value === currentOperator ? 'selected' : '';
      return `<option value="${op.value}" ${selected}>${op.label}</option>`;
    }).join('');
  }

  /**
   * 绑定条件行事件
   * @private
   */
  #bindConditionRowEvents() {
    const builderDiv = this.#container.querySelector('#conditions-builder');

    // 逻辑选择器变化
    builderDiv.querySelectorAll('.logic-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const rowId = e.target.dataset.id;
        const row = this.#conditionsList.find(r => r.id === rowId);
        if (row) {
          row.logic = e.target.value;
          this.#updatePreview();
        }
      });
    });

    // 字段选择器变化
    builderDiv.querySelectorAll('.field-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const rowId = e.target.dataset.id;
        const row = this.#conditionsList.find(r => r.id === rowId);
        if (row) {
          row.field = e.target.value;
          // 重新渲染以更新操作符选项
          this.#renderConditions();
          this.#updatePreview();
        }
      });
    });

    // 操作符选择器变化
    builderDiv.querySelectorAll('.operator-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const rowId = e.target.dataset.id;
        const row = this.#conditionsList.find(r => r.id === rowId);
        if (row) {
          row.operator = e.target.value;
          this.#updatePreview();
        }
      });
    });

    // 值输入变化
    builderDiv.querySelectorAll('.value-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const rowId = e.target.dataset.id;
        const row = this.#conditionsList.find(r => r.id === rowId);
        if (row) {
          row.value = e.target.value;
          this.#updatePreview();
        }
      });
    });

    // 删除按钮
    builderDiv.querySelectorAll('.btn-remove-row').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeConditionRow(btn.dataset.id);
      });
    });
  }

  /**
   * 更新预览
   * @private
   */
  #updatePreview() {
    const previewSpan = this.#container.querySelector('#conditions-preview');

    if (this.#conditionsList.length === 0) {
      previewSpan.textContent = '无条件';
      return;
    }

    // 构建描述文本
    const descriptions = this.#conditionsList.map((row, index) => {
      const operatorLabels = {
        'contains': '包含',
        'not_contains': '不包含',
        'eq': '等于',
        'ne': '不等于',
        'gt': '大于',
        'lt': '小于',
        'gte': '≥',
        'lte': '≤',
        'starts_with': '开头是',
        'ends_with': '结尾是',
        'in_range': '范围内'
      };

      const fieldLabels = {
        'filename': '文件名',
        'tags': '标签',
        'rating': '评分',
        'review_count': '复习次数',
        'file_size': '文件大小',
        'created_at': '创建时间',
        'last_accessed_at': '访问时间'
      };

      let desc = `${fieldLabels[row.field] || row.field} ${operatorLabels[row.operator] || row.operator} "${row.value}"`;
      if (index > 0) {
        const logicLabel = row.logic === 'AND' ? '且' : '或';
        desc = `${logicLabel} ${desc}`;
      }
      return desc;
    });

    previewSpan.textContent = descriptions.join(' ');
  }

  /**
   * 应用筛选
   */
  applyFilter() {
    this.#logger.info('[FilterBuilder] Applying filters');

    // 清除现有条件
    this.#filterManager.clearFilter();

    // 构建条件
    if (this.#conditionsList.length === 0) {
      this.hide();
      return;
    }

    try {
      // 将条件列表转换为条件对象
      let rootCondition = null;

      if (this.#conditionsList.length === 1) {
        // 单个条件
        const row = this.#conditionsList[0];
        rootCondition = new FieldCondition({
          field: row.field,
          operator: row.operator,
          value: row.value
        });
      } else {
        // 多个条件，需要组合
        rootCondition = this.#buildCompositeCondition();
      }

      // 应用筛选
      this.#filterManager.applyCondition(rootCondition);

      this.hide();
    } catch (error) {
      this.#logger.error('[FilterBuilder] Failed to apply filter', error);
      alert(`筛选条件错误: ${error.message}`);
    }
  }

  /**
   * 构建组合条件
   * @private
   */
  #buildCompositeCondition() {
    // 简单实现：按顺序组合
    let currentComposite = null;

    this.#conditionsList.forEach((row, index) => {
      const fieldCond = new FieldCondition({
        field: row.field,
        operator: row.operator,
        value: row.value
      });

      if (index === 0) {
        currentComposite = fieldCond;
      } else {
        const newComposite = new CompositeCondition({
          operator: row.logic,
          conditions: [currentComposite, fieldCond]
        });
        currentComposite = newComposite;
      }
    });

    return currentComposite;
  }

  /**
   * 加载当前条件
   * @private
   */
  #loadCurrentConditions() {
    // v001 简化实现：清空重新开始
    this.#conditionsList = [];
    this.#renderConditions();
    this.#updatePreview();
  }

  /**
   * 设置事件监听
   * @private
   */
  #setupEventListeners() {
    const collapseBtn = this.#container.querySelector('.btn-collapse');
    const resetBtn = this.#container.querySelector('.btn-reset');
    const applyBtn = this.#container.querySelector('.btn-apply');
    const addConditionBtn = this.#container.querySelector('.btn-add-condition');

    // 收起
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => this.hide());
    }

    // 重置
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.#conditionsList = [];
        this.#renderConditions();
        this.#updatePreview();
        this.#logger.info('[FilterBuilder] Reset');
      });
    }

    // 应用
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        this.applyFilter();
      });
    }

    // 添加条件
    if (addConditionBtn) {
      addConditionBtn.addEventListener('click', () => {
        this.addConditionRow();
      });
    }
  }

  /**
   * 销毁组件
   */
  destroy() {
    if (this.#container) {
      this.#container.innerHTML = '';
    }
    this.#logger.info('[FilterBuilder] Destroyed');
  }
}
