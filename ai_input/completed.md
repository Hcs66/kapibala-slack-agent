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
