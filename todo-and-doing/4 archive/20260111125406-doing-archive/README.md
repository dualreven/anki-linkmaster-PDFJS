# 20260111125406-doing-archive

## 归档内容（v007：NCS 空白/未注册修复）

- 任务目录：
  - `20260111021732-ncs-entrypoint-call-bootstrap-F`
  - `20260111021732-ncs-ws-host-ipv4-legacy-feature-G`
  - `20260111021732-ncs-ws-host-ipv4-main-H`
  - `20260111021732-ncs-entrypoint-bootstrap-mount-test-I`

## 验收结论

- 已合入 `main`：
  - 入口修复：`index.js` 调用 `bootstrapNewCardSchedulerAppFeature(...)`，不再仅 import `main.js`。
  - WS 默认 loopback：`ws://127.0.0.1:<port>`（legacy feature + main createApp）。
  - 回归测试：新增 `entrypoint-bootstrap-mount` / `legacy-ws-host` / `main-ws-host` 契约测试并通过。
- 备注（隔离性问题）：
  - I 的交付提交 `dc7d6bfc` 实际修改了 `index.js` 并引入测试专用分支（`__NCS_TEST_BOOTSTRAP__`），与 F 的 scope 重叠且偏离“入口走 bootstrap”的目标，因此 **未合入 main**；以 F 的实现为准。

## 验收命令

- `pnpm -s run lint`
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/entrypoint-index-html.contract.test.js src/frontend/new-card-scheduler/__tests__/bootstrap-runner.contract.test.js src/frontend/new-card-scheduler/__tests__/main-export.contract.test.js src/frontend/new-card-scheduler/__tests__/bootstrap-lifecycle.contract.test.js src/frontend/new-card-scheduler/__tests__/entrypoint-bootstrap-mount.contract.test.js src/frontend/new-card-scheduler/__tests__/legacy-ws-host.contract.test.js src/frontend/new-card-scheduler/__tests__/main-ws-host.contract.test.js -i`

