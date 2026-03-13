# Kapibala Team (kTeam) — 产品文档

**版本**: 1.0  
**作者**: hcs@kapibala.ai  

---

## 1. 概要

Kapibala Team (kTeam) 是面向跨区域 AI-native 团队的 Product Ops 工具，目标是把团队日常的反馈、报销、招聘候选人等工作统一接入 Slack，通过结构化 Modal → Vercel serverless → Notion 数据库的流程，实现“低摩擦收集 + 结构化存储 + AI 辅助 triage + Human-in-the-Loop 审批”的闭环协作。

核心价值：
- 降低跨团队、跨时区沟通成本
- 将非结构化反馈高质量转成结构化需求
- 把审批/记录流程固化并可追溯
- 为后续 AI 驱动的分析与自动化奠定数据基础

---

## 2. 开发背景

当前痛点：
- 反馈来源分散（Slack 线程 / 客户沟通 / 商务）导致需求丢失或重复
- 商务语言与工程语言不一致，定位成本高
- 报销与招聘流程线上化程度不足，审批与凭证管理不统一
- 没有稳定的“single source of truth”供产品/工程决策使用

因此开发本 Agent，把 Slack 作为“capture first”入口，Notion 作为“system of record”。

---

## 3. 实现思路

1. 在 Slack 提供统一入口（Slash command / Shortcuts / Modal）采集结构化数据。  
2. 使用 Vercel Serverless（Bolt + ExpressReceiver）接收事件与 view_submission，将数据作校验、补全与用户映射。  
3. 将数据写入 Notion 对应 Database（Feedback / Expense / Recruitment / Projects / Tasks）。  
4. 对敏感或需要审批的动作（如加入频道、报销）使用 Human-in-the-Loop（HITL）流程，通过按钮触发 workflow resume。  
5. 可选：在写入前或写入后调用 AI serviceto（triage、summary、duplicate detection），注入 metadata 帮助后续处理。  

架构参考（详见项目架构文档）: Slack Events → `/api/slack/events` → Bolt App → listeners → AI / Notion integration。:contentReference[oaicite:2]{index=2}

---

## 4. 关键组件说明

### 4.1 Slack 前端（Modal / Shortcuts）
- 提交入口：`/feedback`（Slash）和 Shortcut：New Feedback、New Claim、New Candidate
- Modal 字段示例（Feedback）：
  - Title, Customer, Priority (P0/P1/P2), Module, Description, Attachments

### 4.2 Vercel Serverless + Bolt App
- 接收 Slack Events / Commands / Views
- 负责字段校验、Slack user → Notion user 映射、触发 Notion 写入、回复 Slack DM/Thread、记录日志
- 配置 `processBeforeResponse: true` 以满足 Slack 的快速响应要求

### 4.3 Notion 数据库
- Database 列表：Feedback、Projects、Main Tasks、Sub Tasks、Docs、Expense Claims、Recruitments
- 重要字段：Title、Priority(select)、Description、Reporter (Person)、Status、Attachments、Slack Thread Link

### 4.4 AI Triage
- 用于自动摘要、自动优先级建议、相似问题检索
- 建议放在写入 Notion 之前或作为后台异步处理（便于人工复核）

### 4.5 Slack→Notion User Mapping
- 通过 Slack API 获取用户 email（`users.info`），再在 Notion 的 users 列表中匹配 email，获得 Notion user id，写入 Person 字段
- 缓存用户映射（1 小时或更长）以降低 API 调用频率，提供 fallback（写入 Slack user 文本）以保证可写入性

---

## 5. 数据流

1. 用户在 Slack 触发 `/feedback` 或点击 Shortcut → 打开 Modal  
2. 用户填写并提交 → Slack 发送 `view_submission` 到 Vercel 函数  
3. Vercel(Bolt)：
   - 验证字段
   - 使用 Slack API 获取 user email
   - 使用 Notion API `users.list()` 匹配 Notion user id（缓存）
   - 可选调用 AI triage 得到 summary/module/priority suggestion
   - 使用 Notion API `pages.create()` 写入 database（Person 字段使用 notion user id）  
4. Bot 向提交用户回复确认消息并把 Notion 链接回传给 channel/用户

---

## 6. 权限与安全

- 环境变量：`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `NOTION_TOKEN`, `NOTION_*_DATABASE_ID`, `AI_GATEWAY_API_KEY` 等必须妥善保管（Vercel env）。  
- Notion：仅将需要的 database `Share → Invite` 给 integration，避免给 integration 写入过多私人页面权限。  
- Slack：仅授予 bot 必要 scope（commands, chat:write, users:read, users:read.email, app_mentions:read）。  
- 敏感信息处理：对任何将写入 third-party LLM 的 payload 先做脱敏（如客户个人信息、完整发票号），或在私有 LLM / VPC 中执行推理。

---

## 7. 已解决的问题

- 把分散在 Slack 的反馈转为结构化 Notion 条目，提升可追溯性  
- 在提交时即时获取上下文（thread link / submitter）并保存，减少信息损失  
- 将 Slack 用户自动映射到 Notion Person，保持责任追踪  
- 支持 HITL 审批，确保敏感动作（如加入频道、报销）不可自动完成

---

## 8. 已知限制与注意事项

- Notion Person 写入依赖于 Notion users 列表中存在对应 email；外部 guest 或未授权用户匹配失败时需降级为文本字段保存。  
- Slack API 的 rate limits 与 Vercel cold start 可能导致短暂失败；已设计 retry & queue（建议使用 background queue 如 Redis/Bull 在高并发下缓解）  
- AI 提示与 triage 为建议，不自动改写任务状态；严控自动操作以保证安全

---

## 9. 迭代路线（Roadmap）

### 短期
- 自动化优先级、自动建议 owner（经多轮验证后逐步半自动）  
- 周报/仪表盘（Top requests、模块热度、响应 SLA）  
- 对接 CI/CD / Issue tracker（GitHub/Linear）实现 request → issue 自动流转
- 引入 Embedding-based duplicate detection（pgvector / Supabase）  
- 为 triage 增设 feedback loop（人工标注提高模型准确率）  

### 中期
- 运行稳定性：增加 retry、日志、报警（Sentry / Logtail）  
- 改善用户映射缓存与 fallback 逻辑  
- 增加 Notion schema 自检工具（启动时验证数据库字段）

---

## 10. 部署与运维

- 部署平台：Vercel（serverless），生产环境设置环境变量并开启审计访问  
- 日志：标准输出 + Sentry/Log aggregation（推荐）  
- Monitoring：配置 uptime monitor 与 error alerts；Notion API error rate/429 alert  
- 回滚策略：Vercel 支持快速回滚到上一个版本

---

## 11. 测试策略

- 单元测试：listener 解析、Notion payload 构建、Slack user → email 解析  
- 集成测试：本地绕过 ngrok / Vercel 使用 test workspace 执行端到端（modal open → submit → Notion create）  
- 安全测试：验证 Notion user mapping 的边界（guest / missing email），验证 AI 脱敏

---

## 12. 交付与知识移交

交付物：
- 源码仓库与 CI（README 已包含部署与本地开发步骤）  
- Notion schema 文档（database id、字段说明）  
- 运行凭证与 Vercel environment variables 列表  
- 1 页快速上手（运营）与 1 页故障恢复（如何回滚 / 手动重试）

---

## 13. 联系人与支持

- 项目 Owner: hcs@kapibala.ai
- Notion Admin: hcs@kapibala.ai  
- Slack Admin: hcs@kapibala.ai

---
