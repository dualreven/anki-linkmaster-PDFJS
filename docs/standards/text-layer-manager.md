# TextLayerManager（PDF 文字层）说明

目标：将 `src/frontend/pdf-viewer/ui/text-layer-manager.js` 控制在 ≤500 行，并把长说明/规格引用外移到文档。

## 规格来源
- `todo-and-doing/4 done/20250922143000-pdf-text-layer/v001-spec.md`

## 职责
- 加载/渲染 PDF.js 文字层（text layer）
- 暴露选区文字/位置与高亮相关能力

