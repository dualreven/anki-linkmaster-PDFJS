# 📦 包管理器使用指南

## 🚨 重要提醒：此项目仅支持 PNPM

此项目配置为**强制使用 PNPM** 作为包管理器，禁止使用 npm 或 yarn。

### ✅ 正确的安装方法

```bash
# 安装 pnpm (如果尚未安装)
npm install -g pnpm

# 安装项目依赖
pnpm install

# 运行开发服务器
pnpm run dev

# 构建项目
pnpm run build
```

### ❌ 错误的方法（会被阻止）

```bash
npm install    # ❌ 会显示错误并终止
yarn install   # ❌ 会显示错误并终止
```

## 🔧 技术实现

项目通过以下机制强制使用 PNPM：

1. **preinstall 钩子** - 在任何安装操作前检查包管理器
2. **`.npmrc` 配置** - 包含严格的包管理器配置
3. **`engines` 字段** - 指定支持的 Node.js 和 PNPM 版本
4. **`packageManager` 字段** - 声明推荐的包管理器版本
5. **`.gitignore`** - 忽略 npm/yarn 相关文件

## 🎯 使用 PNPM 的优势

- **磁盘空间效率** - 通过硬链接共享依赖
- **安装速度快** - 并行安装和缓存机制
- **严格的依赖管理** - 避免幽灵依赖问题
- **Monorepo 支持** - 内置 workspace 功能
- **安全性** - 默认的严格模式

## 🛠️ 常见问题解决

### Q: 为什么不能使用 npm？
A: 混用包管理器会导致：
- 不同的 `lock` 文件冲突
- `node_modules` 结构不一致
- 依赖版本解析差异
- 潜在的安全和构建问题

### Q: 如何临时绕过限制？
A: **不推荐绕过限制**，但如果必要：
1. 临时重命名 `scripts/only-allow.js`
2. 完成操作后立即恢复
3. 删除任何生成的 `package-lock.json`

### Q: 团队成员意外使用了 npm 怎么办？
A:
1. 删除 `node_modules/` 和 `package-lock.json`
2. 运行 `pnpm install` 重新安装
3. 提醒团队成员查看此文档

## 📚 更多信息

- [PNPM 官方文档](https://pnpm.io/zh/)
- [为什么选择 PNPM](https://pnpm.io/zh/motivation)
- [PNPM vs NPM vs Yarn](https://pnpm.io/zh/benchmarks)

---

*如有疑问，请联系项目维护者或查看项目文档。*