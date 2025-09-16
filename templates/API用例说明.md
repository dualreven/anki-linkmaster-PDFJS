---
title: "API 用例说明模板"
author: "Your Name  # 填写作者姓名，示例：张三"
file_version: "0.1.0  # 模板版本号，示例：0.1.0"
input:
  - "需求文档: [`docs/requirements/需求说明.md`](docs/requirements/需求说明.md:1)  # 示例相对路径"
  - "原子任务说明: [`AITASK/atomic-tasks/任务说明.md`](AITASK/atomic-tasks/任务说明.md:1)"
  - "架构说明: [`docs/architecture/架构说明.md`](docs/architecture/架构说明.md:1)"
  - "规范说明: [`docs/SPEC/规范说明.md`](docs/SPEC/规范说明.md:1)"
  - "版本说明: [`docs/CHANGELOG.md`](docs/CHANGELOG.md:1)"
usage: |
  本模板用于 Code-Generator / Test-Designer / Spec-Designer 三类工具：
  - Code-Generator：根据端点示例与 JSON Schema 片段生成客户端/服务端桩代码与 OpenAPI 片段。
  - Test-Designer：从契约测试点与示例自动生成契约/集成测试用例。
  - Spec-Designer：用于将端点描述和 schema 同步到规范仓库并更新 SPEC-HEAD 索引。
generated_time: "YYYYMMDDhhmmss  # 生成时由脚本替换，例如 20250827223203"
source_inputs:
  - path: "AITASK/[序号]/tasks.md  # 列出本次生成所依据的原子任务或输入清单"
    note: "列出任务ID与简短说明"
---

# API 用例说明（模板）

> 说明：本模板用于描述单个或一组 API 的用例、契约信息与测试要点。所有路径均为相对路径并以可点击格式呈现，方便在仓库内跳转与引用。

## 1 概要（Summary）

- 文档目的：描述 API 的用途、契约规则与测试要点，便于 Code-Generator、Test-Designer、Spec-Designer 使用与校验。
- 适用范围：列出本文覆盖的服务/模块或 API 集合，例如模块名或路径。
- 目标读者：开发（开发者/维护者）、测试（测试工程师/自动化）、验证（QA）、Spec-Designer。

> 填写提示：在此处写明“此文档覆盖的服务/模块”、“主要变更点摘要”与“约束或假设（如认证要求、下游能力等）”。

## 2 API 列表（API Index）

请以表格形式列出全部相关 API（若较多可分章节或分页）。

| API ID | Path | Method | Summary | Auth Required | Criticality | Related AtomicID / MacroID |
|---|---|---:|---|---|---|---|
| e.g. api.getItems | `/api/v1/items` | GET | 获取项列表 | Yes | High | `AT-123` / `MACRO-4` |

填写说明：
- API ID：唯一标识，格式建议小写点分隔，如 `api.getItems`。
- Path：相对路径示例，必须以 `/` 开头，例如 [`/api/v1/items`](api/v1/items:1) 或仓库内模块路径如 [`modules/item-service`](modules/item-service:1)。
- Method：HTTP 方法（GET/POST/PUT/PATCH/DELETE）。
- Summary：一句话描述该接口用途。
- Auth Required：Yes/No，并说明鉴权方式（例如 OAuth2 / JWT / API-Key）。
- Criticality：Low/Medium/High，标注关键程度。
- Related AtomicID / MacroID：列出需求或原子任务 ID，便于 Traceability。

## 3 端点详细说明（Endpoint Detail Template）

对每个 API 使用下列结构化段落描述。建议每个字段严格填写，便于机器解析。

### API ID / Name
- 示例：`api.getItems`

### Path & Method
- 示例：`GET /api/v1/items`

### 描述（用途）
- 用途：简要说明该端点解决的问题及使用场景。

### 权限/鉴权（Auth）
- 描述鉴权方式、权限粒度、必要 Header（例如 Authorization: Bearer <token>）。

### 请求（Request）

#### Headers
- 必需：
  - `Authorization: Bearer <token>` — 说明：用于鉴权；示例：`Authorization: Bearer eyJ...`。
- 可选：
  - `X-Request-ID` — 说明：幂等追踪；示例：`abcdef-12345`。

#### Query 参数
| 名称 | 类型 | 必填 | 说明 | 示例 |
|---|---:|---:|---|---|
| page | integer | 否 | 页码 | 1 |
| size | integer | 否 | 每页条数 | 20 |

#### Body（适用于 POST/PUT/PATCH）
- 描述 Body 的 JSON Schema 或引用 schema 文件：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string", "example": "示例名称" },
    "quantity": { "type": "integer", "minimum": 0 }
  },
  "required": ["name"]
}
```

> 提示：将完整 schema 保存为 `AITASK/[序号-项目名]/v[版本号]/schemas/[接口名]-schema.json`，并在规范目录同步引用。

### 响应（Response）

#### 成功响应示例
- HTTP 状态码：200
- Body（JSON 示例）：

```json
{
  "items": [
    { "id": "item-1", "name": "示例项", "quantity": 10 }
  ],
  "page": 1,
  "size": 20,
  "total": 100
}
```

#### 错误响应示例
| 状态码 | 错误码 | 说明 |
|---:|---|---|
| 400 | INVALID_REQUEST | 请求参数不合法 |
| 401 | UNAUTHORIZED | 鉴权失败 |
| 500 | INTERNAL_ERROR | 服务端异常 |

### 成功条件与边界（Behavioral Notes）
- 列出契约行为，如排序、去重、默认值、时序约束等。

### 性能/约束（Performance / Limits）
- 限流：例如 `100 r/s per IP`。
- 最大 payload：例如 `max request body 2MB`。

### 关联规范条目
- 在此列出并链接到具体规范文档或条目，例如：
  - [`docs/SPEC/响应规范.md`](docs/SPEC/响应规范.md:1)
  - [`AITASK/123-module/规范说明.md`](AITASK/123-module/规范说明.md:1)

### 对应测试点（Test Points）
- 示例：
  - Contract: fields present, types correct.
  - Error: invalid page/size -> 400 INVALID_REQUEST.
  - Boundary: size=0, size=max -> behavior.

> 提示：为 Test-Designer 准备可机读映射（见第6节）。

## 4 Request/Response Schema（结构化约定）

- 建议使用 JSON Schema 或 OpenAPI schema 片段，统一放置在规范目录并同步到 SPEC-HEAD 索引。

示例 OpenAPI 片段（占位）：

```yaml
openapi: 3.0.3
components:
  schemas:
    Item:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
          example: "示例项"
      required:
        - id
```

同步提示：
- 在规范仓库添加或更新 schema 文件后，同时更新 `SPEC-HEAD` 索引文件（例如：`docs/SPEC/SPEC-HEAD.md`）。

## 5 正向/反向用例示例（Positive / Negative Examples）

### 正向示例 1
- 请求：

```http
GET /api/v1/items?page=1&size=20 HTTP/1.1
Host: example.com
Authorization: Bearer eyJ...
```

- 响应（成功）：

```json
{
  "items": [{"id":"item-1","name":"示例项","quantity":10}],
  "page":1,"size":20,"total":100
}
```

### 反向示例（错误场景）
- 请求缺少鉴权：

```http
GET /api/v1/items HTTP/1.1
Host: example.com
```

- 响应：

```json
{
  "code": "UNAUTHORIZED",
  "message": "缺少 Authorization header"
}
```

## 6 契约测试要点（Contract Test Points）

为每个端点列出必须验证的契约点，并提供机器可读映射（JSON 或表格）。

示例表格：
| Test Point ID | Field / Path | Check Type | Expected | Notes |
|---|---|---|---|---|
| TP-001 | `items[].id` | exists & type | string | 主键存在且为字符串 |
| TP-002 | `items` | type | array | 返回数组 |

机器可读 JSON 映射示例：

```json
[
  { "id": "TP-001", "path": "items[].id", "check": "exists|type:string" },
  { "id": "TP-002", "path": "items", "check": "type:array" }
]
```

提示：
- Test-Designer 可直接读取该 JSON 映射并生成契约测试用例。

## 7 版本与变更记录（Versioning & Changelog）

- 变更记录格式建议：
  - 日期 (YYYY-MM-DD) | 版本 | 作者 | 变更摘要 | 关联任务ID

示例：
- `2025-08-27 | 0.1.0 | 张三 | 初版模板 | AITASK-001`

版本管理要点：
- API 向后兼容时使用次版本号；不兼容变更时增大主版本号并记录迁移说明。

## 8 依赖与外部系统（Dependencies）

- 列出下游系统、第三方服务、消息队列、数据库等依赖，并给出 mock 建议。

示例表：
| Dep ID | 名称 | 类型 | Mock 建议 | 说明 |
|---|---|---|---|---|
| DEP-1 | Auth Service | HTTP | 使用本地 stub 返回 token | 用于鉴权 |

## 9 合规/安全提示（Security & Compliance Notes）

- 敏感字段处理：不要在日志中记录完整身份证号、卡号等；应做脱敏或哈希处理。
- 日志策略：请求/响应中记录必要追踪信息（X-Request-ID），并对敏感字段脱敏。
- 认证/授权：推荐使用 OAuth2 / JWT，说明 token 生命周期与刷新策略。

## 10 输出/交付物（Outputs）

建议的输出路径示例（生成器可用作目标）：
- `AITASK/[序号-项目名]/v[版本号]/[任务组别编号]/[YYYYMMDDhhmmss]-API用例说明.md`
- 模块规范示例：`[模块]/docs/SPEC/[范畴]-API-[序号].md`
- OpenAPI/JSON Schema 示例路径：`AITASK/[序号-项目名]/v[版本号]/openapi/[YYYYMMDD]-openapi.yml`

> 填写提示：生成时替换占位符，确保路径在仓库内可解析为相对路径并提交到对应分支。

## 11 验收与通过标准（Acceptance Criteria）

- 每个关键接口至少包含：
  - 一个正向契约测试；
  - 一个负向契约测试（常见错误/鉴权失败/非法参数）；
  - 示例 JSON Schema 与示例数据通过 jsonschema 验证器。
- 所有引用的 schema 文件存在并可通过规范验证流程（Spec-Designer）。

## 12 示例/填表示例（Templates）

下面提供一个完整端点的可复制模板，便于直接填入真实内容并用于自动化处理。

### 端点模板（可复制）

```md
### API ID / Name: api.getItems

Path & Method: GET /api/v1/items

描述：获取商品列表

Auth: Authorization: Bearer <token>（必须）

Request:
Headers:
- Authorization: Bearer <token>
- X-Request-ID: 可选

Query:
- page: integer, optional, 示例: 1
- size: integer, optional, 示例: 20

Response 200:
{
  "items": [ { "id": "item-1", "name": "示例项", "quantity": 10 } ],
  "page": 1, "size": 20, "total": 100
}

Errors:
- 400 INVALID_REQUEST
- 401 UNAUTHORIZED

Test Points:
- TP-001 items[].id exists & string
- TP-002 items is array
```

## 13 参考（References 与摘录）

以下为必须引用的参考资料（以相对路径可点击格式列出）并摘录关键要点：

- [`docs/articles/AITASK项目工程文件目录结构.md`](docs/articles/AITASK项目工程文件目录结构.md:1)
  > 要点摘录：说明 AITASK 目录如何组织产物、版本、schema 与规范索引（SPEC-HEAD）。

- [`docs/articles/开发流程设计.md`](docs/articles/开发流程设计.md:1)
  > 要点摘录：描述从任务链到接口用例再到代码/测试生成的工作流，强调 Traceability。

- [`kilocode/system-prompt-spec-designer`](kilocode/system-prompt-spec-designer:1)
  > 要点摘录：Spec-Designer 使用规范同步与索引更新的行为准则。

- [`kilocode/system-prompt-test-designer`](kilocode/system-prompt-test-designer:1)
  > 要点摘录：Test-Designer 如何根据契约映射生成测试用例与验收标准。

- 可选：
  - [`kilocode/system-prompt-code-generator`](kilocode/system-prompt-code-generator:1)
  - [`kilocode/system-prompt-spec-verifier`](kilocode/system-prompt-spec-verifier:1)

> 提示：在引用位置插入链接并在生成脚本中确保目标文件存在.

---

## 完整端点示例（示例填充，供拷贝使用）

### API ID / Name: api.createItem

Path & Method: POST /api/v1/items

描述：创建一个新商品项

Auth: Authorization: Bearer <token>（必须；需 admin 权限）

Request:
Headers:
- Authorization: Bearer <token>
- Content-Type: application/json

Body (JSON Schema):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "price": { "type": "number", "minimum": 0 },
    "tags": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["name","price"]
}
```

成功响应示例：

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "item-123",
  "name": "新商品",
  "price": 9.99
}
```

错误响应示例：

```json
{
  "code": "INVALID_REQUEST",
  "message": "price 必须为非负数"
}
```

契约测试点（Machine-readable 映射）：

```json
[
  { "id": "TP-101", "path": "id", "check": "exists|type:string" },
  { "id": "TP-102", "path": "name", "check": "exists|type:string" },
  { "id": "TP-103", "path": "price", "check": "exists|type:number|minimum:0" }
]
```

实现/同步提示：
- 将 schema 保存为：`AITASK/001-项目名/v1/schemas/create-item-schema.json`
- 将端点说明提交到模块规范：`modules/item-service/docs/SPEC/item-API-01.md`

---

模板结束。请将本文件作为 `templates` 目录下的基础模板，Code-Generator / Test-Designer / Spec-Designer 可据此生成真实产物并替换元数据字段。