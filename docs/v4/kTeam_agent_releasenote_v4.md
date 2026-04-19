# kTeam Agent v4 — Release Notes

## 一句话总结

kTeam Agent 从「单 Agent 工具堆叠」升级为「Skill 架构 + 统一工作流内核」——所有业务模块共享统一的状态机、审批、通知和 SLA 机制，新增 Pending Center 跨模块待处理中心、会议纪要→任务自动闭环、决策记录系统和团队知识问答，Agent 真正成为团队的智能操作系统。

---

## 已有功能（v2 + v3）

- 对话式提交反馈（Bug / Feature Request / Improvement）
- Notion 数据查询（任务、报销、招聘、反馈）
- 对话式报销 + 审批 + 付款全流程
- 对话式录入候选人 + Interviewer 通知
- Daily / Weekly 自动推送
- 讨论固化 / 会议纪要
- 异常告警（超期报销、招聘、反馈）
- 任务管理（创建、更新、进度报告）
- 预算管理（更新预算、添加支出、查询状态）

---

## 架构升级

### 统一工作流内核

所有业务模块（报销、招聘、任务、反馈、决策）不再各自定义状态、通知和审批逻辑，统一收敛到 `workflow-engine` 内核。

**解决的问题**
- 各模块状态命名不一致（Pending / Pending Review / To Do）统一为 `WorkflowStatus` 枚举
- 审批逻辑从报销模块中抽象为通用审批机制，新增审批场景无需重复开发
- 通知逻辑从各模块散落的 `client.chat.postMessage` 收敛为统一通知函数
- SLA 检查从硬编码 `OVERDUE_DAYS = 3` 升级为可配置的 SLA 引擎

**核心模块**
- `workflow-engine/types.ts` — 统一对象模型（WorkflowEntity、WorkflowStatus、LogEntry、ApprovalRecord）
- `workflow-engine/status-machine.ts` — 统一状态机，定义每种实体类型的合法状态转换
- `workflow-engine/notifications.ts` — 统一通知机制，替代各模块中散落的通知逻辑
- `workflow-engine/approval.ts` — 统一审批机制，可被报销审批和未来新审批场景复用
- `workflow-engine/sla.ts` — 统一 SLA 检查，支持按实体类型和状态配置超时阈值

---

### Skill 架构

单一 Agent（~300 行 system prompt + 全部 tools 平铺）拆分为 Skill Router + Skill Registry + 独立 Skill 模块。

**解决的问题**
- system prompt 从 ~300 行单体拆分为每个 Skill 30-50 行，职责清晰
- 新增 Skill 只需创建目录 + 注册，无需修改 Agent 核心代码
- 每个 Skill 只加载自己需要的 tools，减少 LLM 上下文噪音
- 两阶段路由（关键词快速匹配 + LLM 意图分类兜底），准确率 > 95%

**Skill 列表**
- `recruitment` — 招聘管理
- `expense` — 报销管理
- `task` — 任务管理
- `meeting` — 会议纪要
- `budget` — 预算管理
- `feedback` — 反馈管理
- `alert` — 告警查询
- `pending-center` — 待处理中心（新增）
- `decision` — 决策记录（新增）
- `knowledge` — 知识问答（新增）

---

## 新增功能

### 1. Pending Center — 统一待处理中心

用户说「我今天要做什么」，返回跨模块的个人待处理列表，不再需要逐个模块查询。

**应用场景**
- 早上打开 Slack，问 Agent「what's on my plate」，一次性看到待审批报销、待处理招聘、进行中任务、未回复反馈
- 打开 App Home，自动展示个人待处理面板，按模块分组显示数量
- 每天早上收到个人待处理摘要 DM，不遗漏任何事项

**解决的问题**
- 之前 `queryPendingItems` 只能按单一模块查询，无法跨模块聚合
- 用户需要分别问「有哪些报销待审批」「有哪些任务在进行中」，现在一句话搞定
- 待处理列表按优先级 + 超期天数排序，最紧急的事项排在最前面
- App Home 提供可视化面板，无需对话即可掌握全局

**使用方式**
- `我今天要做什么` / `what's on my plate` — 获取全部待处理事项
- `我有哪些待审批的` — 筛选特定类别
- 打开 App Home — 自动展示待处理面板

<!-- TODO: 补充 Pending Center 截图 -->
<!-- TODO: 补充 App Home 待处理面板截图 -->

---

### 2. 会议纪要 → 任务自动闭环

从「只生成 summary」升级为「summary → action items → 自动创建 tasks → 分配 owner → Slack 通知」完整闭环。

**应用场景**
- 会议结束后 @Agent「总结今天的讨论」，Agent 生成摘要的同时自动提取 action items
- Agent 展示提取的 action items 列表，用户确认后批量创建任务到 Notion
- 每个被分配的人自动收到 Slack DM 通知，包含任务名称、截止日期和会议纪要链接

**解决的问题**
- 之前会议纪要只是一份文档，action items 需要手动创建任务，容易遗漏
- 现在 Agent 自动从讨论中提取「谁要做什么、什么时候完成」，结构化输出
- 批量创建的任务自动关联会议纪要 Notion page，可追溯来源
- 被分配人第一时间收到通知，不会因为没看会议纪要而遗漏任务

**使用方式**
- `@agent 总结今天的讨论` — 生成摘要 + 提取 action items
- 确认 action items 后 → 自动批量创建任务 + 通知 assignee

<!-- TODO: 补充 action items 提取截图 -->
<!-- TODO: 补充批量创建任务截图 -->

---

### 3. 决策记录系统

新增 Decision Skill，在 Slack 中用自然语言记录组织决策，自动生成 follow-up tasks，形成可检索的组织记忆。

**应用场景**
- CTO 在群里说「决定：前端框架从 Vue 迁移到 React，原因是团队 React 经验更丰富，影响范围是全团队，follow-up：@hcs 出迁移方案，下周五前完成」
- Agent 自动结构化记录决策内容、决策人、原因、影响范围，创建 follow-up 任务并通知相关人
- 两个月后有人问「我们当时为什么选 React」，Agent 从决策库中检索并回答

**解决的问题**
- 组织决策散落在聊天记录、会议纪要中，难以检索和追溯
- 决策的 follow-up actions 容易被遗忘，现在自动创建为任务并跟踪
- 支持按时间、关键词、决策人、分类（Strategic / Operational / Technical / Financial / HR）查询历史决策
- 与 Meeting Skill 联动：会议纪要中提取的决策自动调用 `recordDecision`

**使用方式**
- `记录决策：[决策内容]，原因：[原因]，影响范围：[范围]` — 记录决策
- `上周关于 XX 的决策是什么` — 查询历史决策
- `@agent 总结讨论` 时自动提取决策 → 记录到 Decisions 数据库

**Notion Decisions 数据库字段**
- Decision Title / Decision Content / Decision Maker / Reason
- Impact Scope（Team / Organization / External）
- Follow-up Actions（关联 Tasks）
- Priority（Low / Medium / High / Critical）
- Status（Proposed / Confirmed / Superseded）
- Category（Strategic / Operational / Technical / Financial / HR）

<!-- TODO: 补充决策记录截图 -->
<!-- TODO: 补充决策查询截图 -->

---

### 4. Knowledge Skill — 团队知识问答

基于 Notion 中的会议纪要、决策记录、PRD、技术文档、操作手册，支持团队知识问答，回答附带来源链接。

**应用场景**
- 新同事问「我们的部署流程是什么」，Agent 从 Notion Docs 中检索相关文档并总结回答
- 有人问「上次关于数据库选型的讨论结论是什么」，Agent 从会议纪要和决策记录中检索并回答
- 查找操作手册「怎么申请 VPN」，Agent 返回步骤摘要 + Notion 原文链接

**解决的问题**
- 团队知识散落在 Notion 各个数据库中，新人不知道去哪找
- 不需要学习 Notion 的搜索和导航，在 Slack 中直接问 Agent
- 回答基于实际文档内容，不是 Agent 编造的，且附带来源 Notion 链接可验证
- 支持指定检索范围（docs / decisions），精准定位信息来源

**使用方式**
- `我们上次关于 XX 的讨论结论是什么` — 从会议纪要/决策中检索
- `部署流程是什么` — 从技术文档中检索
- `怎么申请报销` — 从操作手册中检索

<!-- TODO: 补充知识问答截图 -->

---

## 技术改进

### 现有模块适配统一内核

- 所有 Notion 数据库的 status 字段建立映射表（Notion status name ↔ WorkflowStatus）
- 报销审批、付款确认使用统一审批机制和状态机
- 告警 cron 使用新 SLA 引擎，支持按实体类型配置超时阈值
- 共享工具函数（`resolveNotionUserId`、`resolveSlackUserByMention`）提取到 `server/lib/slack/user-resolver.ts`

### Skill 路由机制

- 第一阶段：关键词匹配（triggerPatterns），覆盖 ~80% 明确意图场景
- 第二阶段：LLM 意图分类（兜底），处理模糊意图和跨 Skill 请求
- Slack 基础 tools（getChannelMessages、getThreadMessages、searchChannels、joinChannel）作为 sharedTools 始终可用

---

## 后续更新计划

| 版本 | 功能 | 说明 |
|---|---|---|
| v4.1 | 产品化指标 | 自动追踪 tool 调用、Skill 路由、审批时长等运营指标，每周生成报告 |
| v4.2 | 模板化 | 将各 Skill 的 Notion DB schema、Block Kit 模板、workflow 配置抽象为可复用模板 |
| v4.3 | Sales Skill | 销售线索管理、跟进提醒、客户沟通总结，与公司 Sales AGI 战略对齐 |
