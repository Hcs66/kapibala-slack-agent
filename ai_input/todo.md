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