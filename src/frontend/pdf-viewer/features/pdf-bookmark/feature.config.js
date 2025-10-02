export const PDFBookmarkFeatureConfig = {
  name: 'pdf-bookmark',
  version: '1.0.0',
  dependencies: ['pdf-reader', 'pdf-ui'],
  description: '书签管理功能',
  optional: true,
  
  events: {
    BOOKMARK_ADD: '@pdf-bookmark/add',
    BOOKMARK_DELETE: '@pdf-bookmark/delete',
    BOOKMARK_JUMP: '@pdf-bookmark/jump'
  },
  
  metadata: { phase: 'Phase 1', priority: 'medium' }
};
