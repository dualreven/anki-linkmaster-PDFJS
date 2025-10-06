import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventBus } from '../../../../common/event/event-bus.js';
import { ScopedEventBus } from '../../../../common/event/scoped-event-bus.js';
import { WeightedSortEditor } from '../components/weighted-sort-editor.js';

const createLoggerStub = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
});

describe('WeightedSortEditor 可视化构建交互', () => {
  let container;
  let featureContainer;
  let editor;
  let globalEventBus;
  let scopedEventBus;
  let logger;

  const availableFields = [
    { field: 'size', label: '文件大小', type: 'number' },
    { field: 'star', label: '星标', type: 'number' },
    { field: 'page_count', label: '页数', type: 'number' },
    { field: 'title', label: '书名', type: 'string' },
    { field: 'review_count', label: '复习次数', type: 'number' },
    { field: 'total_reading_time', label: '阅读时长', type: 'number' }
  ];

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    container = document.getElementById('root');
    featureContainer = document.createElement('div');
    featureContainer.id = 'weighted-sort-container';
    container.appendChild(featureContainer);

    globalEventBus = new EventBus({ moduleName: 'TestBus', enableValidation: false });
    scopedEventBus = new ScopedEventBus(globalEventBus, 'weighted-sort-test');
    logger = createLoggerStub();

    editor = new WeightedSortEditor(logger, scopedEventBus, {
      availableFields
    });

    editor.render(featureContainer);
  });

  afterEach(() => {
    if (editor) {
      editor.destroy();
      editor = null;
    }
    document.body.innerHTML = '';
  });

  const click = (selector) => {
    const node = featureContainer.querySelector(selector);
    expect(node).toBeTruthy();
    node.click();
  };

  const getFormulaText = () => {
    const preview = featureContainer.querySelector('[data-test="formula-preview"] code');
    expect(preview).toBeTruthy();
    return preview.textContent.trim();
  };

  const getValidationText = () => {
    const status = featureContainer.querySelector('[data-test="validation-status"]');
    expect(status).toBeTruthy();
    return status.textContent.trim();
  };

  it('通过点击字段、运算符和数字按钮构建公式', () => {
    click('[data-test="field-button"][data-field="size"]');
    click('[data-test="operator-button"][data-operator="*"]');

    click('[data-test="number-pad-digit"][data-digit="2"]');
    click('[data-test="number-pad-action"][data-action="commit"]');

    expect(editor.getFormula()).toBe('size * 2');
    expect(getFormulaText()).toBe('size * 2');

    const tokens = featureContainer.querySelectorAll('[data-test="formula-token"]');
    expect(tokens).toHaveLength(3);
    expect(getValidationText()).toBe('✅ 公式格式正确');
  });

  it('使用函数按钮并通过面板选择参数', () => {
    click('[data-test="function-button"][data-function="max"]');

    const pending = featureContainer.querySelector('[data-test="function-pending"]');
    expect(pending).toBeTruthy();
    expect(pending.getAttribute('data-function')).toBe('max');
    expect(pending.getAttribute('data-remaining')).toBe('2');

    click('[data-test="field-button"][data-field="size"]');

    const afterFirstArg = featureContainer.querySelector('[data-test="function-pending"]');
    expect(afterFirstArg).toBeTruthy();
    expect(afterFirstArg.getAttribute('data-remaining')).toBe('1');

    click('[data-test="number-pad-digit"][data-digit="5"]');
    click('[data-test="number-pad-action"][data-action="commit"]');

    expect(featureContainer.querySelector('[data-test="function-pending"]')).toBeNull();

    expect(editor.getFormula()).toBe('max(size, 5)');
    expect(getFormulaText()).toBe('max(size, 5)');
    expect(getValidationText()).toBe('✅ 公式格式正确');

    const tokens = featureContainer.querySelectorAll('[data-test="formula-token"]');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].textContent.replace(/×/g, '').trim()).toBe('max(size, 5)');
  });

  it('length 函数可直接基于字符串字段构建表达式', () => {
    click('[data-test="function-button"][data-function="length"]');

    const pending = featureContainer.querySelector('[data-test="function-pending"]');
    expect(pending).toBeTruthy();
    expect(pending.getAttribute('data-function')).toBe('length');
    expect(pending.getAttribute('data-remaining')).toBe('1');

    click('[data-test="field-button"][data-field="title"]');

    expect(featureContainer.querySelector('[data-test="function-pending"]')).toBeNull();
    expect(editor.getFormula()).toBe('length(title)');
    expect(getFormulaText()).toBe('length(title)');
    expect(getValidationText()).toBe('✅ 公式格式正确');

    const tokens = featureContainer.querySelectorAll('[data-test="formula-token"]');
    expect(tokens).toHaveLength(1);
  });

  it('desc 函数可快速生成降序排序表达式', () => {
    click('[data-test="function-button"][data-function="desc"]');

    const pending = featureContainer.querySelector('[data-test="function-pending"]');
    expect(pending).toBeTruthy();
    expect(pending.getAttribute('data-remaining')).toBe('1');

    click('[data-test="field-button"][data-field="review_count"]');

    expect(featureContainer.querySelector('[data-test="function-pending"]')).toBeNull();
    expect(editor.getFormula()).toBe('desc(review_count)');
    expect(getFormulaText()).toBe('desc(review_count)');
    expect(getValidationText()).toBe('✅ 公式格式正确');
  });

  it('支持删除任意 token 并自动更新公式', () => {
    click('[data-test="field-button"][data-field="size"]');
    click('[data-test="operator-button"][data-operator="+"]');
    click('[data-test="field-button"][data-field="star"]');

    let tokens = featureContainer.querySelectorAll('[data-test="formula-token"]');
    expect(tokens).toHaveLength(3);

    const deleteOperator = tokens[1].querySelector('[data-test="token-delete"]');
    expect(deleteOperator).toBeTruthy();
    deleteOperator.click();

    tokens = featureContainer.querySelectorAll('[data-test="formula-token"]');
    expect(tokens).toHaveLength(2);
    expect(editor.getFormula()).toBe('size star');
    expect(getFormulaText()).toBe('size star');
    expect(getValidationText()).toBe('✅ 公式格式正确');
  });

  it('点击应用排序按钮触发 sorter:sort:requested 事件', () => {
    const handler = jest.fn();
    scopedEventBus.on('sorter:sort:requested', handler);

    click('[data-test="field-button"][data-field="size"]');
    click('[data-test="operator-button"][data-operator="*"]');
    click('[data-test="number-pad-digit"][data-digit="2"]');
    click('[data-test="number-pad-action"][data-action="commit"]');

    click('[data-test="apply-weighted-sort"]');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      type: 'weighted',
      formula: 'size * 2'
    });
  });
});
