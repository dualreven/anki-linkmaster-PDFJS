
# 关键目录位置规范
## `AITASK`
所有的AI工作结果都保存在这个文件夹下,一个新的项目命名为`序号-项目名`
## `AITASK/[序号-项目名]/`
这个目录保存的是本项目全部的AI工作文件,针对不同原型迭代阶段,建立不同的 `v[版本号]` 目录
这个目录下有: 
1. `[YYYYMMDDhhmmss]-需求文档.md`
    (通过`project-manager`由用户输入得到)
2. `[YYYYMMDDhhmmss]-共识文档.md`
    (通过`project-manager`由需求+用户协商得到)
3. `[YYYYMMDDhhmmss]-原型迭代开发目标说明.md`
    (通过`project-manager`由需求+共识得到)

## `AITASK/[序号-项目名]/v[版本号]`
这个目录保存的是指定迭代版本下的AI工作文件,
针对不同的分组任务,建立不同的`[任务组别编号]`目录
这个目录下有:
1. `[YYYYMMDDhhmmss]-版本说明.md`
    (通过`project-manager`由需求+共识+目标+用户输入得到)
1. `[YYYYMMDDhhmmss]-架构说明.md`
    (通过`proto-iter-developer->archspec-manager->arch-designer`根据需求+共识+迭代目标得到)
2. `[YYYYMMDDhhmmss]-规范说明.md`
    (通过`proto-iter-developer->archspec-manager->spec-designer`根据需求+共识+迭代目标+架构得到)
3. `[YYYYMMDDhhmmss]-架构与规范一致性验收报告.md`
    (通过`proto-iter-developer->archspec-manager->conflict-detector`根据需求+共识+迭代目标+架构+规范得到)
3. `[YYYYMMDDhhmmss]-宏观任务汇总.md`
    (通过`proto-iter-developer->task-design-manager`根据需求+共识+迭代目标+架构+规范得到)
4. `[YYYYMMDDhhmmss]-原子任务汇总.md`
    (通过`proto-iter-developer->task-design-manager`根据需求+共识+迭代目标+架构+规范+宏观任务得到)
5. `[YYYYMMDDhhmmss]-分组任务汇总.md`
    (通过`proto-iter-developer->task-design-manager`根据需求+共识+迭代目标+架构+规范+宏观任务+原子任务得到)
6. `[YYYYMMDDhhmmss]-迭代验收报告.md`
    (通过`proto-iter-developer->iteration-acceptance`从全部分组任务执行结果得到)

## `AITASK/[序号-项目名]/v[版本号]/[任务组别编号]`
这个目录保存的是某一组任务相关文档,
针对不同的原子任务,建立对应`[第i个原子任务编号]`目录,
这个目录下有:
1. `[YYYYMMDDhhmmss]-分组任务说明.md`
    (通过`proto-iter-developer->task-design-manager`从分组任务汇总提取当前组别得到)
2. `[YYYYMMDDhhmmss]-分组任务执行结果.md`
    (通过`proto-iter-developer->task-design-manager`从分组任务汇总中提取对应组别的原子任务得到)
## `AITASK/[序号-项目名]/v[版本号]/[任务组别编号]/[第i个原子任务编号]`
这个目录下有:
1. `[YYYYMMDDhhmmss]-原子任务说明.md`
    (通过`proto-iter-developer->task-design-manager->test-designer`从原子任务汇总中提取对应组别的原子任务得到)
2. `[YYYYMMDDhhmmss]-测试用例说明.md`
    (通过`proto-iter-developer->task-design-manager->test-designer`从原子任务说明结合背景文档得到)
3. `[YYYYMMDDhhmmss]-API用例说明.md`
    (通过`proto-iter-developer->task-design-manager->test-designer`从原子任务说明结合背景文档得到)
4. `[YYYYMMDDhhmmss]-开发任务报告.md`
    (通过`proto-iter-developer->group-job-manager->job-executor->code-generator`从原子任务说明+测试用例说明+API用例说明结合背景文档得到)
5. `[YYYYMMDDhhmmss]-测试任务报告.md`
    (通过`proto-iter-developer->group-job-manager->job-executor->test-verifier`从原子任务说明+测试用例说明+API用例说明结合背景文档得到)
6. `[YYYYMMDDhhmmss]-规范检查报告.md`
    (通过`proto-iter-developer->group-job-manager->job-executor->sepc-verifier`从原子任务说明+测试用例说明+API用例说明结合背景文档得到)
7. `[YYYYMMDDhhmmss]-任务完成报告.md`
    (通过`proto-iter-developer->group-job-manager->job-executor`从开发任务报告+测试任务报告+规范检查报告结合背景文档得到)


## [模块名称]/docs/SPEC/
1. 规范头文件(命名格式:`SPEC-HEAD-[模块名].yml`,通过`proto-iter-developer->archspec-manager->spec-designer`创建)
2. 规范原子文件(命名格式:`[范畴]-[子范畴]-[功能]-[序号ID].md`,通过`proto-iter-developer->archspec-manager->spec-designer`创建)

## [项目根目录]/docs/SPEC/
1. 规范头文件(命名格式:`SPEC-HEAD-*.yml`,通过`proto-iter-developer->archspec-manager->spec-designer`创建)
2. 规范原子文件(命名格式:`[范畴]-[子范畴]-[功能]-[序号ID].md`,通过`proto-iter-developer->archspec-manager->spec-designer`创建)

# 非关键目录位置
