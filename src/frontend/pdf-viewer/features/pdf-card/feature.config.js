/**
 * PDF卡片功能配置
 * @file 定义PDF卡片功能的基本配置信息
 */

export const PDFCardFeatureConfig = {
  name: 'pdf-card',
  version: '1.0.0',
  dependencies: ['app-core'],

  // 功能标志（分期控制）
  features: {
    phase1: {
      enabled: true,
      description: '容器UI设计（第一期）'
    },
    phase2: {
      enabled: false,
      description: '从Anki加载卡片（第二期）'
    },
    phase3: {
      enabled: false,
      description: '快速制卡功能（第三期）'
    },
    phase4: {
      enabled: false,
      description: '完整制卡功能（第四期）'
    },
    phase5: {
      enabled: false,
      description: '复习功能（第五期）'
    }
  }
};
