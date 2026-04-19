基于 slack shortcuts 实现添加 feedback 并同步到 notion 的 feedback database：

## 说明

- 参考已有例子 sample-shortcut：server/listeners/shortcuts/sample-shortcut.ts
- 基于 slack 的 block kit 构建 modal：https://docs.slack.dev/block-kit/
    - modal 字段基于 notion 的 database schema: ai_input/resources/shortcuts/feedback/schema.json
- 用户相关字段（在notion中是person类型字段）需要通过email建立映射，参考（ai_input/resources/shortcuts/:
    - userMap.ts: 通过 notion 接口匹配用户
    - slack.ts：通过 client.users.info 获取用户email并匹配notion 用户
- 基于 notion 接口添加数据，参考：
    - notion.ts：ai_input/resources/shortcuts/notion.ts
    - api：https://developers.notion.com/reference/post-page
- shortcuts已配置，id为：new_feedback

---

参考已实现的 new-feedback shortcuts（server/listeners/shortcuts/new-feedback.ts），实现 expense-claim shortcuts:

## 说明

- modal 字段基于 notion 的 database schema: ai_input/resources/shortcuts/expnse-claim/schema.json
- shortcuts已配置，id为：expense_claim

---
参考已实现的 new-feedback shortcuts（server/listeners/shortcuts/new-feedback.ts），实现 new-candidate shortcuts:

## 说明

- modal 字段基于 notion 的 database schema: ai_input/resources/shortcuts/recruitment/schema.json
- shortcuts已配置，id为：new-candidate

---

添加notion成功后，在指定的slack channel 发送一条消息，包括提交的表单信息，和notion的链接

---

添加成功后，继续操作：
- 再给指定用户发送一条信息，内容包括表单内容，已经2个操作按钮，一个是接受(Approve),一个是拒绝（Reject）
    - 指定用户email通过env配置给出，然后通过slack api获取：https://docs.slack.dev/reference/methods/users.lookupByEmail
    - 根据操作更新notion的对应page的Approval Status属性其中Approve对应Approved,Reject对应Rejected
    - 按钮操作参考feedbackButtonsCallback的实现
- 操作完后再给表单提交者（submitterId）,发送一条结果消息

---
参考 expenseClaimFormCallback 的实现，添加notion成功后，在指定的slack channel 发送一条消息，包括提交的表单信息，和notion的链接
---
我已经完成这个项目开发，需要生成一份产品文档，和一份使用手册（均为markdown格式）：
- 参考我提供的项目架构文档
- 产品文档： 包括开发背景，实现思路，解决问题，后续迭代计划等
- 使用手册：包括slack和notion使用以及流程介绍，若是官方的文档直接放链接即可
    - slack：
        - 邀请链接：https://join.slack.com/t/kapibalaai/shared_invite/zt-3sdaz7x78-bW8SYH7EnINRuDUDZ4SCzw
        - 包括加入工作区：https://app.slack.com/slackhelp/zh-CN/212675257
        - 新用户指南：https://app.slack.com/slackhelp/zh-CN/218080037
        - shortcuts使用说明（后面补充界面截图）：New Feedback(提交需求)、New Claim(提交报销)、New Candidate(新候选人)
        - 频道：
            - feedback(反馈): https://app.slack.com/client/T0AKZDWB1RB/C0ALX532TUY
            - expense-claim(报销): https://app.slack.com/client/T0AKZDWB1RB/C0AL0S2L0GN
            - recruitments(招聘): https://app.slack.com/client/T0AKZDWB1RB/C0ALFQX3U4R
    - notion：
        - 邀请链接：https://www.notion.so/team/3217523c-7c93-811b-b45f-00429a0920e9/join
        - 新手指南：https://www.notion.com/help/category/new-to-notion
        - database:
            - Feedback(反馈)：https://www.notion.so/3217523c7c938087b6dfe6051c0e7006
            - Projects(项目)：https://www.notion.so/3217523c7c9380aaac8be454f91fe885
            - Main Tasks(主线任务)：https://www.notion.so/3217523c7c93802d8408f81ffea758b3
            - Sub Tasks(子任务)：https://www.notion.so/3217523c7c9380c2a87df2688fa5f978
            - Docs(团队文档)：https://www.notion.so/3217523c7c9380ccb769c9378d18a1a8
            - Expense Claims(报销记录)：https://www.notion.so/3217523c7c9380ca90b1c0f60d730e57
            - Recruitments(招聘记录)：https://www.notion.so/3217523c7c9380dc870ec790813b6d4e
    - 流程：
        - 报销：slack提交新报销→老板在slack审批→ (Jacob)在notion上传（发票）→（Tracy）打款并在notion更新
        - 招聘：slack提交新候选人→在notion处理招聘流程
        - 需求：slac提交新需求→在notion处理新需求
        - 任务管理：在notion管理，Main Tasks为主线任务，Sub Tasks为子任务由Tracy分配

---
先阅读优化方案  update_v1(ai_input/update_v1.md)，做一个优化计划
---

开始P0-1:

## 说明

- 本项目基于 vercel 和 slack 的相关框架，请先通过README.md了解
 - 了解 Features 和 Contains the AI agent implementation 部分
- 我使用 Bring Your Own Key (BYOK) 访问 LLM
 - 参考官方文档：https://vercel.com/docs/ai-gateway/authentication-and-byok/byok
 - 我使用minimax模型，参考官方文档：https://ai-sdk.dev/providers/community-providers/minimax

---

优化 query (server/lib/notion/query.ts)

## 说明

- querynotion.dataSources.query 的参数 data_source_id 应改为datasource id 而不是 database id, 已在env中添加对应datasource id
    - NOTION_FEEDBACK_DATASOURCE_ID
    - NOTION_EXPENSE_CLAIM_DATASOURCE_ID
    - NOTION_RECRUITMENT_DATASOURCE_ID
- 再次查看 notion 官方 datasource query文档 看看有没有优化空间

---
继续完成任务 `P0-3: 报销对话式 + 审批`：

## 说明
- 根据 plan_v1（ai_input/resources/docs/plan_v1.md）继续完成任务： `P0-3: 报销对话式 + 审批`
- `P0-1` 和 `P0-2` 已完成

---

测试 报销流程（expense_claim）时遇到问题：

## 说明

- 测试请求：我要报销上周打车 150 AED
- 返回需要确认提交的报销信息，但是确认后没有后续动作，日志显示代码一直停留在：

```text

[DEBUG]  web-api:WebClient:1 apiCall('conversations.replies') end
[DEBUG]   [@vercel/slack-bolt] App initialized in VercelReceiver
[DEBUG]   [@vercel/slack-bolt] VercelReceiver started
[DEBUG]   [@vercel/slack-bolt] ack() call begins (body: undefined)

```

- 请使用 `slack-agent` 技能重新检查相关代码，特别是HITL逻辑是否有问题

---

在#approvals channel 处理claim时，提示这个：
Operation timed out. Apps need to respond within 3 seconds.

现在的流程需要优化，用户处理（approve或者reject）后应该立即响应，然后再同步执行notion或者其它操作，待notion操作完成后再反馈给用户结果

---

继续完成任务 `P0-4: 招聘对话式提交`：

## 说明
- 根据 plan_v1（ai_input/resources/docs/plan_v1.md）继续完成任务： `P0-4: 招聘对话式提交`
- `P0-1` ， `P0-2`，`P0-3` 已完成

添加到notion后, 发送一个信息提示用户可以上传简历附件，信息中含有上传按钮，点击弹出modal窗进行上传操作，上传到slack再上传到notion，并提示用户：

- 参考 candidate-form（server/listeners/views/candidate-form.ts） 的表单设计和上传相关逻辑

同样地，在调用 submitExpenseClaim（server/lib/ai/tools/notion.ts） 提交报销信息到notion后，发送上传提示信息

---

我已经完成 plan_v1 的 `p0-1` 到 `p0-4` 的更新，根据 plan_v1(ai_input/resources/docs/plan_v1.md)的对应内容，帮我在docs下生成一份更新摘要文档（kapibala_slack_agent_v2.md）

---
继续生成一份 kapibala_slack_agent_releasenote_v2.md ,主要基于产品的角度简述更新，包括：

- 一句话总结
- 更新的功能点，对应的应用场景，解决的问题，截图（稍后提供）
- 后续更新计划

---

更新 `expenseClaimAgentApprovalCallback`（server/listeners/actions/expense-claim-agent-approval.ts）
- 如果 `status` 为 `Approved` 在 updateExpenseClaimStatus 方法中更新notion
database 的 Approver
- 参考 `expenseClaimFormCallback`(server/listeners/views/expense-claim-form.ts)

---

继续生成一份 kapibala_slack_agent_releasenote_v2.md ,主要基于产品的角度简述更新，包括：

- 一句话总结
- 更新的功能点，对应的应用场景，解决的问题，截图（稍后提供）
- 后续更新计划

---

更新 `expenseClaimAgentApprovalCallback`（server/listeners/actions/expense-claim-agent-approval.ts）
- 如果 `status` 为 `Approved` 在 updateExpenseClaimStatus 方法中更新notion
database 的 Approver
- 参考 `expenseClaimFormCallback`(server/listeners/views/expense-claim-form.ts)

---
优化 `P0-3: 报销对话式 + 审批` ：

## 说明

- 增加一个通知PAYER操作，在审核人APPROVED后，同步通知PAYER有新的claim需要处理（在expenseClaimAgentApprovalCallback中实现）
- PAYER对应环境变量为EXPENSE_CLAIM_PAYER_EMAIL，参考EXPENSE_CLAIM_APPROVER_EMAIL的使用

在通知信息中增加一个按钮，付款（Pay），点击弹出modal，可以选择Payment Method和Payment Date，提交后通知申请人并同步到notion：
- 参考 expenseClaimApprovalCallback 
- 参考 notion expense claim database 的 schema(ai_input/resources/shortcuts/expnse-claim/schema.json)

---

优化 `P0-4: 招聘对话式提交` ：

## 说明

- 增加一个通知 Interviewer 操作，在提交新的recruitment到notion后，同步在slack通知Interviewer有新的recruitment需要处理（在submitCandidate中实现）
- Interviewer对应环境变量为RECRUITMENT_INTERVIEWER_EMAIL，参考EXPENSE_CLAIM_APPROVER_EMAIL的使用

---
实现 `P1-2: Daily/Weekly 推送` ：

## 说明
- 目标: 定时从 Notion 聚合数据推送到指定频道
- Notion 查询参考：https://developers.notion.com/reference/query-a-data-source.md
- vercel cron 配置参考：https://vercel.com/docs/cron-jobs/quickstart.md
- 新增 server/lib/notion/aggregation.ts — 聚合查询函数（本周反馈数、报销状态、招聘管线、未处理报销（包括未批准和未付款）、未处理招聘）
- 新增 server/routes/cron/ 目录 — Nitro 路由 + Vercel Cron Job
  - weekly-report.ts — 每周一推送到 #dashboard，包括：
    - 本周反馈统计、本周报销统计、本周招聘统计
  - daily-digest.ts — 每日推送到 #dashboard，包括：
    - 未处理报销（Approval Status = Pending）
    - 待付款报销（Approval Status = Approved）
    - 未处理招聘（Current Status = Pending Review）
    - 未处理反馈（Status = Pending）
- 新增 env vars: SLACK_DASHBOARD_CHANNEL_ID, SLACK_RECRUITMENT_CHANNEL_ID
- 推送内容用 Block Kit 格式化（复用 server/lib/slack/blocks.ts 的模式）
注意: 这不是 Agent tool，是独立的 cron job。但 Agent 也应该能回答"这周报告是什么"——复用同一套聚合函数。

---
优化 `P0-2: Agent 查询 Notion`

## 说明

- 用户问：“有哪些招聘未处理“（Current Status = Pending Review）
    - 返回列表数据，包含notion链接
- 用户问：“有哪些报销待审批/处理“（Approval Status = Pending）
    - 返回列表数据，包含notion链接
- 用户问：“有哪些报销待付款“（Approval Status = Approved）
    - 返回列表数据，包含notion链接
- 用户问：“有哪些反馈未处理“（Status = Pending）
    - 返回列表数据，包含notion链接

---

我已经实现 `P1-2:Daily/Weekly 推送` 和优化了 `P0-2: Agent 查询 Notion`  帮我更新相关文档：

## 说明
- 更新 kapibala_slack_agent_releasenote_v2： docs/kapibala_slack_agent_releasenote_v2.md
- 更新 kapibala_slack_agent_v2： docs/kapibala_slack_agent_v2.md
- 已实现 `P1-2:Daily/Weekly 推送`，实现细节：
```markdown
- 目标: 定时从 Notion 聚合数据推送到指定频道
- Notion 查询参考：https://developers.notion.com/reference/query-a-data-source.md
- vercel cron 配置参考：https://vercel.com/docs/cron-jobs/quickstart.md
- 新增 server/lib/notion/aggregation.ts — 聚合查询函数（本周反馈数、报销状态、招聘管线、未处理报销（包括未批准和未付款）、未处理招聘）
- 新增 server/routes/cron/ 目录 — Nitro 路由 + Vercel Cron Job
  - weekly-report.ts — 每周一推送到 #dashboard，包括：
    - 本周反馈统计、本周报销统计、本周招聘统计
  - daily-digest.ts — 每日推送到 #dashboard，包括：
    - 未处理报销（Approval Status = Pending）
    - 待付款报销（Approval Status = Approved）
    - 未处理招聘（Current Status = Pending Review）
    - 未处理反馈（Status = Pending）

```
- 优化了 `P0-2: Agent 查询 Notion`，实现细节：
```markdown
- 用户问：“有哪些招聘未处理“（Current Status = Pending Review）
    - 返回列表数据，包含notion链接
- 用户问：“有哪些报销待审批/处理“（Approval Status = Pending）
    - 返回列表数据，包含notion链接
- 用户问：“有哪些报销待付款“（Approval Status = Approved）
    - 返回列表数据，包含notion链接
- 用户问：“有哪些反馈未处理“（Status = Pending）
    - 返回列表数据，包含notion链接
```

`对话式报销 + 审批` 和 `招聘对话式提交` 也优化了，继续更新文档：

## 说明

- `对话式报销 + 审批` 优化细节：
```markdown
- 增加一个通知PAYER操作，在审核人APPROVED后，同步通知PAYER有新的claim需要处理（在expenseClaimAgentApprovalCallback中实现）
- PAYER对应环境变量为EXPENSE_CLAIM_PAYER_EMAIL，参考EXPENSE_CLAIM_APPROVER_EMAIL的使用

在通知信息中增加一个按钮，付款（Pay），点击弹出modal，可以选择Payment Method和Payment Date，提交后通知申请人并同步到notion：
- 参考 expenseClaimApprovalCallback 
- 参考 notion expense claim database 的 schema(ai_input/resources/shortcuts/expnse-claim/schema.json)

```
- `招聘对话式提交` 优化细节：
```markdown
- 增加一个通知 Interviewer 操作，在提交新的recruitment到notion后，同步在slack通知Interviewer有新的recruitment需要处理（在submitCandidate中实现）

```

---
继续完成任务 `P1-1: 讨论固化 / 会议纪要`：

## 说明
- 根据 plan_v1（ai_input/resources/docs/plan_v1.md）继续完成任务： `P1-1: 讨论固化 / 会议纪要`
- 支持对话式总结thread，例如："总结今天的讨论"，"总结今天关于agent的讨论"，"总结今天@username的发言"等，即支持通过时间+话题+用户的组合来总结thread
- 生成总结文档后同步到notion的docs database

## 实现
- 通过监听 app_mention event来触发，参考：
 - https://docs.slack.dev/reference/events/app_mention.md
- notion 的 docs database schema 参考：
 - ai_input/resources/schemas/docs.json

 ---

继续完成任务 `P1-3: 异常告警`：

## 说明
- 根据 plan_v1（ai_input/resources/docs/plan_v1.md）继续完成任务： `P1-3: 异常告警`

---
继续完成任务 `P2-2: 任务管理`：

## 说明
- 根据 plan_v1（ai_input/resources/docs/plan_v1.md）继续完成任务： `P2-2: 任务管理`
- 支持对话式创建任务，例如：创建一个任务：B1,名称：PG schema 设计，说明：| wa-bridge.ts 落库，实机验证通过（OR登录/sess1on持久化 连接事件 收发消息），分配给@Chu，截止日期：4月1日，优先级高
- 支持对话式更新任务，例如：更新任务：B1，进度：| wa-bridge.ts 落库，实机验证通过（OR登录/sess1on持久化 连接事件 收发消息）
- 可以通过@agent，生成任务进度表，如：@agent，生成今天的任务进度表，格式为markdown表格，并同步到notion docs database

## 实现
- notion 的 tasks database的env参数为：NOTION_TASKS_DATABASE_ID
- notion 的 tasks database schema 参考：
 - ai_input/resources/schemas/tasks.json，重点字段说明：
    - Assignee：任务负责人，与slack的用户通过email映射
    - Task Num：任务编号，如：B1,C1
    - Log：任务日志/进度，每次更新任务进度追加到本字段
- 创建任务
    - 任务默认状态为 `Status=To Do`
    - 自动推断对话中的任务编号，通常为英文+数字，如C1、B3等
    - 自动匹配对话中的人员，如：分配给@Chu，则先通过 slack api的 `users.list` 方法返回用户列表，再通过 `name`、`real_name` 匹配，若给出emai地址，则直接通过 `users.lookupByEmail` 来匹配
    - `users.list`参考文档：https://docs.slack.dev/reference/methods/users.list.md
    - `users.lookupByEmail`参考文档：https://docs.slack.dev/reference/methods/users.lookupByEmail.md
- 更新任务
    - 自动推断对话中的任务编号，通常为英文+数字，如C1、B3等，然后通过notion api 的 `query-a-data-source` 来匹配task，匹配字段为`Task Num`
    - `query-a-data-source`参考文档：https://developers.notion.com/reference/query-a-data-source.md
    - 自动推断对话中的更新描述，追加到notion tasks database 的 `Log` 字段
    - 同时更新任务进度（对应notion 的字段为 `Status` ）若对话中有 已完成、done，100%等表示任务完成的描述，则 `Status=Done`，否则 `Status=In Progress`
- 生成任务进度表
    - 用户通过@agent 来生成进度
    - 通过查询notion tasks database生成任务进度表，比如：今天、本周、本月，时间查询根据tasks 的 `Updated at` 字段
    - 进度使用markdown的表格格式生成，生成结果参考：ai_input/resources/tasks/progress.md
    - 生成结果同步到notion 的 docs database，生成后通知用户并显示notion链接

---

问题：
- 任务负责人没有收到通知，如何对中提到@Chu
- 对话中@Chu没有作为负责人添加到tasks database 的Assignee字段，可以尝试通过slack api 的 `users.profile.get` 获取用户信息，其中可从对话中通过 @提取用户id，如：`<@U0AL2SG6GR0>`
- `users.profile.get`参考文档：https://docs.slack.dev/reference/methods/users.profile.get.md

使用 api 来优化用户搜索： https://docs.slack.dev/apis/web-api/real-time-search-api.md

---
问题：

- 任务进度生成后没有同步到notion 的 docs database并通知用户

---
继续完成任务 `P2-4: 预算管理`：

## 说明
- 根据 plan_v1（ai_input/resources/docs/plan_v1.md）继续完成任务： `P2-4: 预算管理`
- 支持对话式更新预算，如：更新预算，人力资源，1000。agent根据分类和金额以及当前月份更新notion budget database 对应预算数据
- 支持对话式更新支出，如：添加支出，macbook，200。agent根据购买内容推断预算分类，添加到notion expenses database
- 支持对话式查询预算和支出，如：查看本月人力资源预算（已花费，支出/预算占比），查看本月总支出，查看本月设备支出等

## 实现
- 新增env
  - NOTION_BUDGET_DATABASE_ID
  - NOTION_BUDGET_DATASOURCE_ID
  - NOTION_EXPENSES_DATABASE_ID
  - NOTION_EXPENSES_DATASOURCE_ID
  - NOTION_MONTH_DATABASE_ID
  - NOTION_MONTH_DATASOURCE_ID
- 支出分类需要基于notion budget database，agent需要根据对话内容自动匹配对应的分类（提交时使用英文）
- 涉及到relation类型的操作参考：https://developers.notion.com/reference/page-property-values.md中的relation
- notion budget database schema:ai_input/resources/schemas/budget.json
 - Categories：预算分类，对应预算分类表
 - Monthly Budget：月度预算
 - This Month：本月支出
 - Utilization：本月支出/预算占比
- notion month_classification database schema:ai_input/resources/schemas/month.json
 - Month：月份
 - Month Num：月份天数
- notion expenses database schema:ai_input/resources/schemas/expense.json
 - Expense：支出名称
 - Claim：关联报销（Expense Claims），`relation类型`
 - Budget：关联预算，`relation类型`
 - Month Classification：关联月份，`relation类型`
- Expense Claims: curreny 属性取消，默认都是USD,该属性不需要处理
  - 调整agent prompt和创建notion的相关方法
  - 当一笔Expense Claims审核通过时，同步到noton expenses database，字段对应：
   - Expense：使用Claim Title
   - Claim：新建的Expense Claims Page ID
   - Budget：需要根据Expense Claims的内容，推断关联的预算分类，从budget database查询对应id
   - Month Classification：需要根据当前月份，从Month Classification databse查询对应id
- 查询
 - 可以通过budget database 查询到本月支出累计，和本月支出累计/预算占比
 - 分类查询需要用过 expenses database 汇总

问题：

 - 抱歉，系统在记录支出时遇到了问题：Month "March" not found in the Month Classification database
 - Month Classification database的查找字段为Month，值的格式为：月份+年份，如March 2026

还是遇到问题，设备分类未找到。让我查询一下可用的预算分类：
已记录成功！:white_check_mark:
支出: MacBook
金额: $200
分类: Equipment Purchases
月份: March 2026

## 说明
- 根据expense内容推断预算分类即可，不需要推断具体的内容分类


查询遇到问题，直接查budget database 的this month和Utilization无法返回数据（计算类型，notion限制），改为直接查询expenses database 再汇总计算

---

# Kapibala Slack Agent v3 — 更新摘要

> 基于 plan_v1 的 P1-1、P1-3、P2-2、P2-4 实施记录。本次更新在 v2（团队操作中枢）基础上，新增讨论固化、异常告警、任务管理和预算管理四大模块，Agent 进一步成为团队日常运营的核心枢纽。

---

## v2 已有功能（保留）

- P0-1: 对话式提交反馈（submitFeedback）
- P0-2: Agent 查询 Notion（queryMyTasks、queryProjectStatus、queryPendingApprovals、queryPendingItems）
- P0-3: 报销对话式提交 + 审批 + 付款（submitExpenseClaim + HITL 审批流程）
- P0-4: 招聘对话式提交（submitCandidate + Interviewer 通知）
- P1-2: Daily / Weekly 推送（Cron Job）

---

## P1-1: 讨论固化 / 会议纪要

### 目标

用户在频道中 @Agent 即可总结讨论内容，支持按时间、话题、发言人组合过滤，生成结构化总结后同步到 Notion Docs 数据库。

### 触发方式

通过 `app_mention` 事件监听触发（`server/listeners/events/app-mention.ts`）。用户在任意频道 @Agent 发送总结指令，Agent 启动 `chatWorkflow`，在频道内以流式方式回复。

### 新增 Tools

1. `getThreadMessagesForSummary`（`server/lib/ai/tools/notion.ts`）
   - 输入：channel_id、thread_ts?、oldest?、latest?、filter_user_id?
   - 支持 Unix 时间戳和 ISO 8601 日期字符串（自动转换）
   - 支持按用户过滤消息（filter_user_id）
   - 自动解析所有参与者的 real_name，返回格式化的 `[时间] 姓名: 内容` 列表
   - 无 thread_ts 时从频道历史获取消息并按时间正序排列

2. `saveDocToNotion`（`server/lib/ai/tools/notion.ts`）
   - 输入：docName、summary、category（Tech Spec / PRD / Guide / Best Practices / Architecture）、content
   - 使用 HITL 模式：调用后向用户发送「Save to Notion / Cancel」按钮，workflow 暂停等待用户确认
   - Hook 定义：`saveDocApprovalHook`（`server/lib/ai/workflows/hooks.ts`）
   - 确认后调用 `createDoc()` 写入 Notion，自动关联 Author
   - Block Kit UI：`saveDocApprovalBlocks()`（`server/lib/slack/blocks.ts`）
   - Action Handler：`save-doc-approval.ts`（`server/listeners/actions/`）

### Notion 写入层

- `server/lib/notion/docs.ts` — `createDoc()` 函数
  - 写入 Notion Docs Database（`NOTION_DOCS_DATABASE_ID`）
  - 属性：Doc name（title）、Summary（rich_text）、Category（multi_select）、Author（people）
  - 内容写入页面 body（paragraph blocks），自动按 2000 字符分块

### System Prompt 指引

Agent 收到总结请求后：
1. 调用 `getThreadMessagesForSummary` 获取消息（支持时间/用户/话题过滤）
2. 生成结构化总结：背景、要点、决策、待办、参与者
3. 立即调用 `saveDocToNotion`，用户看到确认按钮
4. 用户点击 Save 后写入 Notion，返回链接

### 支持的对话模式

- 「总结今天的讨论」→ oldest 设为今天开始
- 「总结今天关于 agent 的讨论」→ 获取全部消息后按话题聚焦总结
- 「总结今天 @username 的发言」→ 解析用户 ID 后设置 filter_user_id

---

## P1-3: 异常告警

### 目标

定时检查 Notion 中超期未处理的事项（报销、招聘、反馈），超过 3 天未处理的自动推送告警到 #dashboard 频道。

### 新增

- `server/lib/notion/alerts.ts` — 异常检测查询
  - `getAlertDigest(now?)` — 并行查询四类超期数据：
    - 未审批报销（Status = Pending，提交超 3 天）
    - 未付款报销（Status = Approved，审批超 3 天）
    - 未处理招聘（Status = Pending Review）
    - 未处理反馈（Status = Pending，创建超 3 天）
  - `getDaysOverdue(dateStr, now)` — 计算超期天数
  - 类型定义：`OverdueExpense`、`OverdueRecruitment`、`OverdueFeedback`、`AlertDigest`
  - 超期阈值：`OVERDUE_DAYS = 3`（硬编码，后续可配置化）

- `server/routes/cron/alerts.get.ts` — Vercel Cron Job 路由
  - 认证：Bearer token 校验（`CRON_SECRET`）
  - 无超期项时返回 `{ totalAlerts: 0 }` 不推送
  - 有超期项时构建 Block Kit 消息推送到 `SLACK_DASHBOARD_CHANNEL_ID`
  - Block Kit 格式化函数：
    - `buildExpenseAlertSection()` — 分 Pending Approval 和 Awaiting Payment 两组
    - `buildRecruitmentAlertSection()` — Pending Review 候选人
    - `buildFeedbackAlertSection()` — Pending 反馈
    - `buildAlertBlocks()` — 组装完整告警消息（Header + 各分组 + Divider + 时间戳）
  - 每条告警包含：Notion 链接、金额/职位、提交人、超期天数

### 告警规则

| 类型 | 条件 | 超期计算基准 |
|---|---|---|
| 报销待审批 | Approval Status = Pending | Submission Date |
| 报销待付款 | Approval Status = Approved | Submission Date |
| 招聘未处理 | Current Status = Pending Review | Interview Time（无则默认 3 天） |
| 反馈未处理 | Status = Pending | Created Date |

---

## P2-2: 任务管理

### 目标

支持对话式创建任务、更新任务进度、生成任务进度表，所有操作同步 Notion Tasks 数据库。

### 新增 Notion 层

- `server/lib/notion/tasks.ts`
  - `TaskData` 接口：name、taskNum、description、summary、priority、assigneeNotionUserId、dueDate
  - `createTask(data)` — 创建任务页面，默认 Status = To Do
  - `updateTaskStatus(pageId, status)` — 更新任务状态
  - `appendTaskLog(pageId, existingLog, newEntry)` — 追加日志（带时间戳 `[YYYY-MM-DD] entry`）
  - `updateTaskProperties(pageId, updates)` — 批量更新任务属性（status、log、priority、assignee、dueDate）

- `server/lib/notion/query.ts` 新增
  - `TaskRecord` 接口：id、url、name、taskNum、status、priority、description、summary、log、assignee、dueDate、updatedAt
  - `parseTaskPage()` — 解析 Notion 页面为 TaskRecord
  - `queryTasks(filters?)` — 查询任务列表，支持 assignee / status / priority / updatedAfter 过滤
  - `findTaskByNum(taskNum)` — 按 Task Num 精确查找任务（用于更新场景）

### 新增 Tools

1. `createTaskTool`（`server/lib/ai/tools/notion.ts`）
   - 输入：name、taskNum、description、priority（High/Medium/Low）、assignee?、dueDate?
   - 人员匹配：通过 `resolveSlackUserByMention()` 辅助函数，支持三种格式：
     - Slack mention（`<@U0AL2SG6GR0>`）→ 直接提取 user ID
     - 姓名（如 "hcs"、"Chu"）→ 调用 `users.list` 模糊匹配 name / real_name / display_name
     - 邮箱 → 调用 `users.lookupByEmail` 精确匹配
   - 匹配到 Slack 用户后通过 email → `findNotionUser()` 映射到 Notion 用户
   - 创建成功后 DM 通知被分配人（包含任务详情和 Notion 链接）

2. `updateTaskTool`（`server/lib/ai/tools/notion.ts`）
   - 输入：taskNum、progress?、status?（To Do / In Progress / Done）、priority?、assignee?、dueDate?
   - 通过 `findTaskByNum()` 查找任务
   - 进度更新追加到 Log 字段（带时间戳）
   - 状态推断：用户说「done/完成/100%」→ Done，否则有 progress 时自动设为 In Progress
   - 无需用户确认，直接更新

3. `generateTaskProgress`（`server/lib/ai/tools/notion.ts`）
   - 输入：timeRange（today / this_week / this_month / all）、skipSync?
   - 通过 `queryTasks({ updatedAfter })` 按 `last_edited_time` 过滤
   - 生成 Markdown 表格：日期、任务编号、任务名、状态（带 emoji）、最新进展
   - 底部统计：完成数/总数（百分比）
   - 默认自动同步到 Notion Docs 数据库（调用 `createDoc()`）
   - 返回 Notion 链接供用户查看

### 环境变量

| 变量 | 用途 | 必需 |
|---|---|---|
| `NOTION_TASKS_DATABASE_ID` | Tasks 数据库 ID（写入用） | 是 |
| `NOTION_TASKS_DATASOURCE_ID` | Tasks 数据源 ID（查询用） | 是 |

---

## P2-4: 预算管理

### 目标

支持对话式更新预算、添加支出、查询预算状态，所有操作同步 Notion Budget / Expenses / Month Classification 数据库。

### 新增 Notion 层

- `server/lib/notion/budget.ts`
  - `updateBudgetAmount(pageId, monthlyBudget)` — 更新预算金额

- `server/lib/notion/expenses.ts`
  - `ExpenseData` 接口：expenseName、amount、date、claimPageId、budgetPageId、monthPageId
  - `createExpense(data)` — 创建支出记录，关联 Budget（relation）、Month Classification（relation）、Claim（relation，可选）
  - `SyncExpenseClaimInput` 接口 + `syncExpenseClaimToExpenses()` — 报销审批通过后自动同步到 Expenses 数据库

- `server/lib/notion/month.ts`
  - `findMonthByName(monthName)` — 从 Month Classification 数据库查找月份记录
  - `getCurrentMonthName()` — 返回当前月份名称（如 "March 2026"）

- `server/lib/notion/query.ts` 新增
  - `BudgetRecord` 接口：id、url、category、monthlyBudget
  - `parseBudgetPage()` — 解析预算页面
  - `queryBudgets(filters?)` — 查询预算列表
  - `findBudgetByCategory(category)` — 按分类查找预算（支持模糊匹配：精确 → 包含 → 反向包含 → 词级匹配）
  - `ExpenseRecord` 接口：id、url、expense、amount、date
  - `parseExpensePage()` — 解析支出页面
  - `queryExpenses(filters?)` — 按 Budget relation + Month Classification relation 查询支出

### 新增 Tools

1. `updateBudget`（`server/lib/ai/tools/notion.ts`）
   - 输入：category（英文分类名）、monthlyBudget
   - 通过 `findBudgetByCategory()` 模糊匹配分类
   - 预设分类：Human Resources、Rent、Living Expenses、Visa Costs、Materials、Equipment Purchases、Miscellaneous、Transportation & Travel、Client Entertainment

2. `addExpense`（`server/lib/ai/tools/notion.ts`）
   - 输入：expenseName、amount、category（英文）、date?
   - 自动解析当前月份（`getCurrentMonthName()` → `findMonthByName()`）
   - 自动关联 Budget（通过 `findBudgetByCategory()`）和 Month Classification（relation）
   - 日期默认为今天

3. `queryBudgetStatus`（`server/lib/ai/tools/notion.ts`）
   - 输入：category?（不传则查全部）、includeExpenses?
   - 单分类查询：返回预算金额、已花费、占比、Notion 链接
   - 全分类查询：返回所有分类汇总 + 总预算/总支出/总占比
   - 支出通过 Budget relation + Month Classification relation 聚合计算

### Expense Claims 同步

- 报销审批通过时，自动调用 `syncExpenseClaimToExpenses()` 同步到 Expenses 数据库
- 字段映射：Claim Title → Expense、Amount → Amount、Claim Page ID → Claim（relation）
- 自动推断 Budget 分类（根据 expenseType）和 Month Classification（根据当前月份）
- Currency 属性已取消，默认 USD

### System Prompt 指引

- 中文分类自动映射英文：人力资源→Human Resources、房租→Rent、设备→Equipment Purchases 等
- 支出分类推断：MacBook→Equipment Purchases、打车→Transportation & Travel、午饭→Meals 等
- 添加支出需用户确认，更新预算直接执行

### 环境变量

| 变量 | 用途 | 必需 |
|---|---|---|
| `NOTION_BUDGET_DATABASE_ID` | Budget 数据库 ID | 是 |
| `NOTION_BUDGET_DATASOURCE_ID` | Budget 数据源 ID（查询用） | 是 |
| `NOTION_EXPENSES_DATABASE_ID` | Expenses 数据库 ID（写入用） | 是 |
| `NOTION_EXPENSES_DATASOURCE_ID` | Expenses 数据源 ID（查询用） | 是 |
| `NOTION_MONTH_DATABASE_ID` | Month Classification 数据库 ID | 是 |
| `NOTION_MONTH_DATASOURCE_ID` | Month Classification 数据源 ID（查询用） | 是 |

---

## 新增 / 变更文件清单

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `server/listeners/events/app-mention.ts` | 新增 | app_mention 事件监听，启动 chatWorkflow 流式回复 |
| `server/lib/ai/tools/notion.ts` | 修改 | 新增 8 个 tools：getThreadMessagesForSummary、saveDocToNotion、createTaskTool、updateTaskTool、generateTaskProgress、updateBudget、addExpense、queryBudgetStatus |
| `server/lib/ai/agent.ts` | 修改 | System prompt 新增 §8 讨论总结、§10 任务管理、§11 预算管理指引 |
| `server/lib/ai/workflows/hooks.ts` | 修改 | 新增 `saveDocApprovalHook` |
| `server/lib/notion/docs.ts` | 新增 | Notion Docs 写入（createDoc） |
| `server/lib/notion/tasks.ts` | 新增 | Notion Tasks CRUD（createTask、updateTaskStatus、appendTaskLog、updateTaskProperties） |
| `server/lib/notion/budget.ts` | 新增 | Notion Budget 更新（updateBudgetAmount） |
| `server/lib/notion/expenses.ts` | 新增 | Notion Expenses 写入（createExpense、syncExpenseClaimToExpenses） |
| `server/lib/notion/month.ts` | 新增 | Month Classification 查询（findMonthByName、getCurrentMonthName） |
| `server/lib/notion/query.ts` | 修改 | 新增 TaskRecord、BudgetRecord、ExpenseRecord 及对应查询函数 |
| `server/lib/notion/alerts.ts` | 新增 | 异常检测查询（getAlertDigest、getDaysOverdue） |
| `server/routes/cron/alerts.get.ts` | 新增 | 异常告警 Cron Job（Block Kit 格式化 + 推送） |
| `server/lib/slack/blocks.ts` | 修改 | 新增 saveDocApprovalBlocks |
| `server/listeners/actions/save-doc-approval.ts` | 新增 | 文档保存确认 action handler |

## 新增环境变量

| 变量 | 用途 | 必需 |
|---|---|---|
| `NOTION_DOCS_DATABASE_ID` | Docs 数据库 ID（讨论总结写入） | 是 |
| `NOTION_TASKS_DATABASE_ID` | Tasks 数据库 ID（任务写入） | 是 |
| `NOTION_TASKS_DATASOURCE_ID` | Tasks 数据源 ID（任务查询） | 是 |
| `NOTION_BUDGET_DATABASE_ID` | Budget 数据库 ID | 是 |
| `NOTION_BUDGET_DATASOURCE_ID` | Budget 数据源 ID（查询用） | 是 |
| `NOTION_EXPENSES_DATABASE_ID` | Expenses 数据库 ID（写入用） | 是 |
| `NOTION_EXPENSES_DATASOURCE_ID` | Expenses 数据源 ID（查询用） | 是 |
| `NOTION_MONTH_DATABASE_ID` | Month Classification 数据库 ID | 是 |
| `NOTION_MONTH_DATASOURCE_ID` | Month Classification 数据源 ID（查询用） | 是 |
| `CRON_SECRET` | Cron Job 认证 token | 是（告警功能依赖） |

## Agent Tools 总览

| Tool | 类型 | 来源 |
|---|---|---|
| `getChannelMessages` | Slack 读取 | 原有 |
| `getThreadMessages` | Slack 读取 | 原有 |
| `joinChannel` | Slack 操作（HITL） | 原有 |
| `searchChannels` | Slack 查询 | 原有 |
| `submitFeedback` | Notion 写入 | P0-1 |
| `submitExpenseClaim` | Notion 写入 + 审批 | P0-3 |
| `submitCandidate` | Notion 写入 | P0-4 |
| `queryMyTasks` | Notion 查询 | P0-2 |
| `queryProjectStatus` | Notion 查询 | P0-2 |
| `queryPendingApprovals` | Notion 查询 | P0-2 |
| `queryPendingItems` | Notion 查询 | P0-2 |
| `getThreadMessagesForSummary` | Slack 读取 + 过滤 | P1-1 新增 |
| `saveDocToNotion` | Notion 写入（HITL） | P1-1 新增 |
| `createTaskTool` | Notion 写入 + DM 通知 | P2-2 新增 |
| `updateTaskTool` | Notion 更新 | P2-2 新增 |
| `generateTaskProgress` | Notion 查询 + 写入 | P2-2 新增 |
| `updateBudget` | Notion 更新 | P2-4 新增 |
| `addExpense` | Notion 写入 | P2-4 新增 |
| `queryBudgetStatus` | Notion 查询 | P2-4 新增 |

---

## 后续计划（未实施）

- P2-1: 产品知识 RAG → Agent 回答团队知识库问题
- P2-3: 面试日历 + 提醒 → Google Calendar 集成

---
再根据已完成模块和release文档(docs/kTeam_agent_releasenote_v2.md、docs/kTeam_agent_releasenote_v3.md)，生成一份用户使用手册(docs/kTeam_agent_manual.md)，包括：

按技能划分，包括：
- 技能名称
- 技能说明
- 应用场景
- 使用举例
- 返回结果说明
- 流程（如有，例如报销审批）


---
请仔细阅读kapibala公司分析和kTeam后续迭代建议(ai_input/resources/roadmap_v4.md)，帮我生成一份详细的v4迭代计划
---
根据 roadmap_v4(docs/v4/kTeam_roadmap_v4.md), 实现：`Phase 1: Skill 架构引入（P0 — 核心架构升级）`:

- `Phase 0: 统一工作流内核（P0 — 基础设施）`已实现

---

根据 roadmap_v4(docs/v4/kTeam_roadmap_v4.md), 实现：`Phase 2: Pending Center — 统一待处理中心`:

- `Phase 0: 统一工作流内核（P0 — 基础设施）`已实现
- `Phase 1: Skill 架构引入（P0 — 核心架构升级）`已实现

---
根据 roadmap_v4(docs/v4/kTeam_roadmap_v4.md), 实现：`Phase 4: 决策记录系统`:

- `Phase 0: 统一工作流内核（P0 — 基础设施）`已实现
- `Phase 1: Skill 架构引入（P0 — 核心架构升级）`已实现
- `Phase 2: Pending Center — 统一待处理中心（P1）`已实现
- `Phase 3: 会议纪要 → 任务自动化（P2））`暂不实现

---
报销流程(expense_claim)从agent中拆分为skill后，流程与之前相比不完整：

## 说明
- 先确认问题再修改

## 问题
- 应该是没有调用 `submitExpenseClaim` tool

## 缺少步骤
- 用户确认后应该将报销信息提交到notion
- 同步到notion后追问用户是否需要上传发票，显示一个上传按钮
- 用户提交报销后需要同步给报销审核者审核（通过EXPENSE_CLAIM_APPROVER_EMAIL关联），审核结果需要同步给用户并更新notion状态
- 报销审核通过后需要同步给付款者（通过EXPENSE_CLAIM_PAYER_EMAIL关联），审核结果同步用户和notion

---
可以了，顺便检查下skill有没有类似的问题，可以先参考之前的用户手册：docs/kTeam_agent_manual.md
---
招聘技能（recruitment）有问题：

## 之前的效果

```
## 4. 候选人录入

### 技能名称

对话式录入候选人

### 技能说明

在 Slack 中提到候选人信息，Agent 自动提取姓名、职位、来源、联系方式、面试时间等字段，确认后写入 Notion 招聘数据库。提交后自动通知 #recruitments 频道和 Interviewer。

### 应用场景

- HR 在群里说：「有个候选人叫张三，应聘 Software Engineer，LinkedIn 上看到的」
- 面试官推荐：「推荐一个候选人李四，Product Manager，邮箱 lisi@example.com」
- 安排面试：「张三面试时间定在 4月5日」

### 使用举例

**用户：**
> 有个候选人叫张三，应聘 Software Engineer，简历是 LinkedIn 上看到的，邮箱 zhangsan@example.com

**Agent 回复：**
> 收到，我整理了一下：
> - *候选人:* 张三
> - *应聘职位:* Software Engineer
> - *简历来源:* LinkedIn
> - *邮箱:* zhangsan@example.com
>
> 确认后我帮你录入到 Notion。

![候选人录入截图](screenshots/recuitment/recruitment.png)

**用户：** 确认

**Agent 回复：**
> 候选人已录入：[View in Notion](链接)
> 点击下方按钮上传简历附件。
> 已通知 #recruitments 频道。

### 返回结果说明

- 录入成功：返回 Notion 链接 + 简历上传按钮（可上传 PDF 或链接）
- 自动通知 #recruitments 频道（含候选人详情）
- 自动 DM 通知 Interviewer 有新候选人

### 支持的职位

AI Post-Training Engineer、AI Product Engineer / Full-Stack、International Business Development、Software Engineer、Product Manager、UX Designer、HR Specialist

### 支持的简历来源

LinkedIn、Xiaohongshu、Email、Liepin、Other
```

## 实际效果
agent返回：
```
收到，候选人信息：
姓名： 张三
应聘职位： Software Engineer
来源： LinkedIn
请问你需要我帮你做什么？比如：
:memo: 记录到某个地方
:loudspeaker: 分享到某个频道
:question: 其他需求

```
---
目前已经能够识别和使用对应的招聘skill，需要继续优化：

- 优化反应速度，目前由llm做skill路由的速度还是有点慢，看看有没有优化空间
- 优化判断逻辑，如果匹配度够高，直接调用skill，无需二次确认，目前返回了如下的二次确认信息:
```
收到，你是想记录候选人信息吗？
这条信息看起来像是招聘相关的候选人资料，不属于产品反馈（Bug/功能需求等）的范畴。
请问你需要我帮你做什么呢？比如：
记录候选人信息 — 保存到 Notion 的招聘流程中
提交反馈/问题 — 如果是关于招聘系统的 Bug 或改进建议
其他 — 请说明具体需求
请告诉我你的意图，我来帮你处理 :blush:
```
---
询问：“我今天要做什么“时，返回如下错误提示：

```
抱歉，暂时无法获取您的待办事项。系统遇到了一个数据源配置问题（Currency 属性错误）。
建议您：
联系管理员检查 Notion 数据源配置
或稍后再试
您可以直接告诉我需要什么帮助，我会尽力协助您。
```

继续，检查下 roadmap_v4(docs/v4/kTeam_roadmap_v4.md)中的 `Phase 2: Pending Center — 统一待处理中心` 实现

---
根据 roadmap_v4(docs/v4/kTeam_roadmap_v4.md), 实现：`Phase 3: 会议纪要 → 任务自动化（P2））`:

- `Phase 0: 统一工作流内核（P0 — 基础设施）`已实现
- `Phase 1: Skill 架构引入（P0 — 核心架构升级）`已实现
- `Phase 2: Pending Center — 统一待处理中心（P1）`已实现
- `Phase 4: 决策记录系统`已实现
---
目前在报销流程中，APPROVER和PAYER是通过env硬编码传入的email地址来匹配，短期内这个相对固定问题不大，有没有更好的方案能够支持灵活场景，比如默认是env的配置，也支持临时调整，比如在报销时说：让@hcs 来处理付款，然后搜索对应用户 
---

根据 roadmap_v4(docs/v4/kTeam_roadmap_v4.md), 实现：`Phase 5: Knowledge Skill — 团队知识问答`:

- `Phase 0: 统一工作流内核（P0 — 基础设施）`已实现
- `Phase 1: Skill 架构引入（P0 — 核心架构升级）`已实现
- `Phase 2: Pending Center — 统一待处理中心（P1）`已实现
- `Phase 3: 会议纪要 → 任务自动化（P2）））`已实现
- `Phase 4: 决策记录系统`已实现

---
输入：`查一下产品文档`，返回如下提示，应该是没有到notion搜索，检查下实现：
```

抱歉，我在团队知识库中没有找到产品相关文档。可能的原因：
产品文档尚未同步到知识库 — 文档可能在其他位置（如 Confluence、Google Docs 等）
文档命名方式不同 — 知识库中的文档可能使用了其他关键词
建议你可以：
联系产品团队确认文档存放位置
在 Slack 中询问是否有产品文档频道
检查公司内部的文档管理平台
需要我帮你搜索 Slack 中的产品相关频道吗？ (edited) 
[10:56 AM]Hi, how can I help?
[10:57 AM]抱歉，在团队知识库中没有找到产品相关文档。可能的原因：
产品文档尚未同步到知识库 — 文档可能在其他位置（如 Confluence、Google Docs 等）
文档命名方式不同 — 知识库中的文档可能使用了其他关键词
建议你可以：
联系产品团队确认文档存放位置
在 Slack 中询问是否有产品文档频道
检查公司内部的文档管理平台
需要我帮你搜索 Slack 中的产品相关频道吗？
```

---