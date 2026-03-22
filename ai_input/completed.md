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

