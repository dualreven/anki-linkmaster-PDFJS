title: 代码工件 README（模板）
author: Code-Generator
file_version: 1.0
input:
  - AITASK/.../原子任务说明.md
  - AITASK/.../测试用例说明.md
usage: 记录代码产物的构建、运行、测试、变更点及回退步骤，便于 Job-Executor / Test-Verifier 使用
```

# 概要
简要说明工件目的、模块功能与边界。说明工件由何种输入生成（参见元数据中的 `input` 字段），以及面向的使用者（如 Job-Executor、Test-Verifier、维护者等）。

## 构建
- 依赖：列出构建时必须安装的依赖（语言运行时、包管理器、系统依赖等）。
- 构建步骤示例：
```bash
# 安装依赖
npm install
# 构建产物
npm run build
```

## 运行
- 运行示例（本地）：
```bash
# 启动服务（示例）
NODE_ENV=production PORT=3000 node dist/index.js
```
- 必需环境变量：列出变量名、说明与默认值
- 端口：默认 3000（如适用）

## 配置
- 配置文件位置与示例：
```yaml
# config/example.yaml
server:
  port: 3000
  host: 0.0.0.0
database:
  url: postgres://user:pass@localhost:5432/db
```
- 各配置项说明：逐项列出字段含义、可选值与默认值

## 测试
- 单元测试：
```bash
npm run test:unit
```
- 集成测试：
```bash
npm run test:integration
```
- 测试覆盖率检查：
```bash
npm run test:coverage
```

## 变更记录
- 本次改动摘要：简要列出本次提交或产物与上一个版本的主要差异（功能、修复、重构）。
- 关联任务/工单：引用 AITASK/... 或 issue 编号与链接。

## 已知问题与限制
- 列出当前已知的 bug、限制、性能问题与兼容性说明。
- 给出临时规避方法（如有）。

## 回退步骤
- 回退到上一个稳定版本的操作步骤（示例）：
```bash
# 使用 git 回退到上一个 tag
git checkout tags/v1.2.3 -b roll-back-to-v1.2.3
# 或使用发布包回退示例
```
- 验证回退是否成功的检查项：服务健康检查、主要接口 smoke test、关键日志确认等。

## 文件结构概览
- 列出主要文件与目录及其职责：
```
dist/           # 构建输出
src/            # 源码
config/         # 配置文件示例与模板
tests/          # 测试代码
package.json    # 构建与运行脚本入口
```

## 产物校验
- 如何验证产物正确性（功能测试点、接口契约、示例输入/输出）。
- 可运行的校验示例：
```bash
# 运行健康检查
curl -f http://localhost:3000/health || echo "健康检查失败"
```

## 维护与联系方式
- 维护者：默认填写 Code-Generator（请在必要时替换为具体人员）。
- 联系方式：列出邮件、IM 或 issue 路径，便于召回与协作。

## 参考文档与模板维护信息
- 参考：
- [`kilocode/system-prompt-code-generator`](kilocode/system-prompt-code-generator:1)
- [`docs/articles/AITASK项目工程文件目录结构.md`](docs/articles/AITASK项目工程文件目录结构.md:1)
- 模板维护说明：当模板需要更新时，请在仓库中更新本文件并在 PR 描述中说明变更内容与原因。

生成说明：
- 本模板由 [`Code-Generator`](kilocode/system-prompt-code-generator:1) 生成，用于统一 Code-Generator 输出的工件 README 结构。
- 保存位置：[`templates/代码工件_README.md`](templates/代码工件_README.md:1)