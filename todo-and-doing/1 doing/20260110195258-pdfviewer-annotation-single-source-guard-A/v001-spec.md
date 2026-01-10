# PDFViewer Annotation 单真源防分叉门禁（lint）

**功能ID**: 20260110195258-pdfviewer-annotation-single-source-guard-A
**优先级**: 高（P0 结构性债务防回潮）
**版本**: v001
**创建时间**: 2026-01-10 19:52:58
**状态**: 设计中

## 现状说明
- 当前 `Annotation` 模型真源位于：`src/frontend/common/models/annotation.js`
- `pdf-annotation` feature 内为复出口：`src/frontend/pdf-viewer/features/pdf-annotation/models/annotation.js`

## 存在问题
- 结构性风险：未来很容易再次在 feature 内复制一份实现，出现“重复真源”，导致分叉回面条。

## 提出需求
- 以 **lint/门禁** 形式阻止“在非真源路径再次定义 Annotation 模型实现”。

## 解决方案
- 新增一个 lint gate（或纳入现有 lint 流水线）：
  - 扫描 `src/frontend/pdf-viewer/features/pdf-annotation/models/annotation.js` 必须保持为复出口（仅 re-export），禁止包含实现性符号（如 `class Annotation`、`export class Annotation`、`function generateAnnotationId` 的重复定义等）。
  - 如未来新增其他 feature 侧复出口文件，也可将规则扩展为“禁止 feature 侧出现 Annotation 实现定义，必须从 common 复出口”。

## 约束条件
### 允许修改的目录（scope）
- `src/frontend/common/models/annotation.js`
- `src/frontend/pdf-viewer/features/pdf-annotation/models/annotation.js`
- lint gate/脚本所在位置（以仓库既有 lint 体系为准）

### 严格遵循代码规范和标准
- 先读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- 测试/门禁相关：`docs/SPEC/FRONTEND-TEST-TOOLS-001.md`

## 可行验收标准
### Lint 门禁（必需）
- `pnpm -s run lint` ✅
- 当 feature 侧出现 `class Annotation` 等重复实现时：门禁必须失败（Fail-Fast，不允许兜底通过）。

### 回归测试（可选）
- 若 lint gate 本身需要测试框架支撑，可补最小测试；否则以 gate 作为回归。

## 协作协议（并行开发提速版，必须遵守）
- 必须提交到 `anki-linkmaster-A` worktree，并给出 **commit hash**。
- 交付需写明：改动 scope、门禁命令与结果、风险点。
