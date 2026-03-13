# Kapibala Team(kTeam) — 项目说明与架构文档

## 概述

基于 Slack Assistant API 的智能 Agent 应用，集成 AI 对话、Notion 业务流程和 Human-in-the-Loop 审批机制。

技术栈：TypeScript + Bolt for JavaScript + Nitro Server + AI SDK v6 + Workflow DevKit，部署于 Vercel。

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 运行时 | Nitro | 服务端框架，文件路由，Vercel 部署 |
| Slack 框架 | Bolt for JS + VercelReceiver | 事件处理、交互组件、Assistant API |
| AI | AI SDK v6 + Workflow DevKit DurableAgent | 工具调用、流式响应、持久化执行 |
| 外部集成 | Notion API | 反馈、报销、招聘数据库 |
| 模型 | OpenAI gpt-5.2-chat (via Vercel AI Gateway) | 对话生成 |

## 项目结构

```
server/                           # Nitro srcDir
├── app.ts                        # Bolt App + VercelReceiver 初始化入口
├── api/slack/events.post.ts      # 唯一 HTTP 端点（文件路由）
├── listeners/                    # Slack 事件监听器（按类型分组）
│   ├── index.ts                  # 注册所有监听器组
│   ├── assistant/                # Assistant API（线程启动、用户消息、上下文变更）
│   ├── actions/                  # 交互组件（按钮审批：频道加入、报销）
│   ├── events/                   # 应用事件（app_mention、app_home_opened）
│   ├── shortcuts/                # 全局快捷方式（反馈、报销、候选人）
│   ├── views/                    # Modal 表单提交（反馈、报销、候选人）
│   ├── commands/                 # 斜杠命令
│   └── messages/                 # 消息处理
├── lib/
│   ├── ai/
│   │   ├── agent.ts              # DurableAgent 工厂（系统提示词 + 工具绑定）
│   │   ├── tools.ts              # AI 工具定义（频道消息、线程、加入频道、搜索）
│   │   ├── context.ts            # SlackAgentContextInput 类型
│   │   └── workflows/
│   │       ├── chat.ts           # 主对话工作流（"use workflow"）
│   │       └── hooks.ts          # HITL Hook 定义（频道加入审批）
│   ├── slack/
│   │   ├── blocks.ts             # Block Kit UI 构建器
│   │   ├── client.ts             # WebClient 辅助函数
│   │   ├── utils.ts              # 消息格式化、上下文提取
│   │   └── files.ts              # 文件处理
│   └── notion/
│       ├── client.ts             # Notion Client 初始化
│       ├── feedback.ts           # 反馈数据库 CRUD
│       ├── expense-claim.ts      # 报销数据库 CRUD + 审批状态更新
│       ├── recruitment.ts        # 招聘候选人数据库 CRUD
│       ├── file-upload.ts        # Notion 文件上传
│       └── user-map.ts           # Slack → Notion 用户映射（带缓存）
manifest.json                     # Slack App Manifest
nitro.config.ts                   # Nitro 配置（srcDir、@workflow/nitro 模块）
biome.json                        # Linter + Formatter
```

## 核心架构

### 请求流转

```
Slack Event → POST /api/slack/events → VercelReceiver → Bolt App → Listener
```

所有 Slack 交互（事件、命令、快捷方式、按钮、Modal）统一经由 `/api/slack/events` 端点，由 Bolt 路由到对应 Listener。

### AI 对话流程

```
用户消息 → assistantUserMessage listener
              ↓
         start(chatWorkflow)    ← "use workflow" 持久化
              ↓
         createSlackAgent()     ← DurableAgent + 系统提示词 + 工具
              ↓
         agent.stream()         ← 工具调用循环（每个工具 "use step"）
              ↓
         chatStream() → Slack   ← 流式响应
```

Agent 工具：
- `getChannelMessages` — 读取频道消息
- `getThreadMessages` — 读取线程消息
- `joinChannel` — 加入频道（需用户审批）
- `searchChannels` — 按名称/主题搜索频道

### Human-in-the-Loop (HITL)

敏感操作（如加入频道、报销审批）通过 Workflow DevKit 的 `defineHook` 实现暂停-恢复模式：

```
工具触发 → 发送审批按钮 → hook.create() → 工作流暂停
                                              ↓
用户点击按钮 → Action Handler → hook.resume() → 工作流恢复
```

当前 HITL 场景：
- 频道加入审批（`channelJoinApprovalHook`）
- 报销审批（`expenseClaimApprovalCallback`）

### Notion 业务集成

通过 Slack 全局快捷方式触发 Modal 表单，提交后写入 Notion 数据库：

| 快捷方式 | Modal | Notion 数据库 | 功能 |
|----------|-------|---------------|------|
| `new_feedback` | 反馈表单 | Feedback DB | 创建反馈记录（类型、优先级、标签、附件） |
| `expense_claim` | 报销表单 | Expense Claim DB | 创建报销单（金额、类型、发票附件）+ 审批流 |
| `new_candidate` | 候选人表单 | Recruitment DB | 创建候选人（职位、简历、面试时间） |

共享能力：
- Notion 文件上传（`file-upload.ts`）
- Slack → Notion 用户映射（`user-map.ts`，内存缓存）

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
| `NGROK_AUTH_TOKEN` | — | 本地开发隧道 |

## 开发命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 启动本地开发服务器
pnpm dev:tunnel       # 开发服务器 + ngrok 隧道
pnpm build            # 生产构建
pnpm lint             # Biome 检查
pnpm typecheck        # TypeScript 类型检查
```
