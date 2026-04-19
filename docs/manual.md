# Kapibala Team (kTeam) — 使用手册（Slack + Notion）

**目的**：快速上手 Slack 提交 / Notion 查阅与任务处理。  
本文档面向所有公司成员（商务 / 产品 / 模型 / 工程 / Ops）。

---

## 目录
1. 重要链接  
2. Slack 使用说明（加入、Shortcut、频道、提交流程）  
3. Notion 使用说明（加入、数据库链接、如何处理条目）  
4. 标准流程（报销 / 招聘 / 需求 / 任务管理）  
5. 常见问题 & 故障处理

---

## 1. 重要链接

### Slack
- 邀请链接（加入 Workspace）: https://join.slack.com/t/kapibalaai/shared_invite/zt-3sdaz7x78-bW8SYH7EnINRuDUDZ4SCzw  
- Slack 帮助 - 加入工作区: https://app.slack.com/slackhelp/zh-CN/212675257  
- Slack 新用户指南: https://app.slack.com/slackhelp/zh-CN/218080037

### Slack 频道
- feedback (反馈): https://app.slack.com/client/T0AKZDWB1RB/C0ALX532TUY  
- expense-claim (报销): https://app.slack.com/client/T0AKZDWB1RB/C0AL0S2L0GN  
- recruitments (招聘): https://app.slack.com/client/T0AKZDWB1RB/C0ALFQX3U4R
- dahshboard (看板)：https://app.slack.com/client/T0AKZDWB1RB/C0AN001J2US 

### Notion
- 邀请链接（加入团队）: https://www.notion.so/team/3217523c-7c93-811b-b45f-00429a0920e9/join  
- Notion 新手指南: https://www.notion.com/help/category/new-to-notion

### Notion Databases
- Feedback (反馈)：https://www.notion.so/3217523c7c938087b6dfe6051c0e7006  
- Tasks (任务)：https://www.notion.so/3217523c7c9380c2a87df2688fa5f978 
- Docs (团队文档)：https://www.notion.so/3217523c7c9380ccb769c9378d18a1a8  
- Expense Claims (报销记录)：https://www.notion.so/3217523c7c9380ca90b1c0f60d730e57  
- Recruitments (招聘记录)：https://www.notion.so/3217523c7c9380dc870ec790813b6d4e
- Decisions (重要决策记录)：https://www.notion.so/3467523c7c93807bbf44e159d158cd52
- Budget & Finance Tracker(预算管理)：https://www.notion.so/Budget-Finance-Tracker-5ed7523c7c93823996d901e9b93d1fdc

---

## 2. Slack 使用说明

### 2.1 如何加入 Workspace
使用邀请链接（上文）或通过公司邮箱申请加入。更多帮助：https://app.slack.com/slackhelp/zh-CN/212675257

### 2.2 新用户快速上手
阅读官方新手指南： https://app.slack.com/slackhelp/zh-CN/218080037

---

## 3. Notion 使用说明

### 3.1 加入 Notion 团队
通过邀请链接加入，参考 Notion 新手文档：https://www.notion.com/help/category/new-to-notion

---

## 4. 标准流程

### 4.1 报销流程
1. 员工在 Slack 使用 **New Claim** 填写报销 Modal（金额、类型、发票附件、说明）。  
2. 系统在 Notion 创建 Expense Claim record（状态：Pending）。  
3. 老板在 Slack 或 Notion 查看并审批（Approve / Reject）。  
4. (Jacob) 上传电子发票到 Notion 对应记录（附件）。  
5. (Tracy) 完成付款操作并把状态更新为 Paid，记录付款凭证 & 日期。

### 4.2 招聘流程
1. 在 Slack 使用 **New Candidate** 提交候选人 Modal（姓名、岗位、简历链接、联系方式、推荐人）。  
2. Notion Recruitments DB 创建候选人条目；HR/招聘负责人在 Notion 中更新面试进度与备注。  
3. 若进入面试阶段，负责人成立面试小组并记录面试评分；最终结果同步至 Notion。

### 4.3 需求（Feedback）流程
1. 在 Slack 使用 `/feedback` 或 New Feedback 提交 Modal（包含上下文信息）。  
2. Bot 将数据写入 Notion Feedback DB（状态：New），并在 Slack DM 通知提交人。  
3. Triage 小组（PM / Tech Lead / Model Lead）在 `#triage` 频道评估并更新 Notion（设置 Priority / Owner / Status）。  
4. 若通过 planning，创建 Project 或 Main Task，并在 Main Tasks / Sub Tasks 中拆解与分配。  

### 4.4 任务管理（Notion）
- **Main Tasks**：主线任务池（长期 / 里程碑型任务）  
- **Sub Tasks**：子任务由 Tracy 分配，关联 Main Tasks（Relation 字段）  
- 日常工作以 Sub Tasks 为单位执行、更新状态并在 Main Tasks 中汇总进展

---

## 5. 常见问题 & 故障处理

### Q1: 提交后 Notion 没有创建条目？
- 检查 Slack 是否显示 “Feedback saved” 确认信息。  
- 若未显示：联系 Slack Admin 检查 bot 是否被邀请到该 channel。  
- 若显示但 Notion 未创建：联系工程团队确认 Vercel 部署与环境变量（NOTION_TOKEN / DB_ID）是否正常。

### Q2: Reporter（Person）未正确映射到 Notion 用户？
- 原因：Slack 用户邮箱与 Notion 帐号邮箱不匹配或 Notion 没有该用户。  
- 解决：联系 Notion Admin 把该用户添加到 workspace，或人工在 Notion 中把 Reporter 字段改为文本并在备注保留 Slack 提交者。

### Q3: 报销审批卡片没有弹出？
- 确认 Shortcut 是否调用了正确 Modal（可能需要在 Slack App 管理界面执行重新安装）。  
- 若卡片发送失败，管理员可在 Notion 手动更改状态并在 Slack 通知相关人员。

### Q4: 如何查看历史提交上下文？
- 在 Notion Feedback 记录中检查 `Slack Thread Link` 或打开 Slack 的 `#feedback` channel thread。

---

## 附录：管理员操作（快速步骤）

### 管理员：刷新 Notion 用户缓存
1. 登录到 Vercel 控制台 → 找到部署环境变量 → 触发 redeploy（也可以触发专门的 cache refresh endpoint）。  
2. 在 Notion 管理端确认用户已加入团队并可见于 users.list。

### 管理员：更新 Modal / 添加字段
1. 修改仓库 `api/slack.js` 中 view 定义（blocks）  
2. 测试后 push → Vercel 自动部署 → 在 Slack App 中重新安装（若需要权限变更）

---

## 联系支持
- 产品 / 需求问题：PM（填入姓名）  
- 技术支持 / Bot 故障：DevOps（填入姓名）  
- Notion / 权限问题：Notion Admin（填入姓名）

---