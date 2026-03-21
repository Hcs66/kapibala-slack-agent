# Kapibala Slack Agent v2 — 更新摘要

> 基于 plan_v1 的 P0-1 ~ P0-4 实施记录。本次更新的核心目标：将 Agent 从「Slack 读消息助手」升级为「团队操作中枢」，Agent 成为 Notion 的智能中间层。

---

## 基础设施变更

### 1. SlackAgentContextInput 扩展

`server/lib/ai/context.ts` 新增 `user_id` 字段，用于 Slack → Notion 用户映射，支撑「我的任务」等需要身份识别的查询场景。

### 2. Notion 查询层

新建 `server/lib/notion/query.ts`，封装 Notion DataSource API 的通用查询逻辑：

- 属性提取工具函数：`extractTitle`、`extractRichText`、`extractSelect`、`extractStatus`、`extractNumber`、`extractDate`、`extractPeople`、`extractMultiSelect`、`extractUrl`、`extractEmail`、`extractPhone`
- 类型化记录接口：`FeedbackRecord`、`ExpenseClaimRecord`、`RecruitmentRecord`
- 页面解析函数：`parseFeedbackPage`、`parseExpenseClaimPage`、`parseRecruitmentPage`
- 三个查询函数：
  - `queryFeedback(filters?)` — 按 assignee / type / priority / source 过滤
  - `queryExpenseClaims(filters?)` — 按 submitter / approvalStatus 过滤
  - `queryRecruitment(filters?)` — 按 positionApplied / currentStatus 过滤

### 3. Notion Tools 独立文件

新建 `server/lib/ai/tools/notion.ts`，与 `tools.ts`（Slack tools）平级，避免单文件膨胀。通过 `agent.ts` 中 `{ ...slackTools, ...notionTools }` 合并注入 Agent。

### 4. 用户映射复用

Notion tools 内部通过 `resolveNotionUserId()` 辅助函数，调用 Slack `users.info` 获取邮箱后复用 `user-map.ts` 的 `findNotionUser()` 完成 Slack → Notion 用户映射。

### 5. Agent System Prompt 更新

`server/lib/ai/agent.ts` 的 system prompt 从纯 Slack 上下文扩展为包含 Notion 操作指引的完整决策流程，涵盖 Feedback 提交、报销提交、候选人录入、Notion 查询四大场景。

---

## P0-1: 对话式提交反馈

### 新增

- `submitFeedback` tool（`server/lib/ai/tools/notion.ts`）
  - 输入：name、type（Bug / Feature Request / Improvement / Question / Other）、description、priority（P0-P3）、source（Internal / Customer / Partner）、customer?、tags?
  - 内部复用 `server/lib/notion/feedback.ts` 的 `createFeedback()`
  - 自动解析提交者的 Notion 用户 ID 并关联 Created By
  - 提交成功后若配置了 `SLACK_FEEDBACK_CHANNEL_ID`，自动推送通知到反馈频道

### System Prompt 指引

Agent 从用户自然语言中提取结构化字段 → 展示摘要让用户确认 → 用户确认后调用 tool 写入。Priority 由 LLM 根据语义推断（如「客户反馈 + 急」= P1），无需硬编码规则。

### 保留

Modal shortcut（`server/listeners/shortcuts/new-feedback.ts`）作为 fallback 保留不删除。

---

## P0-2: Agent 查询 Notion

### 新增 3 个 Query Tools

1. `queryMyTasks` — 查询当前用户被分配的 Feedback 条目，支持 type / priority 过滤。需要 Slack → Notion 用户映射，映射失败时返回友好提示。
2. `queryProjectStatus` — 通用项目状态查询，支持 feedback / expense_claims / recruitment 三个数据库，各自支持对应的过滤条件。
3. `queryPendingApprovals` — 查询待审批报销记录，返回 pending / approved / rejected 的统计摘要。

### 结果格式化

每个 query tool 内置格式化函数（`formatFeedbackList`、`formatExpenseClaimList`、`formatRecruitmentList`），将 Notion 数据转为人类可读的 Slack mrkdwn 格式，包含 Notion 链接。

### 环境变量

复用现有的 `NOTION_FEEDBACK_DATASOURCE_ID`、`NOTION_EXPENSE_CLAIM_DATASOURCE_ID`、`NOTION_RECRUITMENT_DATASOURCE_ID`。

---

## P0-3: 报销对话式提交 + 审批

### 新增

- `submitExpenseClaim` tool（`server/lib/ai/tools/notion.ts`）
  - 输入：claimTitle、claimDescription、amount、currency（CNY / USD / AED）、expenseType（Travel / Office Supplies / Entertainment / Training / Meals / Equipment / Other）
  - 内部复用 `server/lib/notion/expense-claim.ts` 的 `createExpenseClaim()`
  - 自动解析提交者 Notion 用户 ID 并关联 Submitted By

### 审批流程

- 提交后自动推送审批消息到 `SLACK_APPROVALS_CHANNEL_ID` 频道，包含 Approve / Reject 按钮
- 审批 Block Kit UI：`expenseClaimApprovalBlocks()`（`server/lib/slack/blocks.ts`）
- 审批 Action Handler：`expense-claim-agent-approval.ts`
  - 点击按钮后更新 Notion 页面状态（`updateExpenseClaimStatus`）
  - DM 通知提交者审批结果
  - 更新审批消息为最终状态（含审批人信息）
  - 异常时显示 Sync Failed 提示，引导手动更新

### 发票上传

- 提交成功后在对话线程中发送「上传发票」按钮（`expenseInvoiceUploadBlocks`）
- 点击按钮打开 Modal（`expense-invoice-upload.ts` action handler）
- Modal 提交后通过 `file-upload.ts` 上传至 Notion 并更新页面附件（`updateExpenseClaimAttachments`）
- 支持最多 3 个发票文件

### 与 Modal 流程的关系

Modal 流程（`server/listeners/shortcuts/expense-claim.ts`）保留，两种入口共用同一套 Notion 写入和审批逻辑。

---

## P0-4: 招聘对话式提交

### 新增

- `submitCandidate` tool（`server/lib/ai/tools/notion.ts`）
  - 输入：candidateName、positionApplied（7 个预设职位）、resumeSource（LinkedIn / Xiaohongshu / Email / Liepin / Other）、phone?、email?、interviewTime?、zoomMeetingLink?、resumeLink?
  - 内部复用 `server/lib/notion/recruitment.ts` 的 `createCandidate()`

### 频道通知

提交成功后若配置了 `SLACK_RECRUITMENT_CHANNEL_ID`，自动推送候选人信息到招聘频道（含所有可选字段）。

### 简历上传

- 提交成功后在对话线程中发送「上传简历」按钮（`candidateResumeUploadBlocks`）
- 点击按钮打开 Modal（`candidate-resume-upload.ts` action handler）
- Modal 提交后上传至 Notion 并更新页面附件（`updateCandidateResume`）

### 保留

Modal shortcut（`server/listeners/shortcuts/new-candidate.ts`）作为 fallback 保留不删除。

---

## 新增 / 变更文件清单

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `server/lib/ai/context.ts` | 修改 | 新增 `user_id` 字段 |
| `server/lib/ai/agent.ts` | 修改 | 合并 notionTools、更新 system prompt |
| `server/lib/ai/tools/notion.ts` | 新增 | 6 个 Notion tools 定义 |
| `server/lib/ai/tools/notion.test.ts` | 新增 | Notion tools 单元测试（780 行） |
| `server/lib/notion/query.ts` | 新增 | Notion 查询层 + 属性提取 + 记录解析 |
| `server/lib/slack/blocks.ts` | 修改 | 新增报销审批、发票上传、简历上传 Block Kit |
| `server/lib/slack/files.ts` | 新增 | Slack 文件下载工具函数 |
| `server/lib/notion/expense-claim.ts` | 修改 | 新增 `updateExpenseClaimStatus`、`updateExpenseClaimAttachments` |
| `server/lib/notion/recruitment.ts` | 修改 | 新增 `updateCandidateResume` |
| `server/listeners/actions/expense-claim-agent-approval.ts` | 新增 | Agent 报销审批 action handler |
| `server/listeners/actions/expense-invoice-upload.ts` | 新增 | 发票上传按钮 action handler |
| `server/listeners/actions/candidate-resume-upload.ts` | 新增 | 简历上传按钮 action handler |
| `server/listeners/views/expense-invoice-upload.ts` | 新增 | 发票上传 Modal view handler |
| `server/listeners/views/candidate-resume-upload.ts` | 新增 | 简历上传 Modal view handler |
| `server/listeners/actions/index.ts` | 修改 | 注册新 action handlers |
| `server/listeners/views/index.ts` | 修改 | 注册新 view handlers |

## 新增环境变量

| 变量 | 用途 | 必需 |
|---|---|---|
| `SLACK_FEEDBACK_CHANNEL_ID` | 反馈通知频道 | 否（不配置则跳过通知） |
| `SLACK_APPROVALS_CHANNEL_ID` | 报销审批频道 | 否（不配置则跳过审批推送） |
| `SLACK_RECRUITMENT_CHANNEL_ID` | 招聘通知频道 | 否（不配置则跳过通知） |
| `NOTION_FEEDBACK_DATASOURCE_ID` | Feedback 数据源 ID（查询用） | 是（查询功能依赖） |
| `NOTION_EXPENSE_CLAIM_DATASOURCE_ID` | Expense Claim 数据源 ID（查询用） | 是（查询功能依赖） |
| `NOTION_RECRUITMENT_DATASOURCE_ID` | Recruitment 数据源 ID（查询用） | 是（查询功能依赖） |

## Agent Tools 总览

| Tool | 类型 | 来源 |
|---|---|---|
| `getChannelMessages` | Slack 读取 | 原有 |
| `getThreadMessages` | Slack 读取 | 原有 |
| `joinChannel` | Slack 操作（HITL） | 原有 |
| `searchChannels` | Slack 查询 | 原有 |
| `submitFeedback` | Notion 写入 | P0-1 新增 |
| `submitExpenseClaim` | Notion 写入 + 审批 | P0-3 新增 |
| `submitCandidate` | Notion 写入 | P0-4 新增 |
| `queryMyTasks` | Notion 查询 | P0-2 新增 |
| `queryProjectStatus` | Notion 查询 | P0-2 新增 |
| `queryPendingApprovals` | Notion 查询 | P0-2 新增 |

---

## 后续计划（未实施）

- P1-1: 讨论固化 / 会议纪要 → `createDecisionRecord` tool
- P1-2: Daily / Weekly 推送 → Vercel Cron Job
- P1-3: 异常告警 → 超期任务、未审批报销提醒
- P2-1: 产品知识 RAG
- P2-2: CTO 任务分配
- P2-3: 面试日历 + 提醒
