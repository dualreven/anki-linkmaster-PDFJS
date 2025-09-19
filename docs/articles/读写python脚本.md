请你帮我生成一个提示词, 用于完成下面的任务

我要设计一个python脚本,比如叫 AI-log.py, 用于读写多种字段结构的json文件
这些json文件是给agent AI使用的, 他们用于保存agent AI的交流记录, 为了避免他们反复读取整个文件, 我需要设计一个python脚本, 用于读写这些文件, 只获取最新的交流记录
比如 planner agent 会生成 solution-draft 以及 forum 两个文件 传递给 plan-reviewer , plan-reviewer 是记忆清空的,因此他需要完全读取 forum内容, 和 solution-draft内容, 然后做出回复,添加到 forum 中, 再返回给  planner, 但 planner 的上下文中已经含有了 forum之前的讨论记录, 因此他只需要读取最新的forum内容即可. 他这时候最好有个 AI-log.py能帮助读取, 并且他有新的想法也可以通过 AI-log.py 写入, 这样能避免他私自篡改 forum记录, 确保内容的一致性.
希望你写个python脚本, 能够实现 python AI-log.py read --forum [YYYYMMDDhhmmss] 能够读取 forum 文件中最新的一条记录
同时, 也希望能够实现 python AI-log.py add --forum [YYYYMMDDhhmmss] --content [content] 能够将 [content] 写入到 forum 文件中, 并添加到最新的一条记录中, content应该更细致一些.

AI-log.py 放在 [根目录]/AIscripts/AI-log.py 下
创建的文件 放在 [根目录]/AI-communication/ 下.
对于 forum,文件, 就是 [根目录]/AI-communication/[YYYYMMDDhhmmss]-forum.json
对于 solution,文件, 就是 [根目录]/AI-communication/[YYYYMMDDhhmmss]-solution.json
对于 atom-tasks 文件, 就是 [根目录]/AI-communication/[YYYYMMDDhhmmss]-atom-tasks.json

要提供help指令, 提供

下面的命令中, 写入和更新, 都返回ok或报错内容.


# forum的交互

python AI-log.py create --forum [YYYYMMDDhhmmss] --project-name [项目名] --initiator [发起人]

查询是否同意方案
python AI-log.py read --forum [YYYYMMDDhhmmss] --is-agree 

读取最新回复(完整的json输出)
python AI-log.py read --forum [YYYYMMDDhhmmss] --latest-reply

读取指定编号回复
python AI-log.py read --forum [YYYYMMDDhhmmss] --message-id [messageId]

追加评论
python AI-log.py add --forum [YYYYMMDDhhmmss] --content [content] --user [user]
追加评论(通过文件)
python AI-log.py add --forum [YYYYMMDDhhmmss] --content-from-file [content-path] --user [user] 
追加评论(可选resource)
python AI-log.py add --forum [YYYYMMDDhhmmss] --content [content] --user [user] --resource [resource]
追加评论(可选agree)
python AI-log.py add --forum [YYYYMMDDhhmmss] --content [content] --user [user] --agree [true|false|null]

更新讨论状态
python AI-log.py update --forum [YYYYMMDDhhmmss] --status [0|1]

查询讨论状态
python AI-log.py read --forum [YYYYMMDDhhmmss] --status 



# solution 的交互

创建方案(此时仅仅是个空壳)
python AI-log.py create --solution [YYYYMMDDhhmmss] --summary [方案摘要] --initiator [发起人] --userInput [用户输入] --forumReference [forum编号]


添加事实陈述
python AI-log.py add --solution [YYYYMMDDhhmmss] --fact --summary [summary] --detals [details]

添加困境陈述
python AI-log.py add --solution [YYYYMMDDhhmmss] --dilemma --summary [summary] --detals [details]

添加假设陈述
python AI-log.py add --solution [YYYYMMDDhhmmss] --hypothesis --summary [summary] --detals [details]

添加验证陈述
python AI-log.py add --solution [YYYYMMDDhhmmss] --validation --summary [summary] --detals [details]

添加执行陈述
python AI-log.py add --solution [YYYYMMDDhhmmss] --execution --summary [summary] --detals [details]

添加参考
python AI-log.py add --solution [YYYYMMDDhhmmss] --reference [reference]


更新事实陈述
python AI-log.py update --solution [YYYYMMDDhhmmss] --fact --summary [summary] --detals [details]

更新困境陈述
python AI-log.py update --solution [YYYYMMDDhhmmss] --dilemma --summary [summary] --detals [details]

更新假设陈述
python AI-log.py update --solution [YYYYMMDDhhmmss] --hypothesis --summary [summary] --detals [details]

更新验证陈述
python AI-log.py update --solution [YYYYMMDDhhmmss] --validation --summary [summary] --detals [details]

更新执行陈述
python AI-log.py update --solution [YYYYMMDDhhmmss] --execution --summary [summary] --detals [details]

更新参考
python AI-log.py update --solution [YYYYMMDDhhmmss] --reference [reference]

更新讨论状态
python AI-log.py update --solution [YYYYMMDDhhmmss] --status [0|1]

查询讨论状态
python AI-log.py read --solution [YYYYMMDDhhmmss] --status 

# atom-task 的交互


创建原子任务列表
python AI-log.py create --atom-tasks [YYYYMMDDhhmmss] --project-name [项目名] --description [任务描述] --totalAtomTaskCount [原子任务总数计数]

添加原子任务
python AI-log.py add --atom-tasks [YYYYMMDDhhmmss] --title [任务标题] --content [任务描述]

更新原子任务列表讨论状态
python AI-log.py update --atom-tasks [YYYYMMDDhhmmss] --status [0|1]

查询原子任务列表讨论状态
python AI-log.py read --atom-tasks [YYYYMMDDhhmmss] --status 

更新原子任务状态
python AI-log.py update --atom-tasks [YYYYMMDDhhmmss] --index [任务序号] --status [任务状态]

获取下个原子任务
python AI-log.py read --atom-tasks [YYYYMMDDhhmmss] --next-todo



文件有下面几种格式:
1 AI-forum.json:
```json5
{
  "forumDiscussionRecord": {
    "metadata": {
      "project": "项目名",
      "initiator": "agent-master",
      "createdAt": "2025-08-30T12:00:00Z",
      "status": 0, // 0: draft, 1: final
    },
    "participants": [
      {
        "user": "agent-master",
        "role": "主智能体"
      },
      {
        "user": "agent-review",
        "role": "事实复核"
      }
    ],
    "discussionTopic": "今晚吃什么?",
    "discussionContent": [
      {
        "messageId": "001",
        "user": "agent-master (主智能体)",
        "time": "2025-08-30T12:00:00Z",
        "replyTo": null,
        "agree": null,//true , false ,null,
        "content": "我认为意大利面就该拌42号混凝土",
        "resource": ["www.baidu.com","www.zhihu.com", "@src\\frontend\\pdf-home\\docs\\SPEC\\"]
      },
      {
        "messageId": "002",
        "replyTo": "001",
        "user": "agent-review (事实复核)",
        "time": "2025-08-30T12:30:00Z",
        "agree": true,//true , false ,null,
        "content": "我不同意：42号混凝土不可食用，建议改为番茄酱意面并给出证据。",
        "resource": [
          "https://example.com/concrete-hazards"
        ],
      }
    ],
    "unresolvedItems": "No unresolved items",
    "consensusAgreements": "No consensus agreements have been reached"
  }
}
```
2 AI-solution.json:
```json5
{
  "solution": {
    "initiator": "agent-master",
    "status":0,//0:draft,1:final
    "role": "方案规划师 (agent-planner)",
    "summary": "基于输入和 sequentialthinking MCP 工具生成的精细化方案",
    "userInput": "{{user_input}}",
    "creationTime": "[yyyymmddHHmmss]",
    "forumReference": "AIforum/[yyyymmddHHmmss]-forum-[编号].md",
    "fact": {
      "summary": "",
      "details": ""
    },
    "dilemma": {
      "summary": "",
      "details": ""
    },
    "hypothesis": {
      "summary": "",
      "details": ""
    },
    "validation": {
      "summary": "",
      "details": ""
    },
    "execution": {
      "summary": "",
      "details": ""
    },
    "references": [
      "[参考1]",
      "[参考2]"
    ]
  }
}
```
3 AI-atom-tasks.json:
```json5
{
  "taskBackground": {
    "status": 0 ,//0: draft, 1: final
    "projectName": "新功能开发",
    "description": "开发一个新的软件功能以提升用户体验。",
    "refers": [
      "https://example.com/project-docs",
      "https://example.com/feature-specs",
      "docs/AI-docs-schema/atom-tasks.example.json",
      "AIforum/[yyyymmddHHmmss]-solution-[编号].md"
    ],
    "totalAtomTaskCount": 10
  },
  "atomTaskList": [
    {
      "title": "收集需求",
      "content": "与相关人员沟通，明确项目需求。",
      "status": 0, // 0 todo 1 doing 2 done 3 failed,
      "index": 1,
      "feedback": "[由执行者完成任务反馈填写]"
    },
    {
      "title": "设计方案",
      "content": "根据需求制定技术和实现方案。",
      "status": 0, // 0 todo 1 doing 2 done 3 failed,
      "index": 2,
      "feedback": "[由执行者完成任务反馈填写]"
    },
    {
      "title": "开发功能",
      "content": "按照设计方案进行功能开发。",
      "status": 0, // 0 todo 1 doing 2 done 3 failed,
      "index": 3,
      "feedback": "[由执行者完成任务反馈填写]"
    },
    {
      "title": "测试功能",
      "content": "对开发完成的功能进行测试。",
      "status": 0, // 0 todo 1 doing 2 done 3 failed,
      "index": 4,
      "feedback": "[由执行者完成任务反馈填写]"
    },
    {
      "title": "部署上线",
      "content": "将测试通过的功能部署到生产环境。",
      "status": 0, // 0 todo 1 doing 2 done 3 failed,
      "index": 5,
      "feedback": "[由执行者完成任务反馈填写]"
    },
    {
      "title": "需求分析",
      "content": "对收集的需求进行详细分析和优先级排序。",
      "status": 0, // 0 todo 1 doing 2 done 3 failed,
      "index": 6,
      "feedback": "[由执行者完成任务反馈填写]"
    },
    {
      "title": "原型设计",
      "content": "基于方案创建功能原型以验证可行性。",
      "status": 0, // 0 todo 1 doing 2 done 3 failed,
      "index": 7,
      "feedback": "[由执行者完成任务反馈填写]"
    },
    {
      "title": "单元测试",
      "content": "对单个模块进行单元测试，确保代码质量。",
      "status": 0, // 0 todo 1 doing 2 done 3 failed,
      "index": 8,
      "feedback": "[由执行者完成任务反馈填写]"
    },
    {
      "title": "集成测试",
      "content": "测试功能模块间的集成，确保整体兼容性。",
      "status": 0, // 0 todo 1 doing 2 done 3 failed,
      "index": 9,
      "feedback": "[由执行者完成任务反馈填写]"
    },
    {
      "title": "监控优化",
      "content": "上线后监控功能表现，并进行必要优化。",
      "status": 0, // 0 todo 1 doing 2 done 3 failed,
      "index": 10,
      "feedback": "[由执行者完成任务反馈填写]"
    }
  ]
}
```