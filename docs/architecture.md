# Kapibala Team(kTeam) — 项目说明与架构文档

## 概述

基于 Slack Assistant API 的智能 Agent 应用，采用 Skill 架构 + 统一工作流内核，集成 AI 对话、Notion 业务流程和 Human-in-the-Loop 审批机制。

技术栈：TypeScript + Bolt for JavaScript + Nitro Server + AI SDK v6 + Workflow DevKit，部署于 Vercel。

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 运行时 | Nitro | 服务端框架，文件路由，Vercel 部署 |
| Slack 框架 | Bolt for JS + VercelReceiver | 事件处理、交互组件、Assistant API |
| AI | AI SDK v6 + Workflow DevKit DurableAgent | 工具调用、流式响应、持久化执行 |
| 外部集成 | Notion API | 反馈、报销、招聘、任务、预算、决策、知识库数据库 |
| 模型 | OpenAI gpt-5.2-chat (via Vercel AI Gateway) | 对话生成 |

## 项目结构

```
server/                                 # Nitro srcDir
├── app.ts                              # Bolt App + VercelReceiver 初始化入口
├── api/slack/events.post.ts            # 唯一 HTTP 端点（文件路由）
├── listeners/                          # Slack 事件监听器（按类型分组）
│   ├── index.ts                        # 注册所有监听器组
│   ├── assistant/                      # Assistant API（线程启动、用户消息、上下文变更）
│   ├── actions/                        # 交互组件（审批按钮、文件上传、会议 action items 确认等）
│   │   ├── channel-join-approval.ts    # 频道加入审批
│   │   ├── expense-claim-approval.ts   # 报销审批（Shortcut 流程）
│   │   ├── expense-claim-agent-approval.ts  # 报销审批（Agent 对话流程）
│   │   ├── expense-claim-pay.ts        # 报销付款确认
│   │   ├── expense-invoice-upload.ts   # 发票上传
│   │   ├── candidate-resume-upload.ts  # 简历上传
│   │   ├── feedback-button-action.ts   # 反馈按钮
│   │   ├── save-doc-approval.ts        # 文档保存到 Notion 确认
│   │   └── meeting-action-items-approval.ts  # 会议 action items 批量创建确认
│   ├── events/                         # 应用事件（app_mention、app_home_opened）
│   ├── shortcuts/                      # 全局快捷方式（反馈、报销、候选人）
│   ├── views/                          # Modal 表单提交（反馈、报销、候选人、发票、简历）
│   ├── commands/                       # 斜杠命令
│   └── messages/                       # 消息处理
├── routes/
│   └── cron/
│       ├── alerts.get.ts               # 超期告警（SLA 引擎驱动）
│       ├── daily-digest.get.ts         # 每日摘要 + 个人待处理推送
│       └── weekly-report.get.ts        # 每周运营报告
├── lib/
│   ├── ai/
│   │   ├── agent.ts                    # Router Agent + Skill Agent 两层架构
│   │   ├── tools.ts                    # 共享 AI 工具（频道消息、线程、加入频道、搜索）
│   │   ├── tools/
│   │   │   └── notion.ts              # Notion 业务工具（遗留，逐步迁移到 Skills）
│   │   ├── context.ts                  # SlackAgentContextInput 类型
│   │   └── workflows/
│   │       ├── chat.ts                 # 主对话工作流（"use workflow" + Skill 路由）
│   │       └── hooks.ts                # HITL Hook 定义
│   ├── skills/                         # Skill 架构
│   │   ├── types.ts                    # Skill 接口定义
│   │   ├── registry.ts                 # Skill 注册中心
│   │   ├── router.ts                   # Skill 路由器（关键词匹配 + LLM 意图分类）
│   │   ├── runtime.ts                  # Skill 运行时（动态组装 Agent）
│   │   ├── bootstrap.ts               # Skill 启动注册
│   │   ├── index.ts                    # Skill 模块入口
│   │   ├── shared/
│   │   │   └── formatters.ts           # 跨 Skill 共享格式化工具
│   │   ├── recruitment/                # 招聘 Skill
│   │   │   ├── index.ts               #   Skill 定义 + 注册
│   │   │   ├── prompt.ts              #   招聘专属 system prompt
│   │   │   └── tools.ts              #   submitCandidate 等
│   │   ├── expense/                    # 报销 Skill
│   │   │   ├── index.ts
│   │   │   ├── prompt.ts
│   │   │   └── tools.ts              #   submitExpenseClaim 等
│   │   ├── task/                       # 任务 Skill
│   │   │   ├── index.ts
│   │   │   ├── prompt.ts
│   │   │   └── tools.ts              #   createTask, updateTask, generateTaskProgress
│   │   ├── meeting/                    # 会议纪要 Skill
│   │   │   ├── index.ts
│   │   │   ├── prompt.ts
│   │   │   └── tools.ts              #   getThreadMessagesForSummary, saveDocToNotion, createTasksFromMeeting
│   │   ├── budget/                     # 预算 Skill
│   │   │   ├── index.ts
│   │   │   ├── prompt.ts
│   │   │   └── tools.ts              #   updateBudget, addExpense, queryBudgetStatus
│   │   ├── feedback/                   # 反馈 Skill
│   │   │   ├── index.ts
│   │   │   ├── prompt.ts
│   │   │   └── tools.ts              #   submitFeedback, queryMyTasks
│   │   ├── alert/                      # 告警 Skill
│   │   │   ├── index.ts
│   │   │   ├── prompt.ts
│   │   │   └── tools.ts              #   告警查询（主要由 cron 触发）
│   │   ├── pending-center/             # 待处理中心 Skill
│   │   │   ├── index.ts
│   │   │   ├── prompt.ts
│   │   │   └── tools.ts              #   getMyPendingItems（跨模块聚合）
│   │   ├── decision/                   # 决策记录 Skill
│   │   │   ├── index.ts
│   │   │   ├── prompt.ts
│   │   │   └── tools.ts              #   recordDecision, queryDecisions
│   │   └── knowledge/                  # 知识问答 Skill
│   │       ├── index.ts
│   │       ├── prompt.ts
│   │       └── tools.ts              #   askKnowledge（Notion 检索 + LLM 总结）
│   ├── workflow-engine/                # 统一工作流内核
│   │   ├── index.ts                    # 模块入口
│   │   ├── types.ts                    # WorkflowEntity, WorkflowStatus, LogEntry, ApprovalRecord
│   │   ├── status-machine.ts           # 统一状态机（按 EntityType 定义合法转换）
│   │   ├── notifications.ts            # 统一通知机制
│   │   ├── approval.ts                 # 统一审批机制
│   │   ├── sla.ts                      # 统一 SLA 检查（可配置超时阈值）
│   │   └── adapters.ts                 # Notion 记录 ↔ WorkflowEntity 适配器
│   ├── slack/
│   │   ├── blocks.ts                   # Block Kit UI 构建器
│   │   ├── client.ts                   # WebClient 辅助函数
│   │   ├── utils.ts                    # 消息格式化、上下文提取
│   │   ├── files.ts                    # 文件处理
│   │   └── user-resolver.ts            # Slack ↔ Notion 用户解析（@mention、姓名、邮箱）
│   └── notion/
│       ├── client.ts                   # Notion Client 初始化
│       ├── feedback.ts                 # 反馈数据库 CRUD
│       ├── expense-claim.ts            # 报销数据库 CRUD + 审批状态更新
│       ├── recruitment.ts              # 招聘候选人数据库 CRUD
│       ├── tasks.ts                    # 任务数据库 CRUD
│       ├── budget.ts                   # 预算数据库 CRUD
│       ├── expenses.ts                 # 支出数据库 CRUD
│       ├── decisions.ts                # 决策数据库 CRUD
│       ├── docs.ts                     # 文档数据库 CRUD
│       ├── knowledge.ts                # 知识检索（Notion Search API）
│       ├── month.ts                    # 月份分类数据库
│       ├── query.ts                    # 通用查询（待处理项、项目状态）
│       ├── alerts.ts                   # 告警数据查询（SLA 引擎调用）
│       ├── aggregation.ts              # 数据聚合（Weekly Report、Daily Digest）
│       ├── file-upload.ts              # Notion 文件上传
│       └── user-map.ts                 # Slack → Notion 用户映射（带缓存）
manifest.json                           # Slack App Manifest
nitro.config.ts                         # Nitro 配置（srcDir、@workflow/nitro 模块）
biome.json                              # Linter + Formatter
```

## 核心架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Slack 用户交互层                            │
│  (DM / @mention / Shortcuts / Modal / App Home / 按钮)              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    POST /api/slack/events                            │
│                 VercelReceiver → Bolt App → Listener                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌──────────────┐  ┌────────────┐  ┌──────────────┐
     │  Assistant    │  │  Actions   │  │  Shortcuts   │
     │  (对话流程)   │  │  (审批/上传)│  │  (Modal 表单) │
     └──────┬───────┘  └────────────┘  └──────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Skill Router                                  │
│           关键词匹配（快速路径） + LLM 意图分类（兜底）                  │
└──────────────────────────────┬──────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Skill Runtime                                 │
│         动态组装 Agent = Skill prompt + Skill tools + sharedTools     │
│                                                                      │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐           │
│  │Recruitment│ Expense  │  Task    │ Meeting  │ Budget   │           │
│  ├──────────┼──────────┼──────────┼──────────┼──────────┤           │
│  │ Feedback │  Alert   │ Pending  │ Decision │Knowledge │           │
│  │          │          │ Center   │          │          │           │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘           │
└──────────────────────────────┬──────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     统一工作流内核 (workflow-engine)                   │
│                                                                      │
│  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌─────┐ ┌──────────┐  │
│  │ 状态机      │ │ 审批机制  │ │ 通知机制    │ │ SLA │ │ 适配器    │  │
│  │status-     │ │approval  │ │notification│ │     │ │adapters  │  │
│  │machine     │ │          │ │            │ │     │ │          │  │
│  └────────────┘ └──────────┘ └────────────┘ └─────┘ └──────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Notion 数据层                                 │
│                                                                      │
│  Feedback │ Expense Claims │ Recruitment │ Tasks │ Budget │ Expenses │
│  Decisions │ Docs │ Month Classification │ Knowledge (Search API)    │
└─────────────────────────────────────────────────────────────────────┘
```

### 请求流转

```
Slack Event → POST /api/slack/events → VercelReceiver → Bolt App → Listener
```

所有 Slack 交互（事件、命令、快捷方式、按钮、Modal）统一经由 `/api/slack/events` 端点，由 Bolt 路由到对应 Listener。

### AI 对话流程（Skill 架构）

```
用户消息 → assistantUserMessage listener
              ↓
         start(chatWorkflow)         ← "use workflow" 持久化
              ↓
         routeToSkill()              ← 关键词匹配 / LLM 意图分类
              ↓
         createSkillAgent(skill)     ← Skill prompt + Skill tools + sharedTools
              ↓
         agent.stream()              ← 工具调用循环（每个工具 "use step"）
              ↓
         chatStream() → Slack        ← 流式响应
```

共享工具（sharedTools，始终可用）：
- `getChannelMessages` — 读取频道消息
- `getThreadMessages` — 读取线程消息
- `joinChannel` — 加入频道（需用户审批）
- `searchChannels` — 按名称/主题搜索频道

### Skill 路由机制

两阶段路由：

1. 关键词匹配（快速路径）：基于每个 Skill 的 `triggerPatterns`，覆盖 ~80% 明确意图场景
2. LLM 意图分类（兜底）：当关键词无法确定时，用轻量 LLM 调用分类

### Skill 列表

| Skill | 职责 | 核心工具 |
|-------|------|----------|
| recruitment | 招聘管理 | submitCandidate |
| expense | 报销管理 | submitExpenseClaim |
| task | 任务管理 | createTask, updateTask, generateTaskProgress |
| meeting | 会议纪要 | getThreadMessagesForSummary, saveDocToNotion, createTasksFromMeeting |
| budget | 预算管理 | updateBudget, addExpense, queryBudgetStatus |
| feedback | 反馈管理 | submitFeedback, queryMyTasks |
| alert | 告警查询 | 告警相关（主要由 cron 触发） |
| pending-center | 待处理中心 | getMyPendingItems（跨模块聚合） |
| decision | 决策记录 | recordDecision, queryDecisions |
| knowledge | 知识问答 | askKnowledge（Notion 检索 + LLM 总结） |

### 统一工作流内核 (workflow-engine)

所有业务模块共享的基础设施：

| 模块 | 职责 |
|------|------|
| `types.ts` | 统一对象模型：WorkflowEntity、WorkflowStatus、LogEntry、ApprovalRecord |
| `status-machine.ts` | 统一状态机，按 EntityType 定义合法状态转换（pending → approved/rejected 等） |
| `approval.ts` | 统一审批机制，生成审批 Block Kit UI + 处理审批结果 |
| `notifications.ts` | 统一通知机制，替代各模块散落的 `client.chat.postMessage` |
| `sla.ts` | 统一 SLA 检查，按实体类型和状态配置超时阈值 |
| `adapters.ts` | Notion 记录 ↔ WorkflowEntity 双向适配 |

统一状态枚举：
```
pending → in_progress → done
       → approved → done
       → rejected → pending（可重新提交）
       → cancelled
```

### Human-in-the-Loop (HITL)

敏感操作通过 Workflow DevKit 的 `defineHook` 实现暂停-恢复模式：

```
工具触发 → 发送审批按钮 → hook.create() → 工作流暂停
                                              ↓
用户点击按钮 → Action Handler → hook.resume() → 工作流恢复
```

当前 HITL 场景：
- 频道加入审批（`channelJoinApprovalHook`）
- 报销审批（`expenseClaimApprovalCallback` / `expenseClaimAgentApprovalCallback`）
- 报销付款确认（`expenseClaimPayCallback`）
- 文档保存到 Notion 确认（`saveDocApprovalCallback`）
- 会议 action items 批量创建确认（`meetingActionItemsApprovalCallback`）

### Notion 数据层

| 数据库 | 用途 | 环境变量 |
|--------|------|----------|
| Feedback | 反馈记录（Bug/Feature/Improvement） | `NOTION_FEEDBACK_DATABASE_ID` |
| Expense Claims | 报销单（金额、审批、付款） | `NOTION_EXPENSE_CLAIM_DATABASE_ID` |
| Recruitment | 招聘候选人 | `NOTION_RECRUITMENT_DATABASE_ID` |
| Tasks | 任务管理 | `NOTION_TASKS_DATABASE_ID` |
| Budget | 月度预算 | `NOTION_BUDGET_DATABASE_ID` |
| Expenses | 支出记录 | `NOTION_EXPENSES_DATABASE_ID` |
| Decisions | 决策记录 | `NOTION_DECISIONS_DATABASE_ID` |
| Docs | 文档/会议纪要 | `NOTION_DOCS_DATABASE_ID` |
| Month Classification | 月份分类 | `NOTION_MONTH_DATABASE_ID` |

共享能力：
- Notion 文件上传（`file-upload.ts`）
- Slack → Notion 用户映射（`user-map.ts`，内存缓存）
- 用户解析（`user-resolver.ts`，支持 @mention、姓名、邮箱三种方式）
- 知识检索（`knowledge.ts`，Notion Search API 全文搜索）

### 定时任务 (Cron)

| 路由 | 频率 | 功能 |
|------|------|------|
| `/cron/alerts` | 每日 | 超期告警（SLA 引擎驱动），推送到 #dashboard |
| `/cron/daily-digest` | 每日 | 每日摘要 + 个人待处理 DM 推送 |
| `/cron/weekly-report` | 每周一 | 周报（反馈/报销/招聘统计） |

## 环境变量

| 变量 | 必需 | 用途 |
|------|------|------|
| `SLACK_BOT_TOKEN` | ✅ | Bot OAuth Token |
| `SLACK_SIGNING_SECRET` | ✅ | 请求签名验证 |
| `AI_GATEWAY_API_KEY` | ✅ | Vercel AI Gateway |
| `NOTION_KEY` | ✅ | Notion API Token |
| `NOTION_FEEDBACK_DATABASE_ID` | ✅ | 反馈数据库 ID |
| `NOTION_EXPENSE_CLAIM_DATABASE_ID` | ✅ | 报销数据库 ID |
| `NOTION_RECRUITMENT_DATABASE_ID` | ✅ | 招聘数据库 ID |
| `NOTION_TASKS_DATABASE_ID` | ✅ | 任务数据库 ID |
| `NOTION_BUDGET_DATABASE_ID` | ✅ | 预算数据库 ID |
| `NOTION_EXPENSES_DATABASE_ID` | ✅ | 支出数据库 ID |
| `NOTION_DECISIONS_DATABASE_ID` | ✅ | 决策数据库 ID |
| `NOTION_DOCS_DATABASE_ID` | ✅ | 文档数据库 ID |
| `NOTION_MONTH_DATABASE_ID` | ✅ | 月份分类数据库 ID |
| `NGROK_AUTH_TOKEN` | — | 本地开发隧道 |

## 开发命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 启动本地开发服务器
pnpm dev:tunnel       # 开发服务器 + ngrok 隧道
pnpm build            # 生产构建
pnpm lint             # Biome 检查
pnpm lint:fix         # 自动修复 lint 问题
pnpm typecheck        # TypeScript 类型检查
pnpm test             # 运行测试
```
