# Working Log — features 命名统一

时间：2025-11-01 17:40:59

目标
- 统一 `src/frontend/pdf-viewer/features/` 命名与分层；首批聚焦：`annotation → pdf-annotation`、`pdf-ui → 并入 ui-manager`。

现状与结论（简）
- `pdf-*` 与非 `pdf-*` 前缀并存；`annotation` 归属 PDF 业务域但未带前缀；`pdf-ui` 与 `ui-manager` 语义重叠。
- 建议按“业务/核心/装配/UI/适配”分层前缀统一，先引入 `features/registry` 聚合导出，逐步迁移。

计划（见 v001-spec.md）
- 阶段0：registry 引入与外部引用收敛；
- 阶段1：annotation 重命名与代理；
- 阶段2：pdf-ui 合并入 ui-manager；
- 阶段3（可选）：search 归属评估。

待办
- [ ] 新增 features/registry.js 并补单测；
- [ ] 扫描并替换外部直接引用为 registry；
- [ ] annotation → pdf-annotation（目录与测试引用迁移；旧目录留代理，标注 deprecated）；
- [ ] 评估并合并 pdf-ui → ui-manager；旧目录留代理；
- [ ] 加 ESLint 规则：业务域 Feature 需用 `pdf-` 前缀；
- [ ] 更新相关文档与 memory bank。

