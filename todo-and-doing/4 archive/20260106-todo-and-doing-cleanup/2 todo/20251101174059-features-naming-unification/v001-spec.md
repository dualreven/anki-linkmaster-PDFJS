# 需求规格说明 v001 — pdf-viewer/features 命名统一与分层约束

本文档定义“pdf-viewer 模块 features 目录命名统一”的范围、规则、验收标准与实施计划。所有文件均为 UTF-8，换行符 `\n`。

## 背景与问题
- 当前 `src/frontend/pdf-viewer/features/` 下存在两类命名：
  - 以 `pdf-` 开头（pdf-anchor, pdf-bookmark, pdf-manager, pdf-outline, pdf-reader, pdf-translator, pdf-ui …）
  - 非 `pdf-` 开头（annotation, app-core, core-navigation, ui-manager, sidebar-manager, url-navigation, websocket-adapter, search, text-selection-quick-actions …）
- 语义混杂：例如 `pdf-ui` 与 `ui-manager` 同属 UI 领域，命名不一致且易混淆；`annotation` 属于 PDF 业务域，却未加 `pdf-` 前缀。
- 不利于事件命名、日志模块治理与按模块 toast 策略（已新增 setToastPolicy）。

## 目标
- 统一 features 子模块的命名与分层前缀，降低认知、提升可发现性，便于治理（日志、事件、toast）。
- 在不破坏现有功能的前提下，渐进式迁移（提供过渡别名/代理导出）。

## 范围（仅限 pdf-viewer/features）
- 目录命名、入口导出路径、import 引用路径、文档与测试引用。
- 不涉及功能实现变更（除必要的代理导出与 registry 引入）。

## 命名与分层规则（统一约定）
- 目录一律 `kebab-case`（已有约定，继续遵循）。
- 前缀分层：
  - 业务域（直接操控 PDF 内容/DB 的特性）：`pdf-*`
    - 示例：pdf-annotation（重命名自 annotation）、pdf-anchor、pdf-bookmark、pdf-outline、pdf-translator、pdf-reader、pdf-manager
  - 核心/基础设施：`core-*`（例如现有 core-navigation）
  - 应用/装配层：`app-*`（例如 app-core）
  - UI 管理与容器：`ui-*`（例如 ui-manager；pdf-ui 将合并/废弃）
  - 适配层：`*-adapter`（例如 websocket-adapter）
  - 动作型/独立功能：保留现名（如 text-selection-quick-actions），不与上述前缀冲突即可

## 统一清单（首批）
- annotation → pdf-annotation（高优先级）
- pdf-ui → 合并入 ui-manager（中优先级，pdf-ui 为占位/过薄实现）
- search：若仅在 viewer 内使用，可后续评估为 pdf-search；当前保持不动（低优先级，待评估）

## 兼容策略（避免一次性破坏）
1) 引入 features/registry 作为“唯一入口导出”，业务方从 registry 获取 Feature，而非分散直引路径；
2) 目录改名后，在旧目录下保留“薄代理 index.js”，仅 `export * from '../<new>/index.js'`，并在文件头标注 `@deprecated`；
3) 在 1~2 个版本周期内清理旧路径引用与代理。

## 实施计划（分阶段）
- 阶段0（入口冻结，减小震荡面）
  - 新增 `src/frontend/pdf-viewer/features/registry.js`，集中导出各 Feature；
  - 在外部引用处替换为从 registry 导入（PR 尽量小步快跑）。
- 阶段1（annotation 重命名）
  - 目录 `features/annotation` → `features/pdf-annotation`；
  - `features/annotation/index.js` 改为薄代理（deprecated）；
  - 更新 registry 指向新路径；
  - 扫描与修复测试、文档引用。
- 阶段2（pdf-ui 合并入 ui-manager）
  - 评估 pdf-ui 的有效代码并迁入 ui-manager；
  - `features/pdf-ui/index.js` 改为薄代理（deprecated），标注迁移说明；
  - 清理重复职责与文档。
- 阶段3（可选）
  - 评估 search 的域归属，必要时迁为 pdf-search；否则保持现状并在文档声明边界。

## 验收标准
- 目录命名符合分层规则；
- 所有特性可通过 registry 成功获取；
- 旧路径在迁移窗口内仍可使用，但 CI/Lint 警告（deprecated）；
- dist/latest/logs 中无新的报错；单测/冒烟通过。

## 开发与测试要求
- 显式 UTF-8 编码与 `\n`；严禁兜底；
- 先补 tests：
  - registry 导出与 import 路径解析的单测；
  - 旧路径代理导出的单测（确保兼容）；
- 提交策略：小步、可回滚；每步提交更新 AItemp/AI-Working-log 记录。

## 风险与回退
- 风险：引用面广导致漏改 → 通过 registry 先“聚合入口”降低风险；
- 回退：保留旧目录代理；必要时回滚特定阶段改名；

## 相关文档
- `.kilocode/rules/memory-bank/architecture.md` — 命名与 IO 规范（kebab-case）
- `.kilocode/rules/memory-bank/tech.md` — Logger/Toast 治理（setToastPolicy 等）

