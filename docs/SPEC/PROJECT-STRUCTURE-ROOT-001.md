<![CDATA[<!-- PROJECT-STRUCTURE-ROOT-001.md -->
- **规范名称**: 项目根目录结构规范
- **规范描述**: 定义项目根目录的标准组织结构，确保所有项目成员能够快速定位和理解各个目录的用途，保持项目结构的一致性和可维护性。
- **当前版本**: 1.0
- **所属范畴**: 文件规范
- **适用范围**: 所有项目的根目录组织结构
- **详细内容**:
  1. `src/` 目录存放所有源代码文件
  2. `docs/` 目录存放项目文档和规范
  3. `tests/` 目录存放测试代码和测试数据
  4. `logs/` 目录存放应用程序日志文件
  5. `temp/` 目录存放临时文件和缓存
  6. 根目录包含主要的配置文件如 `package.json`、`requirements.txt`、主入口文件等

- **正向例子**:
  ```
  anki-linkmaster-PDFJS/
  ├── src/                    # 源代码目录
  ├── docs/                   # 文档目录
  ├── tests/                  # 测试目录
  ├── logs/                   # 日志目录
  ├── temp/                   # 临时文件目录
  ├── package.json            # 前端依赖配置
  ├── requirements.txt        # 后端依赖配置
  └── app.py                 # 应用程序主入口
  ```

- **反向例子**:
  ```
  # 结构混乱的根目录
  project/
  ├── code/                  # 非标准命名，应为 src/
  ├── documentation/         # 非标准命名，应为 docs/
  ├── test_files/            # 非标准命名，应为 tests/
  ├── log_files/             # 非标准命名，应为 logs/
  ├── cache/                 # 非标准命名，应为 temp/
  ├── config.json            # 配置文件分散在不同位置
  ├── main.js               # 入口文件命名不明确
  └── dependencies.txt       # 依赖文件命名不一致
  ```

  ```
  # 缺少必要目录的结构
  project/
  ├── src/
  ├── package.json
  └── app.js
  # 缺少 docs/, tests/, logs/, temp/ 等重要目录
  ```
]]>