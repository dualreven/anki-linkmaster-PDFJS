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
       * @event pdf-viewer:navigation:url-params:parsed
       * @type {string}
       * @payload {Object} data
       * @payload {string|null} data.pdfId - PDF文件ID
       * @payload {number|null} data.pageAt - 目标页码(从1开始)
       * @payload {number|null} data.position - 页面内位置百分比(0-100)
       */
      PARSED: 'pdf-viewer:navigation:url-params:parsed',

      /**
       * URL参数导航请求事件
       * @event pdf-viewer:navigation:url-params:requested
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.pdfId - PDF文件ID
       * @payload {number} data.pageAt - 目标页码
       * @payload {number|null} data.position - 页面内位置百分比(可选)
       */
      REQUESTED: 'pdf-viewer:navigation:url-params:requested',

      /**
       * URL参数导航成功事件
       * @event pdf-viewer:navigation:url-params:success
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.pdfId - PDF文件ID
       * @payload {number} data.pageAt - 实际页码
       * @payload {number|null} data.position - 实际位置百分比
       * @payload {number} data.duration - 导航耗时(ms)
       */
      SUCCESS: 'pdf-viewer:navigation:url-params:success',

      /**
       * URL参数导航失败事件
       * @event pdf-viewer:navigation:url-params:failed
       * @type {string}
       * @payload {Object} data
       * @payload {Error} data.error - 错误对象
       * @payload {string} data.message - 错误消息
       * @payload {string} data.stage - 失败阶段('parse'|'load'|'navigate'|'scroll')
       */
      FAILED: 'pdf-viewer:navigation:url-params:failed',
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
  },

  /**
   * 标注相关事件
   * @namespace ANNOTATION
   */
  ANNOTATION: {
    /**
     * 侧边栏控制事件
     * @namespace SIDEBAR
     */
    SIDEBAR: {
      /**
       * 打开标注侧边栏
       * @event pdf-viewer:annotation:sidebar:open
       * @type {string}
       */
      OPEN: 'pdf-viewer:annotation:sidebar:open',

      /**
       * 关闭标注侧边栏
       * @event pdf-viewer:annotation:sidebar:close
       * @type {string}
       */
      CLOSE: 'pdf-viewer:annotation:sidebar:close',

      /**
       * 切换标注侧边栏显示/隐藏
       * @event pdf-viewer:annotation:sidebar:toggle
       * @type {string}
       */
      TOGGLE: 'pdf-viewer:annotation:sidebar:toggle',

      /**
       * 侧边栏已打开
       * @event pdf-viewer:annotation:sidebar:opened
       * @type {string}
       */
      OPENED: 'pdf-viewer:annotation:sidebar:opened',

      /**
       * 侧边栏已关闭
       * @event pdf-viewer:annotation:sidebar:closed
       * @type {string}
       */
      CLOSED: 'pdf-viewer:annotation:sidebar:closed',
    },

    /**
     * 工具模式切换事件
     * @namespace TOOL
     */
    TOOL: {
      /**
       * 激活工具
       * @event pdf-viewer:annotation:tool:activate
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.tool - 工具类型 ('screenshot'|'text-highlight'|'comment')
       */
      ACTIVATE: 'pdf-viewer:annotation:tool:activate',

      /**
       * 停用工具
       * @event pdf-viewer:annotation:tool:deactivate
       * @type {string}
       */
      DEACTIVATE: 'pdf-viewer:annotation:tool:deactivate',

      /**
       * 工具已激活
       * @event pdf-viewer:annotation:tool:activated
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.tool - 工具类型
       */
      ACTIVATED: 'pdf-viewer:annotation:tool:activated',

      /**
       * 工具已停用
       * @event pdf-viewer:annotation:tool:deactivated
       * @type {string}
       */
      DEACTIVATED: 'pdf-viewer:annotation:tool:deactivated',
    },

    /**
     * 标注CRUD事件
     * @namespace CRUD
     */
    /**
     * 创建标注请求
     * @event pdf-viewer:annotation:create
     * @type {string}
     * @payload {Object} data - 标注数据
     */
    CREATE: 'pdf-viewer:annotation:create',

    /**
     * 标注已创建
     * @event pdf-viewer:annotation:created
     * @type {string}
     * @payload {Object} data
     * @payload {Annotation} data.annotation - 创建的标注对象
     */
    CREATED: 'pdf-viewer:annotation:created',

    /**
     * 更新标注请求
     * @event pdf-viewer:annotation:update
     * @type {string}
     * @payload {Object} data
     * @payload {string} data.id - 标注ID
     * @payload {Object} data.changes - 变更内容
     */
    UPDATE: 'pdf-viewer:annotation:update',

    /**
     * 标注已更新
     * @event pdf-viewer:annotation:updated
     * @type {string}
     * @payload {Object} data
     * @payload {Annotation} data.annotation - 更新后的标注对象
     */
    UPDATED: 'pdf-viewer:annotation:updated',

    /**
     * 删除标注请求
     * @event pdf-viewer:annotation:delete
     * @type {string}
     * @payload {Object} data
     * @payload {string} data.id - 标注ID
     */
    DELETE: 'pdf-viewer:annotation:delete',

    /**
     * 标注已删除
     * @event pdf-viewer:annotation:deleted
     * @type {string}
     * @payload {Object} data
     * @payload {string} data.id - 已删除的标注ID
     */
    DELETED: 'pdf-viewer:annotation:deleted',

    /**
     * 标注交互事件
     * @namespace INTERACTION
     */
    /**
     * 选中标注
     * @event pdf-viewer:annotation:select
     * @type {string}
     * @payload {Object} data
     * @payload {string} data.id - 标注ID
     */
    SELECT: 'pdf-viewer:annotation:select',

    /**
     * 标注已选中
     * @event pdf-viewer:annotation:selected
     * @type {string}
     * @payload {Object} data
     * @payload {string} data.id - 标注ID
     */
    SELECTED: 'pdf-viewer:annotation:selected',

    /**
     * 跳转到标注位置
     * @event pdf-viewer:annotation:jump-to
     * @type {string}
     * @payload {Object} data
     * @payload {string} data.id - 标注ID
     */
    JUMP_TO: 'pdf-viewer:annotation:jump-to',

    /**
     * 高亮标注（闪烁效果）
     * @event pdf-viewer:annotation:highlight
     * @type {string}
     * @payload {Object} data
     * @payload {string} data.id - 标注ID
     */
    HIGHLIGHT: 'pdf-viewer:annotation:highlight',

    /**
     * 评论事件
     * @namespace COMMENT
     */
    COMMENT: {
      /**
       * 添加评论请求
       * @event pdf-viewer:annotation:comment:add
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.annotationId - 标注ID
       * @payload {string} data.content - 评论内容
       */
      ADD: 'pdf-viewer:annotation:comment:add',

      /**
       * 评论已添加
       * @event pdf-viewer:annotation:comment:added
       * @type {string}
       * @payload {Object} data
       * @payload {Comment} data.comment - 评论对象
       */
      ADDED: 'pdf-viewer:annotation:comment:added',

      /**
       * 删除评论请求
       * @event pdf-viewer:annotation:comment:delete
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.commentId - 评论ID
       */
      DELETE: 'pdf-viewer:annotation:comment:delete',

      /**
       * 评论已删除
       * @event pdf-viewer:annotation:comment:deleted
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.commentId - 评论ID
       */
      DELETED: 'pdf-viewer:annotation:comment:deleted',
    },

    /**
     * 数据加载事件
     * @namespace DATA
     */
    DATA: {
      /**
       * 加载标注请求
       * @event pdf-viewer:annotation:load
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.pdfPath - PDF文件路径
       */
      LOAD: 'pdf-viewer:annotation:load',

      /**
       * 标注已加载
       * @event pdf-viewer:annotation:loaded
       * @type {string}
       * @payload {Object} data
       * @payload {Array<Annotation>} data.annotations - 标注数组
       */
      LOADED: 'pdf-viewer:annotation:loaded',

      /**
       * 保存标注请求
       * @event pdf-viewer:annotation:save
       * @type {string}
       * @payload {Object} data
       * @payload {Array<Annotation>} data.annotations - 标注数组
       */
      SAVE: 'pdf-viewer:annotation:save',

      /**
       * 标注已保存
       * @event pdf-viewer:annotation:saved
       * @type {string}
       */
      SAVED: 'pdf-viewer:annotation:saved',

      /**
       * 加载失败
       * @event pdf-viewer:annotation:load-failed
       * @type {string}
       * @payload {Object} data
       * @payload {Error} data.error - 错误对象
       */
      LOAD_FAILED: 'pdf-viewer:annotation:load-failed',

      /**
       * 保存失败
       * @event pdf-viewer:annotation:save-failed
       * @type {string}
       * @payload {Object} data
       * @payload {Error} data.error - 错误对象
       */
      SAVE_FAILED: 'pdf-viewer:annotation:save-failed',
    },

    /**
     * 截图工具事件
     * @namespace SCREENSHOT
     */
    SCREENSHOT: {
      /**
       * 开始截图
       * @event pdf-viewer:annotation:screenshot:start
       * @type {string}
       */
      START: 'pdf-viewer:annotation:screenshot:start',

      /**
       * 区域已选择
       * @event pdf-viewer:annotation:screenshot:area-selected
       * @type {string}
       * @payload {Object} data
       * @payload {Object} data.rect - 选择区域 {x, y, width, height}
       */
      AREA_SELECTED: 'pdf-viewer:annotation:screenshot:area-selected',

      /**
       * 截图已捕获
       * @event pdf-viewer:annotation:screenshot:captured
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.imageData - base64图片数据
       */
      CAPTURED: 'pdf-viewer:annotation:screenshot:captured',

      /**
       * 取消截图
       * @event pdf-viewer:annotation:screenshot:cancel
       * @type {string}
       */
      CANCEL: 'pdf-viewer:annotation:screenshot:cancel',
    },

    /**
     * 选字高亮事件
     * @namespace TEXT_HIGHLIGHT
     */
    TEXT_HIGHLIGHT: {
      /**
       * 开始选字
       * @event pdf-viewer:annotation:text:selection:start
       * @type {string}
       */
      SELECTION_START: 'pdf-viewer:annotation:text:selection:start',

      /**
       * 文本已选择
       * @event pdf-viewer:annotation:text:selected
       * @type {string}
       * @payload {Object} data
       * @payload {string} data.text - 选中的文本
       * @payload {Array} data.ranges - 文本范围数组
       */
      TEXT_SELECTED: 'pdf-viewer:annotation:text:selected',

      /**
       * 高亮已应用
       * @event pdf-viewer:annotation:highlight:applied
       * @type {string}
       * @payload {Object} data
       * @payload {Annotation} data.annotation - 标注对象
       */
      HIGHLIGHT_APPLIED: 'pdf-viewer:annotation:highlight:applied',
    },

    /**
     * 批注工具事件
     * @namespace COMMENT_TOOL
     */
    COMMENT_TOOL: {
      /**
       * 批注工具激活
       * @event pdf-viewer:annotation:comment-tool:active
       * @type {string}
       */
      ACTIVE: 'pdf-viewer:annotation:comment-tool:active',

      /**
       * 位置已选择
       * @event pdf-viewer:annotation:comment:position:selected
       * @type {string}
       * @payload {Object} data
       * @payload {number} data.x - X坐标
       * @payload {number} data.y - Y坐标
       * @payload {number} data.pageNumber - 页码
       */
      POSITION_SELECTED: 'pdf-viewer:annotation:comment:position:selected',
    },
  }
};

/**
 * 默认导出事件常量
 */
export default PDF_VIEWER_EVENTS;
