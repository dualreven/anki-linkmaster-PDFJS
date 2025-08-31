# 模块：table-wrapper

简介：封装 Tabulator 表格初始化、列定义与交互事件。

主要文件：
- src/frontend/pdf-home/table-wrapper.js:1

职责：
- 将数据绑定到表格
- 处理列配置、排序和分页
- 暴露 API 给 pdf-home 页面（reloadData, getSelected）

细节实现：
- 表格初始化在 src/frontend/pdf-home/table-wrapper.js:30
- reloadData 实现在 src/frontend/pdf-home/table-wrapper.js:88