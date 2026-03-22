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

