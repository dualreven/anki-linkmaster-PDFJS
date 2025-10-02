# 清除浏览器缓存并重新加载

## 问题
前端代码已更新，但浏览器可能缓存了旧版本的JavaScript代码，导致：
- 仍然显示formatter警告
- 表格样式不正常

## 解决方案

### 方法1：强制刷新（推荐）
在浏览器中按以下组合键：
- **Windows/Linux**: `Ctrl + Shift + R` 或 `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

### 方法2：手动清除缓存
1. 打开浏览器开发者工具（F12）
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"（Empty Cache and Hard Reload）

### 方法3：禁用缓存（开发时）
1. 打开开发者工具（F12）
2. 进入 Network 标签
3. 勾选"Disable cache"（禁用缓存）
4. 保持开发者工具打开
5. 刷新页面

### 方法4：重启服务
```bash
# 停止服务
python ai_launcher.py stop

# 重新启动
python ai_launcher.py start --module pdf-home
```

## 验证更新成功
刷新后，在浏览器Console中不应该再看到：
```
Invalid column definition option: formatter
```

如果还有警告，说明缓存未清除，请尝试其他方法。
