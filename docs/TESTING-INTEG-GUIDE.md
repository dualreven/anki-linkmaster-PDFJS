# 集成测试指南（integ + 契约）

本指南定义跨语言、跨模块的“步骤化集成测试”方法论与落地规范，并包含契约测试（contract test，简称 ct）。

## 分段式链路拆解（通用规则）
为避免用单个“大而全”的测试跨越多层导致不稳定、难定位的问题，我们将一个完整功能拆解为“前端段 / 后端段”的交替序列，每段各自只验证自己的职责，并以工件（artifact）把结果传递给下一段。以下为通用五段模板（以 pdf‑viewer 的大纲初始化为例，但适用于任何功能域）：

1) 前端段 F1（事件起点）
- 触发条件：上游 UI/模块已完成“前置事件”（通常是 FILE.LOAD.SUCCESS）；此处可 Mock 前置事件，不引入浏览器或 UI。
- 行为：前端发出请求（例如 pdf‑viewer:outline-list:request）。
- 断言：请求的事件名、载荷、request_id 合规。
- 产物：step‑F1.json（包含 request_id、事件名、载荷预览）。

2) 后端段 B2（转发与查询）
- 上游来源：读取 F1 的产物并“重放”同一请求（request_id 一致）。
- 行为：msgcenter 接收请求 → 转发给后端服务 → 调用数据库（此段可对数据库 Mock）→ 返回结果（例如 outline_items = null）。
- 断言：转发正确（事件名、字段、关联 id）；返回结果符合“空值”语义。
- 产物：step‑B2.json（包含 inbound/outbound 摘要、最终响应）。

3) 前端段 F3（结果驱动的后续动作）
- 上游来源：读取 B2 的结果（null 或数据），作为前端的“起点事件”。
- 行为：当结果为 null 时，前端从 PDF native 结构提取大纲，转换为统一 items；发出保存请求（例如 pdf‑viewer:outline-bulk-save:request）。
- 断言：items 非空且字段齐备；请求事件与映射契约一致。
- 产物：step‑F3.json（包含 items 计数、关键字段截取）。

4) 后端段 B4（保存与回执）
- 上游来源：读取 F3 的保存请求。
- 行为：msgcenter → 后端 → 数据库（可 Mock 持久化层），完成保存并回执成功消息与 outline 数据（或服务器生成 id）。
- 断言：转发正确；数据库调用/Mock 的输入符合预期；回执事件与负载契约一致。
- 产物：step‑B4.json（包含保存计数/生成 id 摘要、最终回执）。

5) 前端段 F5（渲染与完成）
- 上游来源：读取 B4 的成功消息与数据，作为“来自服务端的事件”。
- 行为：前端接收并渲染（如替换内存树、更新 UI 状态），发射“完成事件”（例如 outline:render:completed 或域内自定义完成信号）。
- 断言：内存数据结构正确、节点数>0、完成事件发射成功（如有）。
- 产物：step‑F5.json（包含渲染后内存快照摘要、完成事件证据）。

通用约束：
- “只测本段”：前端段仅 Mock 后端输入/输出；后端段仅 Mock 数据库/外部依赖；不跨界验证别人的实现细节。
- “事件贯穿一致”：每段都要校验事件名三段式和 request_id 贯穿；映射关系从 tests/e2e/config/event-mapping.json 读取。
- “结果传递”：上一段的核心输出（事件与负载）必须写入产物，下一段以此为输入进行重放/验证。

## 1. 适用场景
- 验证前端→协议→后端任一单段或相邻两段的协作正确性。
- 验证消息/事件的命名、字段、流向与约束（契约测试）。
- 不拉起完整 UI（不使用浏览器）；更快、更可定位问题。

## 2. 命名与命令
- 前端段（Node/Jest，无浏览器）：`integ:frontend:<module>:<feature>`
- 协议/转发步骤：`integ:protocol:<module>:<feature>:relay`
- 后端断言步骤：`integ:backend:<module>:<feature>:db-assert`
- 契约测试：`ct:<domain>:<module>:<feature>`（例如 `ct:ws:pdf-home:add-pdf`）

示例（add-pdf 相关）
- `pnpm -s integ:frontend:pdf-viewer:outline-create:F1`
- `pnpm run integ:protocol:pdf-home:add-pdf:relay`
- `pnpm run integ:backend:pdf-home:add-pdf:db-assert`
- `pnpm run ct:ws:pdf-home:add-pdf`

## 3. 配置与一致性
- 不使用环境变量；统一从 `tests/e2e/config/local.json` 读取：
  - `ws_port`、`http_port`、`db_path`、`public_dir`、`python_exe`
- 事件名三段式：`{module}:{action}:{status}`；对应关系见
  - `tests/e2e/config/event-mapping.json`：`requested → {completed|failed}`
- 文本与文件：UTF-8 编码、统一 `\n` 换行；产物写入 `AItemp/`。

## 4. 目录与文件
- 前端段（Node/Jest）：`tests/e2e/node/**`（通过 `tests/e2e/runner/run-jest-step.mjs` 执行）
- 协议/转发：`tests/e2e/node/**` 或 `tests/e2e/python/msgcenter/**`
- 后端断言：`tests/e2e/python/backend/**`
- 契约校验工具：`tests/e2e/runner/contract-check.mjs`

## 5. 前后衔接（跨步骤一致性）
- 前端步骤产物：`AItemp/flows/<module>/<feature>/<run_id>/step-F1.json`
  - 关键字段：`run_id`、`request_id`、事件名、原始负载、UI 接收到的回执（如有）。
  - 同时更新 `AItemp/flows/<module>/<feature>/latest.run` 以便后续步骤复用。
- 协议步骤读取：复用 `latest.run` 指向的 `run_id`，校验日志/抓包中 `request_id` 与事件名一致。
- 后端断言读取：同一 `run_id`，并使用同名字段建立“证据链”。
- 链式传递规则（与上文五段对应）：
  - F1 → B2：把 F1 的请求事件（及其 request_id/载荷）作为 B2 的入参重放；
  - B2 → F3：把 B2 的响应结果（null/数据）作为 F3 的“起点事件”（模拟 msgcenter→前端）；
  - F3 → B4：把 F3 的保存请求作为 B4 的入参重放；
  - B4 → F5：把 B4 的保存成功消息与数据作为 F5 的“起点事件”（模拟 msgcenter→前端）。

## 6. 前端段（Node/Jest）规范
- 运行：使用 `tests/e2e/runner/run-jest-step.mjs <test-file>` 调用单条前端段用例。
- 行为：
  - 读取 `tests/e2e/config/local.json`，拼接 `ws://127.0.0.1:<ws_port>`、`http://127.0.0.1:<http_port>`；
  - 通过测试替身（event bus / ws client test double）模拟最小前端行为（不启动浏览器）；
  - 发送 `*:requested` 后，落地 `step-F1.json` 等产物；
  - 对“回执/状态”的监听仅作为证据收集，协议/后端断言在各自步骤完成。

## 7. 协议/中转步骤规范
- Node 或 Python 均可，要求：
  - 从 `latest.run` 取得 `run_id`，复核事件名、`request_id`；
  - 从服务器日志（如 `logs/ws-server.log`）或 JSONL 审计文件中定位入/出站消息；
  - 校验“入站 requested → 出站 completed/failed”是否符合 `event-mapping.json`；
  - 将校验结果写入 `step-N2.json`（或等价命名）。

## 8. 后端断言（PyTest）
- 通过 `python_exe -m pytest <case>` 运行（runner 负责调用，不需手动激活 venv）。
- 典型断言：数据库记录是否落库、字段一致性、二级索引/约束是否正确。
- 产物：`step-PY3.json`，包含 DB 关键字段快照与断言结果。

## 9. 契约测试（ct）
- 目标：在不依赖 UI 的情况下验证消息结构/命名/必填字段/取值域；建议使用 JSON Schema。
- 输入：`tests/e2e/config/event-mapping.json` + 可选 `schemas/**.json`。
- 输出：`AItemp/flows/.../step-CT.json` 或在 `AItemp/reports/**` 生成契约报告。

## 10. 产物与报告
- 每步产物统一字段：`run_id`、`step_id`、`event_name`、`request_id`（若有）、`ts_start`/`ts_end`、`pass`、`evidence`。
- 所有产物使用 UTF-8 与 `\n`，路径下保留 `latest.run` 指针。

## 11. 常见约束（WS/HTTP）
- WebSocket 消息类型及路由与后端保持一致（详见 WEBSOCKET 约定，已并入本指南与 e2e 指南）。
- HTTP 静态与数据目录由 `local.json` 提供，测试不得写死端口或路径。

## 12. 命名与脚本（建议）
- 前端段
  - `integ:frontend:<module>:<feature>:init:list-null`（对应 F1）
  - `integ:frontend:<module>:<feature>:init:bulk-save`（对应 F3）
  - `integ:frontend:<module>:<feature>:init:second-list`（对应 F5）
- 后端段
  - `integ:protocol:<module>:<feature>:init:relay-list`（对应 B2：转发 list）
  - `integ:protocol:<module>:<feature>:init:relay-bulk-save`（对应 B4：转发 bulk-save）
- 端到端编排（可选）
  - `e2e:flow:<module>:<feature>:init`：读取每段产物串联校验，并生成汇总报告。

## 13. 测试入口选择原则与测试盲区预防 ⚠️ **必读 - 避免本次 Bug**

### 13.1 核心原则：测试真实调用链

**黄金法则**：
> 测试应该覆盖**用户/系统真实触发的入口函数**，而非内部实现细节。

### 13.2 测试入口选择决策树

```
消息流：WebSocket → handle_message() → Handler → DB
              ↑                        ↑
        (必须测试)              (可选独立测试)
```

#### 决策表
| 场景 | 测试入口 | 原因 |
|------|----------|------|
| 协议/路由层 | `handle_message()` | 覆盖参数提取、Schema验证、目标检查 |
| Handler 业务逻辑 | Handler 函数 | 前提：入口层已有测试 |
| 前端 Feature | EventBus.emit() | 覆盖事件名称验证、路由 |
| 前端纯函数 | 直接调用函数 | 无依赖的工具函数 |

#### 判断方法
问自己3个问题：
1. **这个函数是用户/系统的真实入口吗？**
   - 是 → 必须从入口开始测试
   - 否 → 可以直接测试

2. **入口层有独立的测试覆盖吗？**
   - 有 → 可以跳过入口，直接测试内部
   - 无 → 必须从入口开始测试

3. **跳过入口会漏掉关键逻辑吗？**
   - 会 → 必须从入口开始测试
   - 不会 → 可以直接测试

### 13.3 典型案例：导航功能 Bug（2025-11-16）

#### 背景
- **Bug 描述**：GUI Launcher 发送的导航消息无法被正确处理
- **根本原因**：`handle_message()` 第438行的参数提取逻辑有误
- **测试盲区**：旧测试直接调用 `navigate_viewer()` Handler，跳过了 `handle_message()` 入口

#### Before（错误的测试设计）

**❌ 旧测试**：`tests/e2e/python/msgcenter/test_ws_outline_navigate_forward.py`
```python
def test_protocol_forward_ws_outline_navigate():
    # 直接调用 Handler，跳过 handle_message()
    from src.backend.msgCenter_server.handlers.pdf_viewer.viewer import navigate_viewer

    class _Ctx:
        def _forward_viewer_navigate(self, msg: dict) -> int:
            return 1

    # ❌ 直接构造 Handler 的参数格式
    payload = {
        "to": {"viewer_id": None, "pdf_uuid": "jest-pdf"},
        "target": {"type": "outline", "outline_item_id": "item-1"}
    }

    # ❌ 跳过 handle_message() 的参数提取逻辑
    res = navigate_viewer(_Ctx(), req_id, payload)

    assert res["type"] == "pdf-viewer:navigate:completed"
```

**问题**：
1. 假设 `handle_message()` 会正确提取 `to` 字段
2. 未测试新旧协议兼容性（`message.to` vs `message.data.pdf_uuid`）
3. 未测试 Schema 验证
4. 未测试目标对象存在性检查

**测试盲区**：
```python
# handle_message() 第438-441行（未被测试）
to = message.get("to")  # ← 参数提取逻辑
viewer_id = to.get("viewer_id") if to else None
pdf_uuid = to.get("pdf_uuid") if to else data.get("pdf_uuid")  # ← 兼容旧协议
```

#### After（正确的测试设计）

**✅ 新测试**：`tests/integ/python/msgcenter/test_handle_message_navigate.py`
```python
def test_scenario_1_new_protocol_with_to_field(server_with_viewer):
    """
    从真实入口测试：覆盖参数提取、路由、验证的完整流程
    """
    # ✅ 构造真实的 WebSocket 消息格式
    message = {
        "type": "pdf-viewer:navigate:requested",
        "request_id": "req_001",
        "to": {  # ← ✅ 新协议格式（顶层字段）
            "pdf_uuid": "sample",
            "viewer_id": None
        },
        "data": {
            "target": {"type": "outline", "outline_item_id": "item-1"},
            "options": {}
        },
        "metadata": {"version": "1.0.0"}
    }

    # ✅ 从真实入口开始测试
    response = server_with_viewer.handle_message(message)

    # ✅ 验证完整流程
    assert response["type"] == "pdf-viewer:navigate:completed"
    assert response["status"] == "success"

    # ✅ 验证参数提取正确
    assert response["data"]["pdf_uuid"] == "sample"

    # ✅ 验证消息转发正确
    assert len(server._forwarded_messages) == 1
    assert "to" in server._forwarded_messages[0]  # ← 新协议格式
```

**覆盖点**：
- ✅ 参数提取逻辑（`message.get("to")`）
- ✅ 新协议格式验证
- ✅ 旧协议兼容性（场景2）
- ✅ 目标不存在处理（场景3）
- ✅ 参数缺失处理（场景4）

#### 关键差异对比

| 维度 | 旧测试（❌） | 新测试（✅） |
|------|------------|------------|
| **测试入口** | `navigate_viewer()` | `handle_message()` |
| **消息格式** | Handler 内部格式 | 真实 WebSocket 消息 |
| **覆盖范围** | 仅 Handler 逻辑 | 入口 → 路由 → Handler |
| **参数提取** | 未测试 | 已测试 |
| **协议兼容** | 未测试 | 已测试（5个场景） |
| **Schema 验证** | 未测试 | 已测试 |
| **目标检查** | 未测试 | 已测试 |
| **Bug 可发现性** | ❌ 不可发现 | ✅ 可发现 |

### 13.4 测试盲区识别方法

#### 方法1：代码覆盖率热力图
```bash
# 运行覆盖率分析
pnpm test --coverage  # 前端
pytest --cov=src/backend tests/  # 后端

# 查看未覆盖的代码块
open coverage/lcov-report/index.html
```

**关注点**：
- 红色区域：完全未覆盖（高危）
- 黄色区域：部分覆盖（中危）
- **入口函数**的前10行（参数提取、验证）

#### 方法2：入口函数检查清单
对于每个公共 API 入口：
- [ ] 是否有从真实入口开始的测试？
- [ ] 参数提取逻辑是否被覆盖？
- [ ] 错误处理路径是否被测试？
- [ ] 新旧协议/格式兼容性是否验证？
- [ ] Schema/类型验证是否被测试？

#### 方法3：集成测试优先原则（金字塔反转）
```
传统测试金字塔：           集成测试优先：
     E2E                        E2E
    /   \                      /      集成  集成                  集成  集成  ← 先写集成测试
  /  |  | \        →         /  |  |  单元单元单元单元             单元单元单元单元 ← 再补充单元测试
```

**流程**：
1. **先写集成测试**：从入口到出口的完整流程
2. **检查覆盖率**：识别未覆盖的分支
3. **补充单元测试**：针对性地测试边界情况
4. **重构优化**：在测试保护下重构代码

### 13.5 协议层测试特别提醒 🔥

**协议层容易被忽视的原因**：
- 看起来简单（只是 dict 操作）
- 但实际包含复杂逻辑：
  - 字段嵌套提取（`message.to.pdf_uuid`）
  - 新旧协议兼容（`to.pdf_uuid || data.pdf_uuid`）
  - Schema 验证（必填字段、类型检查）
  - 目标对象存在性检查（严格模式）

**协议层测试覆盖清单**：
- [ ] 新协议格式（`message.to.pdf_uuid`）
- [ ] 旧协议格式（`message.data.pdf_uuid`）
- [ ] 混合格式（同时提供 `to` 和 `data`）
- [ ] 缺失必填字段（`to` 和 `data.pdf_uuid` 都没有）
- [ ] 目标不存在（404 错误）
- [ ] Schema 验证失败（400 错误）
- [ ] 异常消息格式（非 dict、缺少 `type`）

### 13.6 前端测试的入口选择

**类似原则适用于前端**：

#### ❌ 错误示例：直接调用 Feature 方法
```javascript
test('should navigate to page', () => {
  pdfViewerFeature.navigateToPage(5);  // ← 跳过 EventBus
  expect(viewer.currentPage).toBe(5);
});
```

#### ✅ 正确示例：通过 EventBus 测试
```javascript
test('should navigate to page via event', () => {
  // 通过真实入口（EventBus）触发
  eventBus.emit('pdf:navigate:requested', { page: 5 });

  // 验证事件名称格式（三段式）
  expect(eventBus.emit).toHaveBeenCalledWith(
    'pdf:navigate:completed',  // ← 必须符合 module:action:status
    expect.objectContaining({ page: 5 })
  );

  // 验证最终结果
  expect(viewer.currentPage).toBe(5);
});
```

### 13.7 测试设计反模式（Anti-patterns）

#### 反模式1：过度 Mock 导致脱离真实
```python
# ❌ 错误：Mock 了所有依赖，测试变成"假象"
def test_navigate_over_mocked():
    mock_ctx = Mock()
    mock_ctx._forward_viewer_navigate = Mock(return_value=1)
    mock_ctx._viewer_by_id = Mock(return_value={"viewer1": Mock()})
    # ... 继续 Mock 10 个依赖 ...

    res = navigate_viewer(mock_ctx, req_id, payload)
    # 测试通过，但真实环境失败
```

#### 反模式2：测试内部实现而非行为
```python
# ❌ 错误：测试私有方法
def test_internal_parse_to_field():
    result = server._parse_to_field(message)  # ← 私有方法
    assert result == {"pdf_uuid": "sample"}
```

#### 反模式3：一个测试覆盖太多场景
```python
# ❌ 错误：一个测试验证10个场景
def test_all_navigate_scenarios():
    # 新协议 + 旧协议 + 缺失参数 + 目标不存在 + ...
    # 失败时难以定位问题
```

### 13.8 快速自查清单

**开始写测试前，问自己**：
1. ✅ 我是否从真实入口开始测试？
2. ✅ 入口层的参数提取逻辑是否被覆盖？
3. ✅ 协议/格式兼容性是否被验证？
4. ✅ 错误处理路径是否被测试？
5. ✅ 测试失败时能快速定位问题吗？

**如果有任何一个答案是"否"，重新设计测试！**

---

## 📚 相关文档

- **本次 Bug 详细分析**：`AItemp/reports/bug-analysis-navigate-20251116.md`
- **AI 测试易错点**：`docs/TESTING-UNIT-GUIDE.md#🚨-AI-常犯错误`
- **单元测试指南**：`docs/TESTING-UNIT-GUIDE.md`
- **E2E 测试指南**：`docs/TESTING-E2E-GUIDE.md`
