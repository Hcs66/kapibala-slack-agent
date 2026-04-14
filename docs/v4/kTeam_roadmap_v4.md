# kTeam v4 迭代计划

## 现状盘点

当前 kTeam 已实现的能力：

| 模块 | 能力 | 实现方式 |
|------|------|----------|
| Slack 交互 | 频道消息读取、线程消息、加入频道(HITL)、频道搜索 | `server/lib/ai/tools.ts` — 4 个 slackTools |
| 反馈系统 | 提交 Bug/Feature Request、查询我的任务、项目状态查询、待处理查询 | `server/lib/ai/tools/notion.ts` — submitFeedback, queryMyTasks, queryProjectStatus, queryPendingItems |
| 报销系统 | 提交报销、审批(HITL)、付款确认、发票上传、预算联动 | submitExpenseClaim + expense-claim-approval action + expense-claim-pay action |
| 招聘系统 | 提交候选人、简历上传、面试官通知 | submitCandidate + candidate-resume-upload |
| 任务系统 | 创建任务、更新进度、生成进度报告 | createTaskTool, updateTaskTool, generateTaskProgress |
| 预算系统 | 更新预算、添加支出、查询预算状态 | updateBudget, addExpense, queryBudgetStatus |
| 会议纪要 | 获取讨论消息、生成摘要、保存到 Notion(HITL) | getThreadMessagesForSummary, saveDocToNotion |
| 告警系统 | 超期报销/招聘/反馈告警、每日摘要、每周报告 | `server/routes/cron/alerts.get.ts`, daily-digest, weekly-report |
| 数据层 | Notion 作为统一数据库（Feedback、Expense Claims、Recruitment、Tasks、Budget、Expenses、Docs、Month Classification） | `server/lib/notion/` 下各模块 |

**架构特征：**
- 单 Agent 架构：所有能力堆在一个 `createSlackAgent()` 中，system prompt ~300 行
- 工具平铺：`slackTools` + `notionTools` 全部注入同一个 Agent
- Workflow DevKit 已集成：`"use workflow"` + `"use step"` + `defineHook` 模式成熟
- Notion 作为唯一持久化层，无独立数据库
- Cron 告警已有基础框架

---

## v4 核心目标

**从「单 Agent + 工具堆叠」升级为「Skill 架构 + 统一工作流内核」**

---

## 迭代阶段规划

### Phase 0: 统一工作流内核（P0 — 基础设施）

**目标：** 建立统一的对象模型和工作流引擎，让后续所有 Skill 共享同一套状态机、通知、审批机制。

**为什么最先做：** roadmap 明确指出「这是最优先事项」。当前各模块（报销、招聘、任务、反馈）各自定义状态、通知逻辑，代码重复且不一致。不统一内核，后续 Skill 化只是换了个组织方式，本质问题不变。

#### 0.1 统一对象模型

**当前问题：**
- ExpenseClaimRecord 有 `status: Pending/Approved/Rejected/Paid`
- RecruitmentRecord 有 `status: Pending Review/...`
- FeedbackRecord 有 `status: Pending/...`
- TaskRecord 有 `status: To Do/In Progress/Done`
- 每个模块的字段命名、状态流转、日志格式都不同

**实现内容：**

1. 创建 `server/lib/workflow-engine/types.ts` — 统一对象接口：

```typescript
export interface WorkflowEntity {
  id: string;
  type: EntityType; // "expense_claim" | "recruitment" | "task" | "feedback" | "decision"
  owner: string;           // Notion user ID
  assignee?: string;       // Notion user ID
  priority: Priority;      // "P0" | "P1" | "P2" | "P3" 或 "High" | "Medium" | "Low"
  status: WorkflowStatus;  // 统一状态枚举
  dueDate?: string;
  logs: LogEntry[];
  approvals: ApprovalRecord[];
  createdAt: string;
  updatedAt: string;
  notionPageId: string;
  notionPageUrl: string;
}

export type WorkflowStatus =
  | "pending"
  | "in_progress"
  | "approved"
  | "rejected"
  | "done"
  | "cancelled";

export interface LogEntry {
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
}

export interface ApprovalRecord {
  approver: string;
  decision: "approved" | "rejected";
  timestamp: string;
  comment?: string;
}
```

2. 创建 `server/lib/workflow-engine/status-machine.ts` — 统一状态机：

```typescript
// 定义每种 EntityType 的合法状态转换
const TRANSITIONS: Record<EntityType, Record<WorkflowStatus, WorkflowStatus[]>> = {
  expense_claim: {
    pending: ["approved", "rejected", "cancelled"],
    approved: ["done", "cancelled"],  // done = paid
    rejected: ["pending"],            // 可重新提交
    // ...
  },
  task: {
    pending: ["in_progress", "cancelled"],
    in_progress: ["done", "pending"],
    // ...
  },
  // ...
};

export function canTransition(type: EntityType, from: WorkflowStatus, to: WorkflowStatus): boolean;
export function transition(entity: WorkflowEntity, to: WorkflowStatus, actor: string): WorkflowEntity;
```

3. 创建 `server/lib/workflow-engine/notifications.ts` — 统一通知机制：

```typescript
// 替代当前各模块中散落的 client.chat.postMessage 逻辑
export async function notifyStatusChange(params: {
  entity: WorkflowEntity;
  oldStatus: WorkflowStatus;
  newStatus: WorkflowStatus;
  actor: string;
  token: string;
  slackUserMap: Record<string, string>; // notionUserId -> slackUserId
}): Promise<void>;

export async function notifyAssignment(params: {
  entity: WorkflowEntity;
  assignee: string;
  assigner: string;
  token: string;
}): Promise<void>;
```

4. 创建 `server/lib/workflow-engine/approval.ts` — 统一审批机制：

```typescript
// 抽象当前 expense-claim-approval 和 channel-join-approval 的共性
export function createApprovalRequest(params: {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  requesterId: string;
  approvalChannel: string;
  metadata: Record<string, unknown>;
}): SlackBlock[];

export async function processApproval(params: {
  entityId: string;
  decision: "approved" | "rejected";
  approver: string;
  comment?: string;
}): Promise<WorkflowEntity>;
```

5. 创建 `server/lib/workflow-engine/sla.ts` — 统一 SLA 检查：

```typescript
// 替代当前 alerts.ts 中硬编码的 OVERDUE_DAYS = 3
export interface SLAConfig {
  entityType: EntityType;
  status: WorkflowStatus;
  maxDurationHours: number;
  escalationTarget?: string; // Slack channel or user
}

export const DEFAULT_SLA: SLAConfig[] = [
  { entityType: "expense_claim", status: "pending", maxDurationHours: 72 },
  { entityType: "recruitment", status: "pending", maxDurationHours: 72 },
  { entityType: "feedback", status: "pending", maxDurationHours: 72 },
];

export async function checkSLAViolations(now?: Date): Promise<SLAViolation[]>;
```

**验收标准：**
- 所有现有模块（报销、招聘、任务、反馈）可通过统一接口进行状态转换
- 统一通知函数替代各模块中的 `client.chat.postMessage` 散落逻辑
- 统一审批流程可被报销审批和未来新审批场景复用
- SLA 检查替代 `alerts.ts` 中的硬编码逻辑
- 现有功能不回归（所有现有 tool 行为不变）

**预估工作量：** 5-7 天

---

#### 0.2 重构现有模块适配统一内核

**实现内容：**

1. 重构 `server/lib/notion/query.ts` — 返回值适配 `WorkflowEntity` 接口（或提供 adapter）
2. 重构 `server/lib/notion/alerts.ts` — 使用 `sla.ts` 替代硬编码
3. 重构 `server/listeners/actions/expense-claim-approval.ts` — 使用统一审批机制
4. 重构 `server/listeners/actions/expense-claim-pay.ts` — 使用统一状态机
5. 为每个 Notion 数据库的 status 字段建立映射表（Notion status name ↔ WorkflowStatus）

**验收标准：**
- `pnpm typecheck && pnpm lint && pnpm test` 全部通过
- 现有 Slack 交互行为完全不变
- 告警 cron 使用新 SLA 引擎

**预估工作量：** 3-5 天

---

### Phase 1: Skill 架构引入（P0 — 核心架构升级）

**目标：** 将单一 Agent 拆分为 Skill Router + Skill Registry + 独立 Skill 模块。

**为什么紧跟 Phase 0：** 统一内核就绪后，Skill 化才有意义。否则每个 Skill 还是各自为政。

#### 1.1 Skill 基础架构

**创建目录结构：**

```
server/lib/skills/
├── types.ts          # Skill 接口定义
├── registry.ts       # Skill 注册中心
├── router.ts         # Skill 路由器（意图识别 → Skill 分发）
└── runtime.ts        # Skill 运行时（加载 prompt + tools + workflow）
```

**Skill 接口定义 (`types.ts`)：**

```typescript
export interface Skill {
  name: string;                    // e.g. "recruitment"
  description: string;             // 用于 Router 意图匹配
  triggerPatterns: string[];       // 触发关键词/正则
  systemPrompt: string;            // Skill 专属 prompt
  tools: Record<string, Tool>;     // Skill 专属 tools
  workflows?: Record<string, Function>; // Skill 专属 workflow
  resources?: SkillResource[];     // Skill 依赖的 Notion DB 等
}

export interface SkillResource {
  type: "notion_database" | "slack_channel" | "env_var";
  name: string;
  envKey: string;
}
```

**Skill Router (`router.ts`)：**

```typescript
// 两阶段路由：
// 1. 关键词匹配（快速路径）— 基于 triggerPatterns
// 2. LLM 意图分类（兜底）— 当关键词无法确定时，用轻量 LLM 调用分类

export async function routeToSkill(
  userMessage: string,
  availableSkills: Skill[],
  context: SlackAgentContextInput,
): Promise<{ skill: Skill; confidence: number }>;
```

**Skill Registry (`registry.ts`)：**

```typescript
// 全局 Skill 注册表
const skills: Map<string, Skill> = new Map();

export function registerSkill(skill: Skill): void;
export function getSkill(name: string): Skill | undefined;
export function getAllSkills(): Skill[];
```

**Skill Runtime (`runtime.ts`)：**

```typescript
// 根据路由结果，动态组装 Agent
export function createSkillAgent(
  skill: Skill,
  context: SlackAgentContextInput,
  sharedTools: Record<string, Tool>,  // Slack 基础 tools 始终可用
): DurableAgent;
```

#### 1.2 拆分现有能力为 Skill

**创建目录结构：**

```
server/lib/skills/
├── recruitment/
│   ├── index.ts        # Skill 定义 + 注册
│   ├── prompt.ts       # 招聘专属 system prompt
│   └── tools.ts        # submitCandidate, queryPendingRecruitment 等
├── expense/
│   ├── index.ts
│   ├── prompt.ts
│   └── tools.ts        # submitExpenseClaim, queryPendingExpenseApproval 等
├── task/
│   ├── index.ts
│   ├── prompt.ts
│   └── tools.ts        # createTask, updateTask, generateTaskProgress
├── meeting/
│   ├── index.ts
│   ├── prompt.ts
│   └── tools.ts        # getThreadMessagesForSummary, saveDocToNotion
├── budget/
│   ├── index.ts
│   ├── prompt.ts
│   └── tools.ts        # updateBudget, addExpense, queryBudgetStatus
├── feedback/
│   ├── index.ts
│   ├── prompt.ts
│   └── tools.ts        # submitFeedback, queryMyTasks
└── alert/
    ├── index.ts
    ├── prompt.ts
    └── tools.ts         # 告警相关（主要由 cron 触发，但也支持用户主动查询）
```

**迁移策略：**
- 从当前 `server/lib/ai/tools/notion.ts`（~1500 行）中按功能域拆分
- 每个 Skill 的 prompt 从当前 `agent.ts` 的 300 行 system prompt 中提取对应章节
- 共享工具（`getChannelMessages`, `getThreadMessages`, `searchChannels`, `joinChannel`）保留在 `server/lib/ai/tools.ts` 作为 `sharedTools`
- `resolveNotionUserId` 和 `resolveSlackUserByMention` 提取到 `server/lib/slack/user-resolver.ts` 作为共享工具函数

#### 1.3 改造 Agent 入口

**修改 `server/lib/ai/agent.ts`：**

```typescript
// Before: 单一 Agent，所有 tools + 巨大 prompt
export const createSlackAgent = (context) => new DurableAgent({ ... });

// After: Router Agent + Skill Agent 两层
export const createRouterAgent = (context) => {
  // 轻量 Agent，只负责意图识别和路由
  // tools: routeToSkill (内部调用)
  // 如果意图明确 → 直接创建 Skill Agent
  // 如果意图模糊 → 用通用 prompt 回复 + 引导
};

export const createSkillAgent = (skill, context) => {
  // 按 Skill 动态组装 Agent
  // prompt = skill.systemPrompt + 通用规则（语言匹配、mrkdwn 格式等）
  // tools = skill.tools + sharedTools
};
```

**修改 `server/lib/ai/workflows/chat.ts`：**

```typescript
export async function chatWorkflow(messages, context) {
  "use workflow";
  
  const writable = getWritable<UIMessageChunk>();
  
  // Step 1: 路由
  const lastMessage = messages[messages.length - 1];
  const { skill } = await routeToSkill(lastMessage.content, getAllSkills(), context);
  
  // Step 2: 创建 Skill Agent
  const agent = createSkillAgent(skill, context, sharedTools);
  
  // Step 3: 执行
  await agent.stream({ messages, writable, experimental_context: context });
}
```

**验收标准：**
- 所有现有功能通过 Skill 架构正常工作
- system prompt 从 ~300 行单体拆分为每个 Skill 30-50 行
- 新增 Skill 只需创建目录 + 注册，无需修改 Agent 核心代码
- Router 准确率 > 95%（基于现有功能的测试用例）

**预估工作量：** 7-10 天

---

### Phase 2: Pending Center — 统一待处理中心（P1）

**目标：** 用户说「我今天要做什么」，返回跨模块的个人待处理列表。

**当前状态：** `queryPendingItems` 已支持按 category 查询单一模块的待处理项，但不支持跨模块聚合。

#### 2.1 实现内容

1. 创建 `server/lib/skills/pending-center/` Skill：

```typescript
// tools:
const getMyPendingItems = tool({
  description: "获取当前用户的所有待处理事项，跨模块聚合",
  inputSchema: z.object({
    includeCategories: z.array(z.enum([
      "expense_approval", "expense_payment",
      "recruitment", "feedback", "task", "decision"
    ])).optional().describe("筛选特定类别，不传则返回全部"),
  }),
  execute: async ({ includeCategories }, { experimental_context }) => {
    // 并行查询所有模块
    // 按优先级 + 超期天数排序
    // 返回统一格式的待处理列表
  },
});
```

2. 集成到 App Home（`server/listeners/events/app-home-opened.ts`）：
   - 打开 App Home 时自动展示个人待处理列表
   - 按模块分组，显示数量 badge

3. 支持每日推送：
   - 修改 `server/routes/cron/daily-digest.get.ts`，加入个人待处理摘要
   - 每天早上给每个有待处理事项的用户发 DM

**验收标准：**
- 用户输入「我今天要做什么」/「what's on my plate」返回跨模块聚合列表
- App Home 展示个人待处理面板
- 每日 DM 推送待处理摘要

**预估工作量：** 3-4 天

---

### Phase 3: 会议纪要 → 任务自动化（P2）

**目标：** 从「只生成 summary」升级为「summary → action items → 自动创建 tasks → 分配 owner → Slack 跟踪」闭环。

**当前状态：** `getThreadMessagesForSummary` + `saveDocToNotion` 已能生成摘要并保存，但不会自动提取 action items 和创建任务。

#### 3.1 实现内容

1. 增强 Meeting Skill 的 prompt，要求 LLM 在生成摘要时结构化输出 action items：

```typescript
// 在 meeting skill prompt 中增加：
// 生成摘要后，必须提取 action items，格式：
// { owner: "用户名或@mention", task: "任务描述", dueDate?: "日期" }
```

2. 新增 `createTasksFromMeeting` tool：

```typescript
const createTasksFromMeeting = tool({
  description: "从会议纪要中批量创建任务",
  inputSchema: z.object({
    meetingTitle: z.string(),
    actionItems: z.array(z.object({
      taskName: z.string(),
      description: z.string(),
      assignee: z.string().optional(),
      dueDate: z.string().optional(),
      priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
    })),
  }),
  execute: async ({ meetingTitle, actionItems }, { experimental_context }) => {
    // 批量创建任务
    // 每个任务关联会议纪要 Notion page
    // 通知每个 assignee
  },
});
```

3. 修改会议纪要 workflow：
   - 生成摘要 → 提取 action items → 展示给用户确认 → 批量创建任务 → 保存到 Notion

**验收标准：**
- 用户说「总结讨论」后，自动提取 action items 并展示
- 用户确认后批量创建任务到 Notion Tasks 数据库
- 每个被分配的人收到 Slack DM 通知

**预估工作量：** 3-4 天

---

### Phase 4: 决策记录系统（P3）

**目标：** 新增 Decision Skill，记录组织决策，自动生成 follow-up tasks，形成组织记忆。

#### 4.1 实现内容

1. Notion 新建 Decisions 数据库，字段：
   - Decision Title (title)
   - Decision Content (rich_text)
   - Decision Maker (people)
   - Reason (rich_text)
   - Impact Scope (multi_select)
   - Follow-up Actions (relation → Tasks)
   - Status (status: Proposed / Confirmed / Superseded)
   - Date (date)

2. 创建 `server/lib/skills/decision/` Skill：

```typescript
// tools:
// - recordDecision: 记录决策 + 自动创建 follow-up tasks
// - queryDecisions: 查询历史决策（按时间、关键词、决策人）
// - linkDecisionToMeeting: 将决策关联到会议纪要
```

3. 与 Meeting Skill 联动：
   - 会议纪要中提取的「决策」自动调用 `recordDecision`
   - 决策的 follow-up actions 自动创建为 Tasks

**验收标准：**
- 用户可通过自然语言记录决策
- 决策自动生成 follow-up tasks
- 可查询历史决策（「上周关于 XX 的决策是什么」）

**预估工作量：** 3-4 天

---

### Phase 5: Knowledge Skill — 团队知识问答（P3）

**目标：** 基于 Notion 中的会议纪要、PRD、技术文档、操作手册，支持团队知识问答。

#### 5.1 实现内容

1. 创建 `server/lib/skills/knowledge/` Skill：

```typescript
// tools:
const askKnowledge = tool({
  description: "从团队知识库中检索信息回答问题",
  inputSchema: z.object({
    question: z.string(),
    sources: z.array(z.enum(["docs", "decisions", "meeting_notes"])).optional(),
  }),
  execute: async ({ question, sources }) => {
    // 1. 从 Notion Docs 数据库检索相关文档
    // 2. 用 Notion search API 全文搜索
    // 3. 将检索结果作为 context 传给 LLM 生成回答
    // 4. 返回回答 + 来源链接
  },
});
```

2. 实现策略：
   - 短期：使用 Notion Search API 做关键词检索 + LLM 总结
   - 中期：引入 embedding + 向量检索（需要额外基础设施）

**验收标准：**
- 用户问「我们上次关于 XX 的讨论结论是什么」能从 Notion 检索并回答
- 回答附带来源 Notion 链接

**预估工作量：** 4-5 天

---

### Phase 6: 产品化指标（P4）

**目标：** 加入运营指标追踪，为规模化做准备。

#### 6.1 实现内容

1. 创建 `server/lib/metrics/` 模块：

```typescript
export interface MetricEvent {
  type: "tool_call" | "skill_route" | "approval" | "task_close" | "alert";
  skill: string;
  action: string;
  userId: string;
  timestamp: string;
  duration?: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

// 短期：写入 Notion Metrics 数据库
// 中期：接入 Vercel Analytics 或外部 APM
export async function trackMetric(event: MetricEvent): Promise<void>;
```

2. 核心指标：
   - 自动处理率 = 无需人工介入的请求 / 总请求
   - 人工介入率 = HITL 触发次数 / 总 tool 调用
   - 审批时长 = 审批完成时间 - 提交时间（从 Notion 计算）
   - 任务闭环率 = Done 任务 / 总任务
   - 超期率 = SLA 违规数 / 总待处理数
   - Skill 使用频次 = 各 Skill 被路由到的次数
   - Notion 回写成功率 = 成功写入 / 总写入尝试

3. 新增 `server/routes/cron/weekly-metrics.get.ts`：
   - 每周生成指标报告
   - 发送到管理频道

**验收标准：**
- 每次 tool 调用自动记录指标
- 每周自动生成运营报告
- 可查询任意时间段的指标

**预估工作量：** 3-4 天

---

### Phase 7: 模板化与 Sales Skill 扩展（P5）

**目标：** 将现有模块模板化，并新增 Sales Skill 与公司战略对齐。

#### 7.1 模板化

将各 Skill 的 Notion 数据库 schema、Slack Block Kit 模板、workflow 配置抽象为可复用模板：

```
server/lib/skills/templates/
├── recruitment-template.json   # Notion DB schema + Skill config
├── expense-template.json
├── task-template.json
└── meeting-template.json
```

支持不同团队通过配置文件快速部署一套完整的 kTeam 实例。

#### 7.2 Sales Skill（与公司 Sales AGI 战略对齐）

```
server/lib/skills/sales/
├── index.ts
├── prompt.ts
└── tools.ts
    // - sales.lead.create: 创建销售线索
    // - sales.lead.update: 更新线索状态
    // - sales.followup: 跟进提醒
    // - sales.summary: 客户沟通总结
```

需要新建 Notion Sales Leads 数据库。

**预估工作量：** 5-7 天

---

## 总体时间线

| 阶段 | 内容 | 优先级 | 预估工期 | 依赖 |
|------|------|--------|----------|------|
| Phase 0 | 统一工作流内核 | P0 | 8-12 天 | 无 |
| Phase 1 | Skill 架构引入 | P0 | 7-10 天 | Phase 0 |
| Phase 2 | Pending Center | P1 | 3-4 天 | Phase 0 |
| Phase 3 | 会议→任务自动化 | P2 | 3-4 天 | Phase 1 |
| Phase 4 | 决策记录系统 | P3 | 3-4 天 | Phase 1 |
| Phase 5 | Knowledge Skill | P3 | 4-5 天 | Phase 1 |
| Phase 6 | 产品化指标 | P4 | 3-4 天 | Phase 1 |
| Phase 7 | 模板化 + Sales | P5 | 5-7 天 | Phase 1-6 |

**总计：** 约 36-50 个工作日（7-10 周）

**关键里程碑：**
- Week 2-3: 统一内核完成，现有功能无回归
- Week 4-5: Skill 架构上线，Agent 从单体变为模块化
- Week 6: Pending Center 上线，kTeam 有了「主入口」
- Week 7-8: 会议→任务闭环 + 决策系统，形成组织记忆
- Week 9-10: 指标体系 + 模板化，具备产品化基础

---

## 技术风险与注意事项

1. **Skill Router 准确率**：关键词匹配覆盖 80% 场景，LLM 兜底处理模糊意图。需要建立测试用例集持续验证。

2. **Notion 作为唯一数据层的瓶颈**：当前所有数据存 Notion，查询性能和 API rate limit 会成为瓶颈。Phase 6 指标系统可能需要考虑独立存储（Vercel KV / Postgres）。
