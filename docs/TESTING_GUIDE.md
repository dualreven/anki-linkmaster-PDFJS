# 测试操作指南（统一入口）

本指南阐述如何在本仓库中选择性地运行单元测试、集成测试、端到端测试（E2E）与冒烟测试。所有命令均默认在仓库根目录执行，并显式使用 UTF-8 与 `\n` 行尾规范（与代码库一致）。

## 目录结构（约定）
- Python（后端）：`tests/`、`__tests__/`
- 前端（Jest）：`src/frontend/**/__tests__`
- 协议级 E2E（HTTP，仅后端文件服务器）：`tests/e2e/**`

标记（pytest.ini 已声明）：
- `smoke`：冒烟
- `integration`：集成
- `e2e`：端到端

## 快速开始
- 安装依赖
  - Python：确保虚拟环境已安装 `pytest`；运行命令将通过 `PYTHONPATH=.` 指向仓库根
  - Node：使用 `pnpm i`

## 选择性运行（Python/pytest）
- 全量后端测试
```
PYTHONPATH=. pytest -q
```
- 冒烟
```
PYTHONPATH=. pytest -m smoke -q
```
- 集成
```
PYTHONPATH=. pytest -m integration -q
```
- 端到端（协议级 HTTP E2E）
```
PYTHONPATH=. pytest -m e2e tests/e2e/test_ws_http_protocol_e2e.py -q
```
- 指定测试文件
```
PYTHONPATH=. pytest -q tests/backend/test_static_path_resolution.py
```

## 选择性运行（前端/Jest）
- 全量
```
pnpm test
```
- 单个测试文件
```
pnpm jest --runTestsByPath src/frontend/pdf-home/features/add-files/__tests__/file-selector.e2e-stub.test.js
```
- 冒烟
```
pnpm run test:smoke
```

## 协议级 E2E（HTTP）说明
- 用途：验证后端 `pdfFile_server` 在“严格策略（禁止回退/兜底）”下的端到端行为（健康、重定向、静态路由、资源改写、/pdfs/* 服务）
- 位置：`tests/e2e/test_ws_http_protocol_e2e.py`
- 运行：
```
PYTHONPATH=. pytest -m e2e tests/e2e/test_ws_http_protocol_e2e.py -q
```
- 报告：`AItemp/reports/e2e/http/`（自动生成）
- 机制：夹具 `tests/e2e/conftest.py` 启动内置 `HttpFileServer`（非阻塞）并将 `DEFAULT_DIST_DIR` 指向临时目录，避免污染仓库 `dist/`

## 浏览器端 E2E（方案一：FileSelector 注入）说明
- 背景：pdf-home 通过 QWebChannel 调用 PyQt 的 `QFileDialog` 打开原生文件对话框，浏览器自动化无法直接控制；本方案在测试模式显式启用 Stub
- 实现：`src/frontend/pdf-home/features/add-files/file-selector.js`
  - 生产：`getFileSelector({ bridgeFactory })` 走 QWebChannel；若不可用，直接抛错（Fail‑Fast）
  - 测试：显式开启 E2E 模式后，Stub 从 `window.__E2E_TEST_FILES__` 返回文件路径数组，缺失则抛错（无兜底）
- Playwright 示例（伪代码）：
```js
import { test, expect } from '@playwright/test';

test('添加文件（E2E Stub）', async ({ page }) => {
  await page.addInitScript(() => {
    window.__E2E_FILE_SELECTOR__ = true;
    window.__E2E_TEST_FILES__ = ['C:\\\\tmp\\\\a.pdf', 'C:\\\\tmp\\\\b.pdf'];
  });
  await page.goto('http://127.0.0.1:8080/pdf-home/?e2e=1');
  await page.getByRole('button', { name: '添加文件' }).click();
  // 断言 UI 或消息发送
});
```

### 浏览器端 E2E（Playwright）运行
- 首次安装依赖
```
pnpm i
```
- 运行 pdf-home 添加PDF 端到端用例
```
pnpm run e2e:browser
```
- 说明
  - 用例位置：`tests/e2e/browser/pdf-home-add-files.e2e.spec.mjs`
  - 使用内置轻量静态服务器（严格 404，无兜底），映射 `/pdf-home` 与相关 `assets/js`
  - 通过 `page.addInitScript` 显式注入 `__E2E_TEST_FILES__`，校验 `websocket:message:send` 出站消息契约

## 原则（Fail‑Fast）
- 禁止回退与兜底。若静态资源缺失、QWebChannel 不存在或必需数据无效，测试与系统都必须立即失败并输出清晰错误信息与日志。
- 所有文件读写显式 UTF‑8，行尾 `\n`；路径选择使用临时目录，禁止污染仓库根。

## CI 建议
- Job 分层：后端 pytest（含 E2E）→ 前端 Jest →（可选）Playwright UI E2E
- 产物：归档 `AItemp/reports/e2e/**`、pytest JUnit、Playwright trace/screenshot
