// 必须先 mock，避免被 logger.js 的 import.meta 解析影响
jest.mock('../../../../../common/utils/logger.js', () => {
  return {
    getLogger: () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
    setModuleLogLevel: jest.fn(),
    LogLevel: { DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' },
  };
});
jest.mock('../../../../../common/utils/thirdparty-toast.js', () => ({
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../../../common/utils/notification.js', () => ({
  showInfo: jest.fn(),
}));

import { AnnotationSidebarUI } from '../annotation-sidebar-ui.js';
import { Annotation, AnnotationType } from '../../models/annotation.js';
import { PDF_VIEWER_EVENTS } from '../../../../../common/event/pdf-viewer-constants.js';

/**
 * 冒烟/功能完整性：AnnotationSidebarUI 卡片跳转
 * - 覆盖两条触发路径：
 *   1) 右上角“🧭 跳转”按钮（类名 .annotation-jump-btn）→ 发射 ANNOTATION.JUMP_TO（别名 JUMP_REQUESTED）
 *   2) 卡片内部委托按钮（类名 .jump-btn + data-annotation-id）→ 发射全局 URL_PARAMS.REQUESTED
 */
describe('AnnotationSidebarUI jump actions', () => {
  let eventBus;
  let ui;

  beforeEach(() => {
    // JSDOM 初始化
    document.body.innerHTML = '';
    // 事件总线桩（遵循项目 EventBus 的基本接口）
    eventBus = {
      emit: jest.fn(() => true),
      emitGlobal: jest.fn(() => true),
      on: jest.fn(() => () => {}),
      onGlobal: jest.fn(() => () => {}),
    };
    // 实例化 UI
    ui = new AnnotationSidebarUI(eventBus);
    ui.initialize();
    document.body.appendChild(ui.getContentElement());
  });

  afterEach(() => {
    ui.destroy();
    jest.clearAllMocks();
  });

  function createHighlightAnnotation(overrides = {}) {
    return new Annotation({
      id: overrides.id || 'pdfannotation-_AbC123xyzDEF456',
      type: AnnotationType.TEXT_HIGHLIGHT,
      pageNumber: overrides.pageNumber ?? 5,
      data: {
        selectedText: '测试文本',
        highlightColor: '#ffff00',
        // lineRects 用于计算 position 百分比（yPercent + heightPercent/2）
        lineRects: overrides.lineRects ?? [
          { xPercent: 10, yPercent: 20, widthPercent: 30, heightPercent: 10 },
        ],
        ...(overrides.data || {}),
      },
    });
  }

  test('点击卡片右上角跳转按钮，应发射 ANNOTATION.JUMP_TO（JUMP_REQUESTED）', () => {
    const annotation = createHighlightAnnotation();
    ui.addAnnotationCard(annotation);

    const jumpBtn = ui
      .getContentElement()
      .querySelector('.annotation-card .annotation-jump-btn');

    expect(jumpBtn).not.toBeNull();

    eventBus.emit.mockClear();
    jumpBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(eventBus.emit).toHaveBeenCalledTimes(1);
    // 验证事件名与载荷
    const [evtName, payload] = eventBus.emit.mock.calls[0];
    expect(evtName).toBe(PDF_VIEWER_EVENTS.ANNOTATION.JUMP_TO);
    expect(payload).toMatchObject({
      id: annotation.id,
      // 为避免“乐观 UI 先行、数据未入库”的落空，这里会尽量携带完整对象
      annotation: expect.any(Object),
    });
  });

  test('点击委托跳转按钮(.jump-btn[data-annotation-id])，应发射全局 URL_PARAMS.REQUESTED', () => {
    const annotation = createHighlightAnnotation({
      pageNumber: 7,
      lineRects: [{ xPercent: 0, yPercent: 33.3, widthPercent: 100, heightPercent: 12.4 }],
    });
    ui.addAnnotationCard(annotation);

    // 在该卡片内模拟工具自带的跳转按钮（委托选择器匹配 .jump-btn）
    const card = ui.getContentElement().querySelector(
      `.annotation-card[data-annotation-id="${annotation.id}"]`
    );
    expect(card).not.toBeNull();
    const delegatedBtn = document.createElement('button');
    delegatedBtn.className = 'jump-btn';
    delegatedBtn.setAttribute('data-annotation-id', annotation.id);
    card.appendChild(delegatedBtn);

    eventBus.emitGlobal.mockClear();
    delegatedBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(eventBus.emitGlobal).toHaveBeenCalledTimes(1);
    const [evtName, payload] = eventBus.emitGlobal.mock.calls[0];
    expect(evtName).toBe(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED);
    expect(payload).toMatchObject({
      annotationId: annotation.id,
      pageAt: annotation.pageNumber,
    });
    // 位置百分比（若 lineRects 可用，会计算中心点）
    if (Array.isArray(annotation.data?.lineRects) && annotation.data.lineRects.length > 0) {
      const r0 = annotation.data.lineRects[0];
      const expected = r0.yPercent + (r0.heightPercent / 2);
      expect(typeof payload.position === 'number').toBe(true);
      expect(Math.abs(payload.position - expected)).toBeLessThan(1e-6);
    } else {
      expect(payload.position === null || typeof payload.position === 'number').toBe(true);
    }
  });
});
