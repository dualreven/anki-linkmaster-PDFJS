/**
 * PDF-Viewer 事件常量定义
 * @file 定义 PDF-Viewer 模块专用的事件常量
 * @module PDFViewerEvents
 */

/**
 * PDF-Viewer 事件常量
 * @namespace PDF_VIEWER_EVENTS
 */
export const PDF_VIEWER_EVENTS = {
  /**
   * 文件操作相关事件
   * @namespace FILE
   */
  FILE: {
    /**
     * 文件加载事件
     * @namespace LOAD
     */
    LOAD: {
      /**
       * 文件加载请求事件
       * @event pdf-viewer:file:load:requested
       * @type {string}
       */
      REQUESTED: 'pdf-viewer:file:load:requested',
      
      /**
       * 文件加载成功事件
       * @event pdf-viewer:file:load:success
       * @type {string}
       */
      SUCCESS: 'pdf-viewer:file:load:success',
      
      /**
       * 文件加载失败事件
       * @event pdf-viewer:file:load:failed
       * @type {string}
       */
      FAILED: 'pdf-viewer:file:load:failed',
      
      /**
       * 文件加载进度事件
       * @event pdf-viewer:file:load:progress
       * @type {string}
       */
      PROGRESS: 'pdf-viewer:file:load:progress',
      /**
       * 文件重试加载事件
       * @event pdf-viewer:file:load:retry
       * @type {string}
       */
      RETRY: 'pdf-viewer:file:load:retry',
     },
    
    /**
     * 文件关闭事件
     * @event pdf-viewer:file:close
     * @type {string}
     */
    CLOSE: 'pdf-viewer:file:close',
    
    /**
     * 文件信息获取事件
     * @event pdf-viewer:file:info:requested
     * @type {string}
     */
    INFO_REQUESTED: 'pdf-viewer:file:info:requested',
    
    /**
     * 文件信息响应事件
     * @event pdf-viewer:file:info:response
     * @type {string}
     */
    INFO_RESPONSE: 'pdf-viewer:file:info:response',
  },
  
  /**
   * 页面导航相关事件
   * @namespace NAVIGATION
   */
  NAVIGATION: {
    /**
     * 上一页事件
     * @event pdf-viewer:navigation:previous
     * @type {string}
     */
    PREVIOUS: 'pdf-viewer:navigation:previous',
    
    /**
     * 下一页事件
     * @event pdf-viewer:navigation:next
     * @type {string}
     */
    NEXT: 'pdf-viewer:navigation:next',
    
    /**
     * 跳转到指定页面事件
     * @event pdf-viewer:navigation:goto
     * @type {string}
     */
    GOTO: 'pdf-viewer:navigation:goto',
    
    /**
     * 页面改变事件
     * @event pdf-viewer:navigation:changed
     * @type {string}
     */
    CHANGED: 'pdf-viewer:navigation:changed',
    
    /**
     * 总页数更新事件
     * @event pdf-viewer:navigation:total-pages-updated
     * @type {string}
     */
    TOTAL_PAGES_UPDATED: 'pdf-viewer:navigation:total-pages-updated',
  },
  
  /**
   * 缩放控制相关事件
   * @namespace ZOOM
   */
  ZOOM: {
    /**
     * 放大事件
     * @event pdf-viewer:zoom:in
     * @type {string}
     */
    IN: 'pdf-viewer:zoom:in',
    
    /**
     * 缩小事件
     * @event pdf-viewer:zoom:out
     * @type {string}
     */
    OUT: 'pdf-viewer:zoom:out',
    
    /**
     * 适应宽度事件
     * @event pdf-viewer:zoom:fit-width
     * @type {string}
     */
    FIT_WIDTH: 'pdf-viewer:zoom:fit-width',
    
    /**
     * 适应高度事件
     * @event pdf-viewer:zoom:fit-height
     * @type {string}
     */
    FIT_HEIGHT: 'pdf-viewer:zoom:fit-height',
    
    /**
     * 实际大小事件
     * @event pdf-viewer:zoom:actual-size
     * @type {string}
     */
    ACTUAL_SIZE: 'pdf-viewer:zoom:actual-size',
    
    /**
     * 缩放比例改变事件
     * @event pdf-viewer:zoom:changed
     * @type {string}
     */
    CHANGED: 'pdf-viewer:zoom:changed',
  },
  
  /**
   * 视图渲染相关事件
   * @namespace RENDER
   */
  RENDER: {
    /**
     * 页面渲染请求事件
     * @event pdf-viewer:render:page:requested
     * @type {string}
     */
    PAGE_REQUESTED: 'pdf-viewer:render:page:requested',
    
    /**
     * 页面渲染完成事件
     * @event pdf-viewer:render:page:completed
     * @type {string}
     */
    PAGE_COMPLETED: 'pdf-viewer:render:page:completed',
    
    /**
     * 页面渲染失败事件
     * @event pdf-viewer:render:page:failed
     * @type {string}
     */
    PAGE_FAILED: 'pdf-viewer:render:page:failed',
    
    /**
     * 渲染质量改变事件
     * @event pdf-viewer:render:quality:changed
     * @type {string}
     */
    QUALITY_CHANGED: 'pdf-viewer:render:quality:changed',
  },
  
  /**
   * 文本操作相关事件
   * @namespace TEXT
   */
  TEXT: {
    /**
     * 文本选择事件
     * @event pdf-viewer:text:selected
     * @type {string}
     */
    SELECTED: 'pdf-viewer:text:selected',
    
    /**
     * 文本搜索事件
     * @event pdf-viewer:text:search:requested
     * @type {string}
     */
    SEARCH_REQUESTED: 'pdf-viewer:text:search:requested',
    
    /**
     * 搜索结果事件
     * @event pdf-viewer:text:search:result
     * @type {string}
     */
    SEARCH_RESULT: 'pdf-viewer:text:search:result',
    
    /**
     * 搜索完成事件
     * @event pdf-viewer:text:search:completed
     * @type {string}
     */
    SEARCH_COMPLETED: 'pdf-viewer:text:search:completed',
  },
  
  /**
   * 书签相关事件
   * @namespace BOOKMARK
   */
  BOOKMARK: {
    /**
     * 添加书签事件
     * @event pdf-viewer:bookmark:add
     * @type {string}
     */
    ADD: 'pdf-viewer:bookmark:add',
    
    /**
     * 删除书签事件
     * @event pdf-viewer:bookmark:remove
     * @type {string}
     */
    REMOVE: 'pdf-viewer:bookmark:remove',
    
    /**
     * 跳转到书签事件
     * @event pdf-viewer:bookmark:goto
     * @type {string}
     */
    GOTO: 'pdf-viewer:bookmark:goto',
    
    /**
     * 书签列表更新事件
     * @event pdf-viewer:bookmark:list:updated
     * @type {string}
     */
    LIST_UPDATED: 'pdf-viewer:bookmark:list:updated',
  },
  
  /**
   * UI 控制相关事件
   * @namespace UI
   */
  UI: {
    /**
     * 工具栏显示/隐藏事件
     * @event pdf-viewer:ui:toolbar:toggle
     * @type {string}
     */
    TOOLBAR_TOGGLE: 'pdf-viewer:ui:toolbar:toggle',
    
    /**
     * 侧边栏显示/隐藏事件
     * @event pdf-viewer:ui:sidebar:toggle
     * @type {string}
     */
    SIDEBAR_TOGGLE: 'pdf-viewer:ui:sidebar:toggle',
    
    /**
     * 缩略图显示/隐藏事件
     * @event pdf-viewer:ui:thumbnail:toggle
     * @type {string}
     */
    THUMBNAIL_TOGGLE: 'pdf-viewer:ui:thumbnail:toggle',
    
    /**
     * 全屏模式切换事件
     * @event pdf-viewer:ui:fullscreen:toggle
     * @type {string}
     */
    FULLSCREEN_TOGGLE: 'pdf-viewer:ui:fullscreen:toggle',
  },
  
  /**
   * 应用状态事件
   * @namespace STATE
   */
  STATE: {
    /**
     * 应用初始化完成事件
     * @event pdf-viewer:state:initialized
     * @type {string}
     */
    INITIALIZED: 'pdf-viewer:state:initialized',
    
    /**
     * 应用销毁事件
     * @event pdf-viewer:state:destroyed
     * @type {string}
     */
    DESTROYED: 'pdf-viewer:state:destroyed',
    
    /**
     * 错误状态事件
     * @event pdf-viewer:state:error
     * @type {string}
     */
    ERROR: 'pdf-viewer:state:error',
    
    /**
     * 加载状态事件
     * @event pdf-viewer:state:loading
     * @type {string}
     */
    LOADING: 'pdf-viewer:state:loading',
  }
};

/**
 * 默认导出事件常量
 */
export default PDF_VIEWER_EVENTS;