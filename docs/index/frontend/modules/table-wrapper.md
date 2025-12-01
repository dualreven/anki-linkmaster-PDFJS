# 模块：table-wrapper

> 注意：本页描述的是旧版 pdf-home v1 中的 Tabulator 表格封装模块（`src/frontend/pdf-home/table-wrapper.js`），当前实现已经重构，代码结构不再包含该文件。以下内容仅用于理解旧的表格封装思路。

简介：封装 Tabulator 表格初始化、列定义与交互事件。

主要文件（旧版架构）：
- src/frontend/pdf-home/table-wrapper.js:1

职责（旧版）：
- 将数据绑定到表格
- 处理列配置、排序和分页
- 暴露 API 给 pdf-home 页面（reloadData, getSelected）

细节实现（旧版）：
- 表格初始化在 src/frontend/pdf-home/table-wrapper.js:30
- reloadData 实现在 src/frontend/pdf-home/table-wrapper.js:88
