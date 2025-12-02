# 自动文档生成指南（前后端注释 → HTML 文档）

> 目标：在不强行改动构建流程的前提下，利用现有 JSDoc / Python docstring 把「关键模块的接口说明」自动导出为 HTML 或 Markdown 文档，方便查阅与对齐实现。

---

## 1. 范围与优先级

首批建议纳入自动文档的代码文件：

- 前端 common / infra
  - `src/frontend/common/event/event-bus.js`
  - `src/frontend/common/ws/ws-client.js`
  - `src/frontend/common/ws/ws-gate-utils.js`
  - `src/frontend/common/ws/ws-gate-runner.js`
- 前端 pdf-viewer
  - `src/frontend/pdf-viewer/container/app-container.js`
  - `src/frontend/pdf-viewer/adapters/websocket-adapter.js`
  - `src/frontend/pdf-viewer/adapters/ws-inbound-bridge.js`
- 前端 pdf-home
  - `src/frontend/pdf-home/container/app-container.js`
- 后端
  - `src/backend/msgCenter_server/standard_server.py`
  - `src/backend/pdfFile_server/embed_fileserver.py`
  - `src/backend/launcher.py`

这些文件已经具备较完整的头注释/类注释/docstring，适合作为自动文档的“第一批输出对象”。

---

## 2. 前端：基于 JSDoc 生成文档（设计方案）

### 2.1 推荐工具

- 工具：`jsdoc`（Node 生态中最常用的 JS 文档生成器）
- 输入：带 `/** ... */` 块注释的 ES 模块（本项目已有大量 JSDoc 风格注释）
- 输出：HTML 文档（默认），可配置输出到 `AItemp/docs/frontend-api` 等临时路径

### 2.2 最小配置示例（不直接写入 package.json，仅供参考）

1）安装（在本地开发环境执行一次）：

```bash
pnpm add -D jsdoc
```

2）在项目根目录新增 `jsdoc.config.cjs`（示例）：

```js
module.exports = {
  source: {
    include: [
      "src/frontend/common/event/event-bus.js",
      "src/frontend/common/ws/ws-client.js",
      "src/frontend/common/ws/ws-gate-utils.js",
      "src/frontend/common/ws/ws-gate-runner.js",
      "src/frontend/pdf-viewer/container/app-container.js",
      "src/frontend/pdf-viewer/adapters/websocket-adapter.js",
      "src/frontend/pdf-viewer/adapters/ws-inbound-bridge.js",
      "src/frontend/pdf-home/container/app-container.js"
    ],
    includePattern: ".js$"
  },
  opts: {
    destination: "AItemp/docs/frontend-api",   // 输出目录（不污染根目录）
    recurse: false,
    encoding: "utf8"
  },
  plugins: [],
  templates: {
    default: {
      includeDate: false
    }
  }
};
```

3）在 `package.json` 中（由维护者手动）新增脚本（建议，不在本指南中自动修改）：

```jsonc
{
  "scripts": {
    "docs:frontend": "jsdoc -c jsdoc.config.cjs"
  }
}
```

4）生成文档：

```bash
pnpm run docs:frontend
```

生成后可在浏览器中打开 `AItemp/docs/frontend-api/index.html`，查看 event-bus、ws-client、websocket-adapter 等模块的文档。

> 注意：
> - 本项目 JS 已经使用 JSDoc 风格注释（如 `@file/@module/@class/@param/@returns`），jsdoc 可以直接解析。
> - 某些文件（如 `ws-client.js`）当前只有简短头注释，生成的文档会较为粗略；后续如有需要，可以逐步补齐方法级 `@param/@returns` 注释。

---

## 3. 后端：基于 Python docstring 生成文档（pdoc 方案）

### 3.1 推荐工具

- 工具：`pdoc`（轻量级 Python 文档生成器）
- 输入：带模块 docstring / 函数 docstring / 类 docstring 的 `.py` 文件
- 输出：HTML 文档，可输出到 `AItemp/docs/backend-api`

### 3.2 安装与命令建议

1）在项目虚拟环境中安装：

```bash
python -m pip install pdoc
```

2）生成后端核心模块文档（示例命令）：

```bash
python -m pdoc \
  src.backend.msgCenter_server.standard_server \
  src.backend.pdfFile_server.embed_fileserver \
  src.backend.launcher \
  --html \
  --output-dir AItemp/docs/backend-api \
  --force
```

生成后可以在浏览器打开：

- `AItemp/docs/backend-api/src/backend/msgCenter_server/standard_server.html`
- `AItemp/docs/backend-api/src/backend/pdfFile_server/embed_fileserver.html`
- `AItemp/docs/backend-api/src/backend/launcher.html`

> 提示：
> - 模块路径使用 `.` 而非 `/`，示例中假定项目根在 `src` 之上（本仓库结构满足这个前提）。
> - 如果需要与 Sphinx 集成，可在后续迁移到统一的文档站点，此处先选择 pdoc 作为轻量起点。

---

## 4. 现有注释的适配性评估（简要）

根据前一轮检查，关键文件的注释情况大致如下：

- 适配性很高（几乎开箱即用）：
  - `src/frontend/common/event/event-bus.js`：有 `@file/@module` 头注释与详细类说明。
  - `src/frontend/pdf-viewer/container/app-container.js`：文件头 + `createPDFViewerContainer` 的完整 JSDoc。
  - `src/frontend/pdf-viewer/adapters/websocket-adapter.js`：`@file/@module/@class` + 示例用法，非常适合生成文档。
  - `src/backend/msgCenter_server/standard_server.py`：模块 docstring + 函数 docstring 较完善。
  - `src/backend/pdfFile_server/embed_fileserver.py`：长模块 docstring + 类 docstring，相当于一篇小型设计文档。
  - `src/backend/launcher.py`：模块 docstring + 核心函数 docstring。

- 基础可用，但信息较少：
  - `src/frontend/common/ws/ws-client.js`：只有简短的头注释和类名，缺少方法级 JSDoc。
  - `src/frontend/pdf-home/container/app-container.js`：核心工厂函数有 JSDoc，但文件级 `@file` 注释较弱，内部 helper 主要靠命名自解释。

后续如果希望自动文档更“对称”，可以优先在这些文件的公共 API 上补充：

- `@param` / `@returns` / `@throws` 等标签；
- 对关键内部 helper（例如 event bridge / gate runner）补上一句简短说明。

---

## 5. 建议的落地步骤（给人看的 TODO）

1. 由维护者评估并决定是否引入 `jsdoc` / `pdoc` 作为正式依赖（可以先在本地实验）。
2. 创建 `jsdoc.config.cjs`，并将 `docs:frontend` 脚本手动加入 `package.json`。
3. 在 Python 虚拟环境中安装 `pdoc`，并在 `docs/engineering/` 中补充一条简单命令脚本（或 Makefile 片段）。
4. 在 CI 或本地开发流程中，视需要增加：
   - 手动命令：`pnpm run docs:frontend`、`python -m pdoc ...`
   - 或在某个文档构建 job 中统一生成静态 HTML 再上传/浏览。
5. 后续如要扩展覆盖范围，可以按“文件是否已有规范注释”逐步加入更多模块，而不是一次性全仓库生成。

本指南仅给出“如何利用现有注释生成文档”的最小路径，不主动修改 package.json / requirements.txt，以避免对现有构建与依赖产生干扰。真正落地时，请由人类维护者按实际需要选择性采纳。

