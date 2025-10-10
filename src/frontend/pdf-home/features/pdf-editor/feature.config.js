/**
 * @file PDF Editor 功能域配置
 * @module features/pdf-editor/config
 */

export const PDFEditorFeatureConfig = {
  /**
   * 功能名称（唯一标识）
   */
  name: 'pdf-editor',

  /**
   * 功能版本（遵循 SemVer 规范）
   */
  version: '1.0.0',

  /**
   * 功能依赖
   * - 依赖 pdf-list 功能域（需要知道哪些记录被选中）
   */
  dependencies: ['pdf-list'],

  /**
   * 功能描述
   */
  description: 'PDF 记录编辑器功能域 - 提供 PDF 记录的编辑功能（星标、标签、备注等）',

  /**
   * 功能作者
   */
  author: 'PDF-Home Team',

  /**
   * 功能配置
   */
  config: {
    /**
     * 编辑器配置
     */
    editor: {
      // 模态对话框宽度
      modalWidth: '600px',

      // 模态对话框高度
      modalHeight: 'auto',

      // 是否支持拖拽调整大小
      resizable: true,

      // 表单字段配置
      fields: [
        {
          name: 'star',
          label: '星标',
          type: 'star-rating',
          max: 5,
          required: false
        },
        {
          name: 'tags',
          label: '标签',
          type: 'tags-input',
          placeholder: '输入标签并按回车',
          required: false
        },
        {
          name: 'notes',
          label: '备注',
          type: 'textarea',
          placeholder: '输入备注内容',
          rows: 4,
          required: false
        },
        {
          name: 'created_time',
          label: '创建时间',
          type: 'datetime',
          readonly: true,
          required: false
        },
        {
          name: 'modified_time',
          label: '修改时间',
          type: 'datetime',
          readonly: true,
          required: false
        },
        {
          name: 'archived',
          label: '归档',
          type: 'toggle',
          required: false
        }
      ]
    },

    /**
     * 事件配置
     */
    events: {
      // 事件命名空间（由 ScopedEventBus 自动添加）
      namespace: '@pdf-editor/',

      // 本地事件（功能域内部事件）
      local: {
        // 编辑器打开事件
        EDITOR_OPENED: 'editor:opened',
        // 编辑器关闭事件
        EDITOR_CLOSED: 'editor:closed',
        // 表单提交事件
        FORM_SUBMITTED: 'form:submitted',
        // 表单验证失败事件
        FORM_VALIDATION_FAILED: 'form:validation:failed'
      },

      // 全局事件（跨功能域通信）
      global: {
        // PDF 记录更新事件（通知其他功能域）
        RECORD_UPDATED: 'editor:record:updated',
        // 编辑请求事件（监听来自 pdf-list 的请求）
        EDIT_REQUESTED: 'pdf:edit:requested'
      }
    },

    /**
     * UI 配置
     */
    ui: {
      // 编辑器容器 ID
      containerId: 'pdf-editor-modal',

      // 主题
      theme: 'default',

      // 动画效果
      animation: {
        enabled: true,
        duration: 300,
        easing: 'ease-in-out'
      }
    }
  }
};

export default PDFEditorFeatureConfig;
