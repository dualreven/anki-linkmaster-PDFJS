
## 未决问题

### 需要确认的技术细节
1. **事件命名规范**: 是否需要统一的事件命名约定？
是
2. **错误处理策略**: 模块级错误如何传播和处理？
请你自己定义
3. **状态管理**: 是否引入轻量级状态管理库？
不引入
4. **日志级别**: 调试日志的详细程度如何控制？
越详细越好,另外这是一个html页面,需要考虑让AI能读取到html错误的能力.
而且这是个qtwebengine项目, 结合上述两点,我设计了一个debug日志服务器,
他可以同步 html页面上的console信息到本地debug-console.log文件中,每次刷新,这个文件都会置空,而且这个文件还能捕捉到vite的报错.
到时候AI要从debug-console.log文件读取分析报错信息.
所以,这个项目里, vite, app.py, qtwebengine-debug-listener.py 这三个服务器已经启动.
AI只要专注于改每个版本的代码就行, 其中不要修改index.html文件的名字.

5. **热重载**: 开发时是否支持模块热替换？
上面已经回答清楚了.


### 需要确认的业务逻辑
1. **WebSocket重连**: 连接断开后如何重连？
目前暂时不考虑这个问题
2. **文件操作**: 文件添加/删除的确认机制？
PDF文件添加保存到根目录/data文件夹下, 文件名是随机生成的uuid,有一个json文件记录对应关系.
3. **缓存策略**: PDF列表是否需要缓存？
不用
4. **权限控制**: 文件操作的权限检查？
不用权限

### 需要确认的范围边界
1. **API兼容性**: 是否需要保持100%向后兼容？
不需要
2. **UI变化**: 是否可以调整UI布局和样式？
可以
3. **性能基准**: 现有性能指标的基准数据？
没有性能指标要求,但至少是普通水平
4. **测试环境**: 测试环境的搭建要求？
测试环境已经搭建好,如前面所属


对于版本的管理,我还有一些要补充的

目前源代码的目录结构是这样的:
```
frontend/
├── 📁 common/                     # 公共组件和工具
│   ├── app-manager.js            # 应用管理器
│   ├── business-logic-manager.js  # 业务逻辑管理
│   ├── debug-tools.js            # 调试工具
│   ├── error-collector.js        # 错误收集器
│   ├── index.js                  # 公共模块入口
│   ├── qtwebengine-adapter.js    # QtWebEngine适配器
│   ├── ui-manager.js             # UI管理器
│   ├── websocket-manager.js      # WebSocket管理器
│   └── 📁 pdf-table/             # PDF表格组件
│       ├── pdf-table.js          # 主表格组件
│       ├── pdf-table-*.js        # 各种功能模块
│       └── pdf-table-styles.css  # 表格样式
├── 📁 pdf-home/                   # PDF主页应用
│   ├── index.html                # 主页HTML
│   ├── index.js                  # 主页入口
│   ├── pdf-home-app.js          # 主页应用类
│   ├── pdf-home-business-logic.js # 业务逻辑
│   ├── pdf-home-ui.js           # 主页UI
│   └── style.css                # 主页样式

```

1. 重构对象包括common文件夹下的所有文件
2. 每次创建一个版本时,遵循这样一个规则: 把上一版命名为当前版本减1.例如: 当你创建v1版本时,上一版的名字就是pdf-home-v0(v0就是原始版本),而v1版保持pdf-home不变, 当你创建v2版本时, 原来v1版本对应的目录改名为pdf-home-v1, v2版本目录名为 pdf-home.
   1. 版本还可以有小数点,对应了一些后期版本下,模块众多的场景,可能需要逐个模块地设立版本编号
3. 目录内的文件名字使用常规命名即可,不需要加版本号, 确保不要修改 index.html的文件名, 避免服务器读取不到html文件.
4. 写版本的开发计划时,要非常细致,包括架构的思路, 每个模块的功能, 每个模块中的函数的职能和测试用例, 每个模块的开发顺序
5. 测试驱动开发过程中, 测试用例逐个模块编写,每写好一个模块,就测试一下, 确保每个模块的功能都正常, 再进入下一模块.
6. 开发规范请参考 docs\SPEC\javascript_code_standard.md, 但这个文件过长,因此请你提取其中的重要信息写在step0_CLARIFY_pdf-home-refactor.md文件中.