# 基本规则:

- 必须牢记你的执行流程!
- 总是使用中文回复.
- 在roocode环境中 mode 就是 agent, 模式即是智能体, 两者等价不可区分.
- 想知道真实的时间必须用time mcp工具获取
- 你可以使用powershell命令, 注意 PowerShell 中 && 不被支持，应使用 ; 作为命令分隔符。
- 测试先行, 任何想法都必须经过代码验证才能落实.
- 修改前提交git创建分支: 每次修改前, 先commit, 然后创建分支, 保存快照, 然后再进行修改
- 失败回滚git: 如果修改导致更恶劣的情况发生,应当立即退回修改
- 成功提交git合并分支: 修改通过后, 再将当前分支合并分支到来时的分支

# 文件修改时的注意事项:

   必须遵守和阅读开发规范: 每当你要修改一个模块时,你必须先阅读这个模块的开发规范, 通常他保存在 [模块名]/docs/SPEC 下面, 特别注意有个头文件 [模块名]/docs/SPEC/SPEC-HEAD-[模块名].yml 他记录了所有引用的规范, 必须先阅读规范, 然后遵守规范来修改和测试代码.

# debug代码时的注意事项:

   debug的逆向思维: 从与用户使用行为最近的代码开始检查bug, 比如表格渲染不正常, 则直接看表格渲染的问题, 确定表格渲染的正确性, 如果正常, 再回推别的问题.

# 代码工程化思想:

传入变量应无外部副作用: 函数接受的参数应当是不可变的, 该变量作为副本传入, 外部修改该变量不会影响其在函数内部的状态.

必须写注释: 不管是js还是py,编写任何函数都要先写文档,描述用法和输入输出.

# Anki LinkMaster PDFJS - AI 调试指南

version: 1.0
description: 本文档描述了如何使用 AI 工具和自动化脚本来辅助 Anki LinkMaster PDFJS 项目的开发

ai_launcher:
  script_name: ai-launcher.ps1
  description: PowerShell 脚本用于自动化启动和管理项目的多个服务进程

  features:
    - 一键启动所有开发服务（npm dev、debug.py、app.py）
    - 进程管理和监控
    - 日志文件管理
    - 服务状态检查

  usage:
    start_all_services: .\ai-launcher.ps1 start
    stop_all_services: .\ai-launcher.ps1 stop
    check_status: .\ai-launcher.ps1 status
    view_logs: .\ai-launcher.ps1 logs
    start_with_wait_time: .\ai-launcher.ps1 start -WaitTime 15

  services:
    - name: npm dev server
      type: frontend
      port: [dynamic]
      description: 前端开发服务器

    - name: debug.py
      type: debug
      port: 9222
      description: Python 调试控制台

    - name: app.py
      type: main
      description: 主应用程序

  log_files:
    npm_dev: logs/npm-dev.log
    debug: logs/debug.log, logs/debug-console-[debug-port].log
    app: logs/app.log

  notes:
    - 脚本会自动创建 logs 目录
    - 使用 UTF-8 编码处理日志输出
    - 会自动清理 ANSI 转义码，使日志更易读
    - 进程信息保存在 logs/process-info.json
    - 重要提示 - 必须使用 ai-launcher.ps1 启动程序，切勿直接执行 vite、python app.py 等命令
    - 原因 - 直接启动 npm run dev、python app.py 等命令会导致终端阻塞，无法自动运行和调试
    - 必要性 - ai-launcher.ps1 会正确管理进程生命周期，避免阻塞问题，特别适合智能体自动化调试

ai_development_workflow:

  startup:
    first_time: .\ai-launcher.ps1 start

  development:
    check_status: .\ai-launcher.ps1 status
    view_logs: .\ai-launcher.ps1 logs
    hot_reload: 修改代码后服务会自动重启

  shutdown:
    stop_services: .\ai-launcher.ps1 stop

troubleshooting:

  manual_debugging:
    warning: 以下命令仅适用于特殊情况下的手动调试，智能体自动化调试时严禁使用
    frontend: npm run dev
    debug_console: python debug.py --port 9222
    main_app: python app.py
    note: 这些命令会导致终端阻塞，无法自动运行，智能体必须使用 ai-launcher.ps1

best_practices:

- 开发前总是先运行 .\ai-launcher.ps1 start
- 开发结束后使用 .\ai-launcher.ps1 stop 清理进程
- 定期检查日志文件以监控服务状态
- 使用版本控制提交代码变更
- 智能体调试时必须使用 ai-launcher.ps1，禁止直接执行 npm run dev、python app.py 等阻塞命令
- ai-launcher.ps1 是唯一推荐的启动方式，确保进程不会阻塞自动化流程
