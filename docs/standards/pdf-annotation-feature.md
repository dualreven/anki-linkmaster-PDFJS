# PDF Annotation Feature（pdf-viewer）面条治理说明

目标：把 `src/frontend/pdf-viewer/features/pdf-annotation/index.js` 收敛为“装配/委托层”，将大块逻辑按职责拆分为同目录小模块，降低单文件复杂度并保持对外行为不变。

## 入口与边界

- 主入口：`src/frontend/pdf-viewer/features/pdf-annotation/index.js`
- 对外导出必须保持不变：`export class AnnotationFeature` + `export default AnnotationFeature`
- 约束：
  - Fail‑Fast：非预期输入/状态必须显式失败，禁止静默兜底。
  - 事件名必须使用常量（项目 ESLint 有强约束）。

## 拆分结果（同目录模块）

### 1) PDF id 解析（纯函数，优先可测）
- `src/frontend/pdf-viewer/features/pdf-annotation/utils/annotation-pdf-id-utils.js`
  - `extractPdfId12Hex()`：从 `{filename,url}` 中提取 12-hex（用于严格契约链路补齐/断言）
- 测试：`src/frontend/pdf-viewer/features/pdf-annotation/__tests__/annotation-pdf-id-utils.test.js`

### 2) “跳转到标注”导航委托
- `src/frontend/pdf-viewer/features/pdf-annotation/annotation-feature-navigate-to-annotation.js`
  - 将原本的长方法拆为可复用的处理函数，主文件仅负责组装依赖并委托调用

### 3) 自动加载 gate（FILE.LOAD.SUCCESS / RESUME.FLOW.DONE / WS connected）
- `src/frontend/pdf-viewer/features/pdf-annotation/annotation-feature-autoload.js`
  - 将“等待事件 + 命中历史 + 幂等守卫”的装配逻辑集中管理，主文件只提供 getters/setters 与回调

### 4) 标注侧边栏 toggle 按钮
- `src/frontend/pdf-viewer/features/pdf-annotation/annotation-feature-toggle-button.js`
  - 按钮 DOM 构建与点击/快捷键相关逻辑抽离，主文件只持有引用与销毁路径

## 注意事项（强约束/易回归点）

- `src/frontend/pdf-viewer/__tests__/annotation-unify-behavior.test.js` 对 `features/pdf-annotation/index.js` 有静态字符串断言（用于约束关键逻辑仍在主文件）；因此相关片段不要随意迁移/改关键字符串。

