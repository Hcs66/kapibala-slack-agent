# kTeam Agent v3 — 更新摘要

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

---

## 新增 / 变更文件清单

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `server/listeners/events/app-mention.ts` | 新增 | app_mention 事件监听，启动 chatWorkflow 流式回复 |
| `server/lib/ai/tools/notion.ts` | 修改 | 新增 8 个 tools |
| `server/lib/ai/agent.ts` | 修改 | System prompt 新增 §8 讨论总结、§10 任务管理、§11 预算管理指引 |
| `server/lib/ai/workflows/hooks.ts` | 修改 | 新增 `saveDocApprovalHook` |
| `server/lib/notion/docs.ts` | 新增 | Notion Docs 写入（createDoc） |
| `server/lib/notion/tasks.ts` | 新增 | Notion Tasks CRUD |
| `server/lib/notion/budget.ts` | 新增 | Notion Budget 更新 |
| `server/lib/notion/expenses.ts` | 新增 | Notion Expenses 写入 + 报销同步 |
| `server/lib/notion/month.ts` | 新增 | Month Classification 查询 |
| `server/lib/notion/query.ts` | 修改 | 新增 TaskRecord、BudgetRecord、ExpenseRecord 及查询函数 |
| `server/lib/notion/alerts.ts` | 新增 | 异常检测查询 |
| `server/routes/cron/alerts.get.ts` | 新增 | 异常告警 Cron Job |
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
