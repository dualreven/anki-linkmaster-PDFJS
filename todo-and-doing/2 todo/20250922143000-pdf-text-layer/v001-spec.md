# PDF文字层加载功能规格说明
**功能ID**: 20250922143000-pdf-text-layer
**优先级**: 高
**版本** : 001
**创建时间**: 2025-09-22 14:30:00
**预计完成**: 2025-09-25
**状态**: 设计中

## 现状说明
- 通过命令 `python ai-launcher.py start --module pdf-viewer --pdf-id <pdf-id>` 可以正常打开 pdf-viewer窗体, 并加载指定pdf-id的pdf文件展示
- 可以通过 `logs/pdf-viewer-<pdf-id>.log` 和 `logs/pdf-viewer-<pdf-id>-js.log` 分别查看pyqt层和js层的日志
- 较好地遵循了 pdf-viewer/docs/SPEC/下的代码规范

## 存在问题
- 目前展示的只是图片格式的pdf
- 文字层加载功能未实现
- 如有文字,目前用户无法选中和复制PDF中的文字

## 提出需求
- 实现文字层渲染功能
- 确保文字层与图片层正确对齐
- 用户可选中并复制文字
- 可获取选中PDF位置坐标,为将来文字标注做基础准备

## 解决方案
- 在pdf-viewer模块中集成pdf.js的文字层渲染功能


## 约束条件
### 仅修改本模块代码
仅修改 pdf-viewer模块中的代码,不可修改其他模块的代码, 如果有必要请写到工作日志中
### 严格遵循代码规范和标准
必须优先阅读和理解 `pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json` 下的代码规范, 并在开发时严格执行.


## 可行验收标准
### 单元测试
所有新增代码通过单元测试,原子化测试
### 端到端测试
注入js脚本,创建selectionchanged类似事件, 监听选中变化,输出选中文字到日志,检查日志中是否包含选中的文字.
### 接口实现
#### 接口1: 
函数: loadTextLayer(container,page)
描述: 在指定的container中加载page的文字层
参数:
- container: 文字层加载的目标容器元素
- page: 要加载的pdf页面对象
返回值: 无
#### 接口2:
函数: getSelectedText()
描述: 获取当前选中的文字
参数: 无
返回值: 字符串,当前选中的文字
#### 接口3:
函数: getSelectedTextRect()
描述: 获取当前选中文字的矩形区域
参数: 无
返回值: 数组,包含4个元素,分别为选中文字的左上角x,y坐标和宽度高度
#### 接口4:
函数: clearTextSelection()
描述: 清除当前选中的文字
参数: 无
返回值: 无
#### 接口5:
函数: highlightSelectedText(area_list)
描述: 高亮当前选中的文字
参数:
- area_list: 选中文字的矩形区域列表,每个元素为一个数组,包含4个元素,分别为选中文字的左上角x,y坐标和宽度高度
返回值: 无
### 类实现
#### 类1
类: TextLayerManager
描述: 管理PDF文字层的加载和交互
属性:
- pdfDocument: PDF文档对象
- textLayerContainer: 文字层容器元素
- textLayerEnabled: 文字层是否已启用
方法:
- loadTextLayer(container,page): 加载指定page的文字层到container中
- getSelectedText(): 获取当前选中的文字
- getSelectedTextRect(): 获取当前选中文字的矩形区域
- clearTextSelection(): 清除当前选中的文字
- highlightSelectedText(area_list): 高亮当前选中的文字

### 事件规范
#### 事件1: selectionchanged
描述: 当用户选中PDF中的文字时触发
参数: 无
返回值: 无


