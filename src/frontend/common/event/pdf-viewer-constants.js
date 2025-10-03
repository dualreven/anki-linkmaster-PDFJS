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
       * @event pdf-viewer:file:load-requested
       * @type {string}
       */
      REQUESTED: 'pdf-viewer:file:load-requested',
      
      /**
       * 文件加载成功事件
       * @event pdf-viewer:file:load-success
       * @type {string}
       */
      SUCCESS: 'pdf-viewer:file:load-success',
      
      /**
       * 文件加载失败事件
       * @event pdf-viewer:file:load-failed
       * @type {string}
       */
      FAILED: 'pdf-viewer:file:load-failed',
      
      /**
       * 文件加载进度事件
       * @event pdf-viewer:file:load-progress
       * @type {string}
       */
      PROGRESS: 'pdf-viewer:file:load-progress',
      /**
       * 文件重试加载事件
       * @event pdf-viewer:file:load-retry
       * @type {string}
       */
      RETRY: 'pdf-viewer:file:load-retry',
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
   * 页面相关事件（简化命名空间）
   * @namespace PAGE
   */
  PAGE: {
    /**
     * 页面正在改变事件（PDFViewerManager发出）
     * @event pdf-viewer:page:changing
     * @type {string}
     */
    CHANGING: 'pdf-viewer:page:changing',
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

    /**
     * URL参数导航相关事件
     * @namespace URL_PARAMS
     */
    URL_PARAMS: {
      /**
       * URL参数解析完成事件
       * @event pdf-viewer:url-params:parsed
       * @type {string}
       * @payload {Object} data
       * @payload {string|null} data.pdfId - PDF文件ID
       * @payload {number|null} data.pageAt - 目标页码(从1开始)
       * @payload {number|null} data.position - 页面内位置百分比(0-100)
       */
      PARSED: 'pdf-viewer:url-params:parsed',

      /**
       * URL参数导航请求事件
       * @event pdf-viewer:url-params:requested
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.pdfId - PDF文件ID
       * @payload {number} data.pageAt - 目标页码
       * @payload {number|null} data.position - 页面内位置百分比(可选)
       */
      REQUESTED: 'pdf-viewer:url-params:requested',

      /**
       * URL参数导航成功事件
       * @event pdf-viewer:url-params:success
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.pdfId - PDF文件ID
       * @payload {number} data.pageAt - 实际页码
       * @payload {number|null} data.position - 实际位置百分比
       * @payload {number} data.duration - 导航耗时(ms)
       */
      SUCCESS: 'pdf-viewer:url-params:success',

      /**
       * URL参数导航失败事件
       * @event pdf-viewer:url-params:failed
       * @type {string}
       * @payload {Object} data
       * @payload {Error} data.error - 错误对象
       * @payload {string} data.message - 错误消息
       * @payload {string} data.stage - 失败阶段('parse'|'load'|'navigate'|'scroll')
       */
      FAILED: 'pdf-viewer:url-params:failed',
    },
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

    /**
     * 缩放比例正在改变事件（PDFViewerManager发出）
     * @event pdf-viewer:zoom:changing
     * @type {string}
     */
    CHANGING: 'pdf-viewer:zoom:changing',
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
    PAGE_REQUESTED: 'pdf-viewer:render-page:requested',
    
    /**
     * 页面渲染完成事件
     * @event pdf-viewer:render:page:completed
     * @type {string}
     */
    PAGE_COMPLETED: 'pdf-viewer:render-page:completed',
    
    /**
     * 页面渲染失败事件
     * @event pdf-viewer:render:page:failed
     * @type {string}
     */
    PAGE_FAILED: 'pdf-viewer:render-page:failed',
    
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
   * 搜索功能相关事件
   * @namespace SEARCH
   */
  SEARCH: {
    /**
     * UI控制事件
     * @namespace UI
     */
    UI: {
      /**
       * 打开搜索框
       * @event pdf-viewer:search:ui:open
       * @type {string}
       */
      OPEN: 'pdf-viewer:search:ui:open',

      /**
       * 关闭搜索框
       * @event pdf-viewer:search:ui:close
       * @type {string}
       */
      CLOSE: 'pdf-viewer:search:ui:close',

      /**
       * 切换搜索框显示/隐藏
       * @event pdf-viewer:search:ui:toggle
       * @type {string}
       */
      TOGGLE: 'pdf-viewer:search:ui:toggle',
    },

    /**
     * 搜索执行事件
     * @namespace EXECUTE
     */
    EXECUTE: {
      /**
       * 执行搜索请求
       * @event pdf-viewer:search:execute:query
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.query - 搜索关键词
       * @payload {Object} data.options - 搜索选项
       * @payload {boolean} data.options.caseSensitive - 是否区分大小写
       * @payload {boolean} data.options.wholeWords - 是否全词匹配
       * @payload {boolean} data.options.highlightAll - 是否高亮所有结果
       */
      QUERY: 'pdf-viewer:search:execute:query',

      /**
       * 搜索关键词变化
       * @event pdf-viewer:search:execute:query-changed
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.query - 新的搜索关键词
       */
      QUERY_CHANGED: 'pdf-viewer:search:execute:query-changed',

      /**
       * 清空搜索
       * @event pdf-viewer:search:execute:clear
       * @type {string}
       */
      CLEAR: 'pdf-viewer:search:execute:clear',
    },

    /**
     * 搜索结果事件
     * @namespace RESULT
     */
    RESULT: {
      /**
       * 找到搜索结果
       * @event pdf-viewer:search:result:found
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.query - 搜索关键词
       * @payload {number} data.total - 总匹配数
       * @payload {number} data.current - 当前匹配索引
       * @payload {Array} data.matches - 匹配结果数组
       */
      FOUND: 'pdf-viewer:search:result:found',

      /**
       * 未找到搜索结果
       * @event pdf-viewer:search:result:not-found
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.query - 搜索关键词
       */
      NOT_FOUND: 'pdf-viewer:search:result:not-found',

      /**
       * 搜索结果已更新
       * @event pdf-viewer:search:result:updated
       * @type {string}
       * @payload {Object} data
       * @payload {number} data.current - 当前匹配索引
       * @payload {number} data.total - 总匹配数
       */
      UPDATED: 'pdf-viewer:search:result:updated',

      /**
       * 搜索进度更新
       * @event pdf-viewer:search:result:progress
       * @type {string}
       * @payload {Object} data
       * @payload {number} data.current - 当前搜索页数
       * @payload {number} data.total - 总页数
       */
      PROGRESS: 'pdf-viewer:search:result:progress',
    },

    /**
     * 搜索导航事件
     * @namespace NAVIGATE
     */
    NAVIGATE: {
      /**
       * 导航到下一个搜索结果
       * @event pdf-viewer:search:navigate:next
       * @type {string}
       */
      NEXT: 'pdf-viewer:search:navigate:next',

      /**
       * 导航到上一个搜索结果
       * @event pdf-viewer:search:navigate:prev
       * @type {string}
       */
      PREV: 'pdf-viewer:search:navigate:prev',

      /**
       * 跳转到指定搜索结果
       * @event pdf-viewer:search:navigate:to
       * @type {string}
       * @payload {Object} data
       * @payload {number} data.index - 目标结果索引
       */
      TO: 'pdf-viewer:search:navigate:to',

      /**
       * 导航完成
       * @event pdf-viewer:search:navigate:completed
       * @type {string}
       * @payload {Object} data
       * @payload {number} data.pageNumber - 跳转到的页码
       * @payload {number} data.matchIndex - 匹配项索引
       */
      COMPLETED: 'pdf-viewer:search:navigate:completed',
    },

    /**
     * 搜索选项事件
     * @namespace OPTION
     */
    OPTION: {
      /**
       * 搜索选项改变
       * @event pdf-viewer:search:option:changed
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.option - 选项名称（caseSensitive|wholeWords|highlightAll）
       * @payload {boolean} data.value - 选项值
       */
      CHANGED: 'pdf-viewer:search:option:changed',

      /**
       * 重置搜索选项
       * @event pdf-viewer:search:option:reset
       * @type {string}
       */
      RESET: 'pdf-viewer:search:option:reset',
    },

    /**
     * 搜索状态事件
     * @namespace STATE
     */
    STATE: {
      /**
       * 搜索引擎已初始化
       * @event pdf-viewer:search:state:initialized
       * @type {string}
       */
      INITIALIZED: 'pdf-viewer:search:state:initialized',

      /**
       * 搜索引擎已销毁
       * @event pdf-viewer:search:state:destroyed
       * @type {string}
       */
      DESTROYED: 'pdf-viewer:search:state:destroyed',

      /**
       * 搜索中
       * @event pdf-viewer:search:state:searching
       * @type {string}
       */
      SEARCHING: 'pdf-viewer:search:state:searching',

      /**
       * 搜索空闲
       * @event pdf-viewer:search:state:idle
       * @type {string}
       */
      IDLE: 'pdf-viewer:search:state:idle',
    },
  },

  /**
   * 书签相关事件
   * @namespace BOOKMARK
   */
  BOOKMARK: {
    /**
     * 侧边栏控制事件
     * @namespace SIDEBAR
     */
    SIDEBAR: {
      /**
       * 切换侧边栏显示/隐藏
       * @event pdf-viewer:bookmark:sidebar:toggle
       * @type {string}
       */
      TOGGLE: 'pdf-viewer:bookmark-sidebar:toggle',

      /**
       * 侧边栏已打开
       * @event pdf-viewer:bookmark:sidebar:opened
       * @type {string}
       */
      OPENED: 'pdf-viewer:bookmark-sidebar:opened',

      /**
       * 侧边栏已关闭
       * @event pdf-viewer:bookmark:sidebar:closed
       * @type {string}
       */
      CLOSED: 'pdf-viewer:bookmark-sidebar:closed',
    },

    /**
     * 书签加载事件
     * @namespace LOAD
     */
    LOAD: {
      /**
       * 请求加载书签
       * @event pdf-viewer:bookmark:load:requested
       * @type {string}
       */
      REQUESTED: 'pdf-viewer:bookmark-load:requested',

      /**
       * 书签加载成功
       * @event pdf-viewer:bookmark:load:success
       * @type {string}
       * @payload {Object} data
       * @payload {Array<BookmarkNode>} data.bookmarks - 书签数据数组
       * @payload {number} data.count - 书签总数（包括子书签）
       * @payload {string} data.source - 数据来源 ('pdf' | 'local')
       */
      SUCCESS: 'pdf-viewer:bookmark-load:success',

      /**
       * 书签加载失败
       * @event pdf-viewer:bookmark:load:failed
       * @type {string}
       * @payload {Object} data
       * @payload {Error} data.error - 错误对象
       * @payload {string} data.message - 错误消息
       */
      FAILED: 'pdf-viewer:bookmark-load:failed',

      /**
       * 书签为空（无书签）
       * @event pdf-viewer:bookmark:load:empty
       * @type {string}
       */
      EMPTY: 'pdf-viewer:bookmark-load:empty',
    },

    /**
     * 书签导航事件
     * @namespace NAVIGATE
     */
    NAVIGATE: {
      /**
       * 请求导航到书签
       * @event pdf-viewer:bookmark:navigate:requested
       * @type {string}
       * @payload {Object} data
       * @payload {BookmarkNode} data.bookmark - 被点击的书签对象
       * @payload {number} data.timestamp - 触发时间戳
       */
      REQUESTED: 'pdf-viewer:bookmark-navigate:requested',

      /**
       * 导航成功
       * @event pdf-viewer:bookmark:navigate:success
       * @type {string}
       * @payload {Object} data
       * @payload {number} data.pageNumber - 目标页码
       * @payload {Object} data.position - 目标位置 {x, y}
       */
      SUCCESS: 'pdf-viewer:bookmark-navigate:success',

      /**
       * 导航失败
       * @event pdf-viewer:bookmark:navigate:failed
       * @type {string}
       * @payload {Object} data
       * @payload {Error} data.error - 错误对象
       * @payload {string} data.message - 错误消息
       */
      FAILED: 'pdf-viewer:bookmark-navigate:failed',
    },

    /**
     * 书签创建事件（v002+ 预留）
     * @namespace CREATE
     */
    CREATE: {
      /**
       * 请求创建书签
       * @event pdf-viewer:bookmark:create:requested
       * @type {string}
       */
      REQUESTED: 'pdf-viewer:bookmark-create:requested',

      /**
       * 创建成功
       * @event pdf-viewer:bookmark:create:success
       * @type {string}
       */
      SUCCESS: 'pdf-viewer:bookmark-create:success',

      /**
       * 创建失败
       * @event pdf-viewer:bookmark:create:failed
       * @type {string}
       */
      FAILED: 'pdf-viewer:bookmark-create:failed',
    },

    /**
     * 书签更新事件（v002+ 预留）
     * @namespace UPDATE
     */
    UPDATE: {
      /**
       * 请求更新书签
       * @event pdf-viewer:bookmark:update:requested
       * @type {string}
       */
      REQUESTED: 'pdf-viewer:bookmark-update:requested',

      /**
       * 更新成功
       * @event pdf-viewer:bookmark:update:success
       * @type {string}
       */
      SUCCESS: 'pdf-viewer:bookmark-update:success',

      /**
       * 更新失败
       * @event pdf-viewer:bookmark:update:failed
       * @type {string}
       */
      FAILED: 'pdf-viewer:bookmark-update:failed',
    },

    /**
     * 书签删除事件（v002+ 预留）
     * @namespace DELETE
     */
    DELETE: {
      /**
       * 请求删除书签
       * @event pdf-viewer:bookmark:delete:requested
       * @type {string}
       */
      REQUESTED: 'pdf-viewer:bookmark-delete:requested',

      /**
       * 删除成功
       * @event pdf-viewer:bookmark:delete:success
       * @type {string}
       */
      SUCCESS: 'pdf-viewer:bookmark-delete:success',

      /**
       * 删除失败
       * @event pdf-viewer:bookmark:delete:failed
       * @type {string}
       */
      FAILED: 'pdf-viewer:bookmark-delete:failed',
    },
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
    TOOLBAR_TOGGLE: 'pdf-viewer:ui:toolbar-toggle',
    
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
    RESIZED: 'pdf-viewer:ui:resized',
    
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
