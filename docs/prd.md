# Kapibala Team (kTeam) — 产品文档

**版本**: 4.0  
**作者**: hcs@kapibala.ai  

---

## 1. 概要

Kapibala Team (kTeam) 是面向跨区域 AI-native 团队的 Product Ops 工具，以 Slack 为统一入口，Notion 为数据中枢，通过 Skill 架构 + 统一工作流内核实现"低摩擦收集 + 结构化存储 + AI 辅助处理 + Human-in-the-Loop 审批"的闭环协作。

核心价值：
- 降低跨团队、跨时区沟通成本
- 将非结构化对话高质量转成结构化数据和可追踪任务
- 把审批/记录/决策流程固化并可追溯
- 通过统一待处理中心和知识问答，让团队信息触手可及
- 为后续 AI 驱动的分析与自动化奠定数据基础

---

## 2. 开发背景

当前痛点：
- 反馈来源分散（Slack 线程 / 客户沟通 / 商务）导致需求丢失或重复
- 商务语言与工程语言不一致，定位成本高
- 报销与招聘流程线上化程度不足，审批与凭证管理不统一
- 没有稳定的"single source of truth"供产品/工程决策使用
- 会议讨论结论散落在聊天记录中，action items 容易遗漏
- 组织决策缺乏结构化记录，难以追溯"当时为什么这么决定"
- 团队知识散落在 Notion 各处，新人不知道去哪找
- 各模块（报销、招聘、任务、反馈）各自定义状态、通知、审批逻辑，代码重复且不一致
- 单 Agent 架构下所有工具堆在一起，system prompt 膨胀，维护困难

因此开发本 Agent，把 Slack 作为"capture first"入口，Notion 作为"system of record"，通过 Skill 架构实现模块化扩展，通过统一工作流内核保证各模块行为一致。

---

## 3. 实现思路

1. 在 Slack 提供统一入口（对话 / Shortcuts / Modal / App Home）采集结构化数据。
2. 使用 Vercel Serverless（Bolt + VercelReceiver + Nitro）接收事件，通过 Skill Router 识别用户意图并路由到对应 Skill。
3. 每个 Skill 拥有独立的 system prompt 和工具集，由 Skill Runtime 动态组装为 DurableAgent。
4. 所有业务模块共享统一工作流内核（状态机、审批、通知、SLA），保证行为一致。
5. 将数据写入 Notion 对应 Database（Feedback / Expense Claims / Recruitment / Tasks / Budget / Expenses / Decisions / Docs）。
6. 对敏感或需要审批的动作使用 Human-in-the-Loop（HITL）流程，通过 Workflow DevKit 的 `defineHook` 实现暂停-恢复。
7. 定时任务（Cron）驱动告警、每日摘要、每周报告，确保重要事项不被遗忘。

架构参考（详见项目架构文档 `docs/architecture.md`）。

---

## 4. 关键组件说明

### 4.1 Slack 前端（对话 / Modal / Shortcuts / App Home）

**对话入口（Skill 路由）：**
- 用户在 DM 或 @mention Agent 发送自然语言消息
- Skill Router 通过关键词匹配（快速路径）或 LLM 意图分类（兜底）路由到对应 Skill
- Skill Agent 使用专属 prompt + tools 处理请求，流式响应

**Shortcut / Modal 入口：**
- `new_feedback` — 反馈表单（类型、优先级、标签、附件）
- `expense_claim` — 报销表单（金额、类型、发票附件）+ 审批流
- `new_candidate` — 候选人表单（职位、简历、面试时间）

**App Home：**
- 打开 App Home 自动展示个人待处理面板，按模块分组显示数量

### 4.2 Skill 架构

10 个独立 Skill，每个 Skill 包含 `index.ts`（定义+注册）、`prompt.ts`（专属 prompt）、`tools.ts`（专属工具）：

| Skill | 职责 | 触发示例 |
|-------|------|----------|
| recruitment | 招聘管理 | 「录入候选人张三」 |
| expense | 报销管理 | 「我要报销打车 150」 |
| task | 任务管理 | 「创建任务 B1」「更新任务 B1 进度」 |
| meeting | 会议纪要 + 任务闭环 | 「总结今天的讨论」 |
| budget | 预算管理 | 「更新预算，人力资源，1000」 |
| feedback | 反馈管理 | 「登录页点确认没反应」 |
| alert | 告警查询 | 「有哪些超期事项」 |
| pending-center | 跨模块待处理中心 | 「我今天要做什么」 |
| decision | 决策记录 | 「记录决策：前端迁移到 React」 |
| knowledge | 团队知识问答 | 「我们的部署流程是什么」 |

### 4.3 统一工作流内核

所有业务模块共享：
- **统一对象模型**：WorkflowEntity 接口，统一 id、type、owner、status、logs、approvals 等字段
- **统一状态机**：按 EntityType 定义合法状态转换，防止非法状态跳转
- **统一审批机制**：生成审批 Block Kit UI + 处理审批结果，可被报销、频道加入等场景复用
- **统一通知机制**：状态变更、任务分配等场景的统一通知函数
- **统一 SLA 检查**：按实体类型和状态配置超时阈值，替代硬编码逻辑
- **适配器**：Notion 记录 ↔ WorkflowEntity 双向转换

### 4.4 Notion 数据库

| 数据库 | 用途 |
|--------|------|
| Feedback | 反馈记录（Bug / Feature Request / Improvement） |
| Expense Claims | 报销单（金额、审批状态、付款方式） |
| Recruitment | 招聘候选人（职位、简历、面试状态） |
| Tasks | 任务管理（编号、状态、日志、assignee） |
| Budget | 月度预算（按分类） |
| Expenses | 支出记录（关联预算分类和月份） |
| Decisions | 决策记录（决策人、原因、影响范围、follow-up） |
| Docs | 文档 / 会议纪要 |
| Month Classification | 月份分类（预算/支出关联） |

### 4.5 AI 能力

- **Skill 路由**：关键词匹配 + LLM 意图分类，准确率 > 95%
- **对话式数据采集**：Agent 从自然语言中提取结构化字段，追问缺失信息
- **自动分类推断**：优先级、反馈类型、支出分类由 Agent 根据语义自动推断
- **会议 action items 提取**：从讨论内容中结构化提取「谁要做什么、什么时候完成」
- **知识检索 + 总结**：Notion Search API 全文检索 + LLM 总结回答，附带来源链接

### 4.6 Slack → Notion User Mapping

- 通过 Slack API 获取用户 email（`users.info`），在 Notion users 列表中匹配 email，获得 Notion user id
- 缓存用户映射以降低 API 调用频率，提供 fallback（写入 Slack user 文本）以保证可写入性
- `user-resolver.ts` 支持 @mention、姓名、邮箱三种方式解析用户

### 4.7 Human-in-the-Loop (HITL)

通过 Workflow DevKit 的 `defineHook` 实现暂停-恢复模式，当前场景：
- 频道加入审批
- 报销审批（Shortcut 流程 + Agent 对话流程）
- 报销付款确认
- 文档保存到 Notion 确认
- 会议 action items 批量创建确认

### 4.8 定时任务

| 任务 | 频率 | 功能 |
|------|------|------|
| 超期告警 | 每日 | SLA 引擎检测超期事项，推送到 #dashboard |
| 每日摘要 | 每日 | 待处理事项汇总 + 个人待处理 DM 推送 |
| 每周报告 | 每周一 | 反馈/报销/招聘统计摘要 |

---

## 5. 数据流

### 对话式流程（Skill 架构）

1. 用户在 Slack 发送消息（DM 或 @mention）
2. `assistantUserMessage` listener 启动 `chatWorkflow`（持久化工作流）
3. Skill Router 识别意图，路由到对应 Skill
4. Skill Runtime 动态组装 Agent（Skill prompt + Skill tools + sharedTools）
5. Agent 通过工具调用与用户交互，采集/确认信息
6. 工具通过统一工作流内核执行状态转换、通知、审批
7. 数据写入 Notion 对应数据库
8. 流式响应返回 Slack

### Modal 表单流程

1. 用户点击 Shortcut → 打开 Modal
2. 用户填写并提交 → Slack 发送 `view_submission`
3. Bolt listener 验证字段、解析用户映射
4. 写入 Notion 数据库
5. 回复确认消息 + Notion 链接

### 审批流程（HITL）

1. 工具触发审批 → 发送审批按钮（统一审批机制生成 Block Kit）
2. `hook.create()` → 工作流暂停（零计算消耗）
3. 审批人点击按钮 → Action Handler → `hook.resume()`
4. 工作流恢复 → 统一状态机执行状态转换 → 统一通知机制发送结果

### 会议纪要 → 任务闭环

1. 用户 @Agent「总结今天的讨论」
2. Meeting Skill 读取频道/线程消息，生成结构化摘要
3. 自动提取 action items（owner、task、dueDate）
4. 展示给用户确认（HITL）
5. 确认后批量创建任务到 Notion Tasks 数据库
6. 每个 assignee 收到 Slack DM 通知

---

## 6. 权限与安全

- 环境变量：`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `NOTION_KEY`, `NOTION_*_DATABASE_ID`, `AI_GATEWAY_API_KEY` 等必须妥善保管（Vercel env）。
- Notion：仅将需要的 database `Share → Invite` 给 integration，避免给 integration 写入过多私人页面权限。
- Slack：仅授予 bot 必要 scope（commands, chat:write, users:read, users:read.email, app_mentions:read, assistant:write 等）。
- 敏感信息处理：对任何将写入 third-party LLM 的 payload 先做脱敏（如客户个人信息、完整发票号），或在私有 LLM / VPC 中执行推理。
- HITL 保障：所有敏感操作（审批、付款、批量创建）必须经过用户确认，Agent 不可自动完成。

---

## 7. 已解决的问题

- 把分散在 Slack 的反馈、报销、招聘、任务、决策转为结构化 Notion 条目，提升可追溯性
- 在提交时即时获取上下文（thread link / submitter）并保存，减少信息损失
- 将 Slack 用户自动映射到 Notion Person，保持责任追踪
- 支持 HITL 审批，确保敏感动作不可自动完成
- 统一工作流内核消除各模块状态/通知/审批逻辑的重复和不一致
- Skill 架构将单体 Agent 拆分为模块化 Skill，降低维护成本，支持独立扩展
- 跨模块待处理中心让用户一句话掌握全局待办
- 会议纪要 → 任务自动闭环，消除 action items 遗漏
- 决策记录系统形成可检索的组织记忆
- 知识问答让团队信息触手可及，降低新人上手成本

---

## 8. 已知限制与注意事项

- Notion Person 写入依赖于 Notion users 列表中存在对应 email；外部 guest 或未授权用户匹配失败时降级为文本字段保存。
- Slack API 的 rate limits 与 Vercel cold start 可能导致短暂失败；已设计 retry 机制缓解。
- Notion 作为唯一数据层，查询性能和 API rate limit 在高并发下可能成为瓶颈。
- 知识问答当前基于 Notion Search API 关键词检索，召回率受限于 Notion 搜索能力；中期计划引入 embedding + 向量检索。
- Skill Router 的 LLM 兜底分类会增加一次额外 API 调用延迟（仅在关键词无法匹配时触发）。

---

## 9. 迭代路线（Roadmap）

### 已完成（v4）
- 统一工作流内核（状态机、审批、通知、SLA）
- Skill 架构（Router + Registry + Runtime + 10 个 Skill）
- Pending Center 跨模块待处理中心
- 会议纪要 → 任务自动闭环
- 决策记录系统
- Knowledge Skill 团队知识问答

### 短期
- 产品化指标（tool 调用、Skill 路由、审批时长等运营指标追踪 + 每周报告）
- 模板化（Notion DB schema + Block Kit 模板 + workflow 配置抽象为可复用模板）

### 中期
- Sales Skill（销售线索管理、跟进提醒、客户沟通总结）
- 知识检索升级（embedding + 向量检索替代关键词搜索）
- 独立存储层（Vercel KV / Postgres）缓解 Notion API 瓶颈

---

## 10. 部署与运维

- 部署平台：Vercel（serverless），生产环境设置环境变量并开启审计访问
- 日志：标准输出 + Sentry/Log aggregation（推荐）
- Monitoring：配置 uptime monitor 与 error alerts；Notion API error rate/429 alert
- 回滚策略：Vercel 支持快速回滚到上一个版本
- 定时任务：通过 Vercel Cron Jobs 配置告警、每日摘要、每周报告

---

## 11. 测试策略

- 单元测试：Skill 工具函数、工作流内核（状态机、SLA、审批、适配器）、Notion payload 构建、用户解析
- 集成测试：Skill Router 路由准确率、端到端对话流程（消息 → Skill → Notion 写入）
- 安全测试：验证 Notion user mapping 的边界（guest / missing email），验证 AI 脱敏
- 测试框架：Vitest，co-located `*.test.ts` 文件

---

## 12. 交付与知识移交

交付物：
- 源码仓库与 CI（README 已包含部署与本地开发步骤）
- Notion schema 文档（database id、字段说明）
- 运行凭证与 Vercel environment variables 列表
- 架构文档（`docs/architecture.md`）
- 各版本 Release Notes（`docs/v2/`、`docs/v3/`、`docs/v4/`）
- 迭代计划（`docs/v4/kTeam_roadmap_v4.md`）

---

## 13. 联系人与支持

- 项目 Owner: hcs@kapibala.ai
- Notion Admin: hcs@kapibala.ai
- Slack Admin: hcs@kapibala.ai

---
