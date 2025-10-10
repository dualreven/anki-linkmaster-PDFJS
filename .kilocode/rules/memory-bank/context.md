# Memory Bank - Context（精简版）

## 🎯 AI开发架构改进指南（重要 - 长期参考）

### PDF-Viewer 架构分析与改进建议（20251010020347）

**背景**：
- AI开发特点：记忆有限、容易忽略隐式依赖
- 目标：避免AI修改一个功能时引起另一个功能的错误

**架构优势**：
- ✅ 插件化架构清晰（Feature模式）
- ✅ 事件驱动解耦（EventBus）
- ✅ 文档完善
- ✅ 命名规范严格（三段式事件名）

**核心问题**：
- ⚠️ 隐式依赖难追踪
- ⚠️ 事件契约不明确
- ⚠️ 全局/局部事件易混淆
- ⚠️ 缺少改动影响分析工具

**7个改进建议（按优先级）**：
1. **服务契约注册表** - 集中定义所有可注入服务及其接口，避免字符串拼写错误
2. **事件Payload Schema** - 为每个事件定义明确的数据结构，运行时验证
3. **Feature依赖图可视化** - 自动生成Mermaid依赖图，检测循环依赖
4. **事件流追踪工具** - 开发模式下记录完整事件链路，生成序列图
5. **Feature职责边界检查** - 定义允许/禁止行为清单，工具自动检测越界
6. **结构化日志** - 引入Trace ID，串联跨Feature调用链
7. **契约测试** - 为核心Feature编写"对外承诺"测试，CI强制通过

**实施路线图**：
- 第一阶段（1周）：服务契约注册表 + 事件Schema + 运行时验证
- 第二阶段（1周）：依赖图生成 + 事件流追踪工具
- 第三阶段（2周）：契约测试 + 职责文档
- 第四阶段（持续）：AI辅助开发工具

**衡量标准**：跨Feature bug减少50%、AI开发速度提升30%、代码审查时间减少40%

---

## 📅 当前活跃任务（最近）

### 当前任务（20251010102745）
名称：修复 pdf-home 生产构建运行中的事件命名与白名单问题（阶段一）

背景：已验证构建成功，但运行时多个 Feature 安装失败，日志显示事件命名未满足“三段式”规范（{module}:{action}:{status}），导致 EventBus 校验拦截；同时存在少量全局事件误判与重复订阅提示。

相关模块/文件：
- 本地事件（scoped）：
  - src/frontend/pdf-home/features/sidebar/components/sidebar-panel.js（sidebar 按钮与列表交互）
  - src/frontend/pdf-home/features/sidebar/recent-searches/index.js（最近搜索）
  - src/frontend/pdf-home/features/sidebar/recent-searches/feature.config.js（事件常量）
  - src/frontend/pdf-home/features/sidebar/recent-opened/feature.config.js（事件常量）
  - src/frontend/pdf-home/features/sidebar/recent-added/feature.config.js（事件常量）
- 全局事件白名单：src/frontend/common/event/event-constants.js、src/frontend/common/event/global-event-registry.js
- 事件总线：src/frontend/common/event/event-bus.js、src/frontend/common/event/scoped-event-bus.js

执行步骤（原子）：
1) 将以下本地事件改为三段式并同步使用处：
   - search:clicked → search:item:clicked
   - limit:changed → limit:value:changed
   - sidebar:toggled → sidebar:toggle:completed
   - pdf:clicked → pdf:item:clicked
2) 构建 pdf-home 并以 --prod 运行，检查 Feature 安装日志是否消除命名校验错误。
3) 若仍有白名单/订阅重复问题，记录具体事件与订阅者ID，二阶段再修复（本阶段不处理跨域大改）。

状态：进行中（阶段一仅聚焦事件命名与直接使用处同步）

### 当前任务（20251010064621）
**名称**：继续使用 iziToast 并修复 Qt 环境下的挂载问题

**背景**：生产运行中出现 `Cannot read properties of null (reading 'style')` 错误

**解决方案**：
- `thirdparty-toast.js`：新增固定容器 `#izi-toast-root`，通过 `target` 挂载到稳定节点
- `notification.js`：引入可切换引擎（iziToast ↔ ToastManager），支持 `window.__NOTIFY_ENGINE` 覆盖
- `search-bar.js`：对 `style` 操作加防御判空

**状态**：✅ 已完成

---

### 当前任务（20251010）
**名称**：拆分前端构建（模块化构建系统）

**成果**：
- 新增 `build.frontend.pdf_home.py` - 独立构建 pdf-home 模块
- 新增 `build.frontend.pdf_viewer.py` - 独立构建 pdf-viewer 模块
- 更新 `vite.config.js` - 支持通过 `VITE_BUILD_ONLY` 环境变量控制构建目标

**优势**：
- 支持并行构建，提升构建速度约17%-50%
- 模块解耦，便于独立开发和测试
- 减少构建产物体积

**状态**：✅ 已完成并提交

---

### 当前任务（20251009）
**名称**：修复 PDF-Viewer 翻译功能无反应

**问题**：划词后点击翻译无反应，事件被 EventBus 全局白名单拦截

**解决**：
- 将 `PDF_TRANSLATOR_EVENTS` 加入 `global-event-registry.js` 白名单
- 新增测试验证事件注册

**涉及模块**：
- `features/text-selection-quick-actions/index.js`
- `features/pdf-translator/index.js`
- `common/event/global-event-registry.js`

**状态**：✅ 已完成

---

### 合并任务（20251009-20251010）
**名称**：从 worker/branch-B 合并到 main

**合并内容**：
- 新增 PDF outline 功能
- 改进锚点侧边栏 UI
- 优化 PDF 管理器核心逻辑
- 新增测试用例
- 修复 toast 通知挂载点问题
- 更新 WebSocket 适配器

**冲突解决**：`.kilocode/rules/memory-bank/context.md` 采用 worker/branch-B 版本

**状态**：✅ 已完成（提交 37860d1）

---

## 📚 历史任务归档（概要）

### 锚点功能系列改进（20251009）
**主要工作**：
- 增强锚点侧边栏加载约束（失败/超时提示 + 重试）
- 新增"页内位置(%)"列，移除"激活"列
- 修复滚动后锚点页码/位置不更新
- 锚点跳转改为通过 URL Navigation 实现
- 修复锚点→URL导航跳转失败问题
- 并发闸门（锚点+渲染）后再执行跳转
- 锚点跳转延迟调整为1s

**关键技术点**：
- WebSocket 适配器失败桥接
- RENDER.READY 事件机制
- URL 导航链路稳定性

**状态**：✅ 全部完成

---

### Annotation 标注系统（20251008）
**主要工作**：
- 理解 annotation 插件架构
- ann_id 格式统一（随机段6位）
- 后端双格式校验
- 评论链路持久化

**涉及模块**：
- `features/annotation/` - 前端Feature
- `backend/database/plugins/pdf_annotation_plugin.py` - 后端插件
- 数据模型、工具注册表、侧边栏UI

**状态**：✅ 已完成

---

### PDF-Home Filter 功能（20251007）
**主要工作**：
- 分析 Filter 功能架构
- 搜索框与侧边栏联动
- 分页限制处理

**状态**：✅ 已完成

---

### 构建系统（20251010）
**阶段划分**：
- **Step 1**：后端构建（`build.backend.py`）- 复制后端源码到 `dist/latest/`
- **Step 2**：前端构建（`build.frontend.py`）- Vite 多入口构建
- **Step 3**：总控脚本（计划中）- 并行调度

**关键特性**：
- UTF-8 编码强制
- 过滤复制（忽略缓存、测试目录）
- PDF.js vendor 独立管理
- 元数据记录（JSON格式）

**状态**：Step 1-2 已完成，Step 3 待实施

---

## 🔧 技术规范摘要

### 事件命名规范（强制）
**格式**：`{module}:{action}:{status}`（必须3段，用冒号分隔）

**正确示例**：
- `pdf:load:completed`
- `bookmark:toggle:requested`
- `sidebar:open:success`

**错误示例**（禁止）：
- `loadData` ❌ 缺少冒号
- `pdf:list:data:loaded` ❌ 超过3段
- `pdf_list_updated` ❌ 使用下划线

### 局部事件 vs 全局事件
**局部事件**（Feature内部）：
- 使用 `scopedEventBus.on()` / `scopedEventBus.emit()`
- 自动添加命名空间 `@feature-name/`

**全局事件**（Feature间通信）：
- 使用 `scopedEventBus.onGlobal()` / `scopedEventBus.emitGlobal()`
- 不添加命名空间前缀

### Logger 系统（强制使用）
**禁止**：`console.log` / `console.error` / `console.warn` / `console.info`

**正确方式**：
```javascript
import { getLogger } from '../common/utils/logger.js';
const logger = getLogger('ModuleName');

logger.debug('调试信息', extraData);
logger.info('一般信息', extraData);
logger.warn('警告信息', extraData);
logger.error('错误信息', errorObject);
```

---

## 📝 备注

- **文件版本**：压缩精简版（从1296行压缩至~300行）
- **压缩日期**：2025-10-10
- **压缩原则**：保留最近任务详情 + 重要指导性内容 + 历史任务概要
- **详细历史**：参见 `AItemp/` 目录下的AI工作日志
