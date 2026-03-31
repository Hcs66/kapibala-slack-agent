继续完成任务 `P2-4: 预算管理`：

## 说明
- 根据 plan_v1（ai_input/resources/docs/plan_v1.md）继续完成任务： `P2-4: 预算管理`
- 支持对话式更新预算，如：更新预算，人力资源，1000。agent根据分类和金额以及当前月份更新notion budget database 对应预算数据
- 支持对话式更新支出，如：添加支出，macbook，200。agent根据购买内容推断预算分类，添加到notion expenses database
- 支持对话式查询预算和支出，如：查看本月人力资源预算（已花费，支出/预算占比），查看本月总支出，查看本月设备支出等

## 实现
- 新增env
  - NOTION_BUDGET_DATABASE_ID
  - NOTION_BUDGET_DATASOURCE_ID
  - NOTION_EXPENSES_DATABASE_ID
  - NOTION_EXPENSES_DATASOURCE_ID
  - NOTION_MONTH_DATABASE_ID
  - NOTION_MONTH_DATASOURCE_ID
- 支出分类需要基于notion budget database，agent需要根据对话内容自动匹配对应的分类（提交时使用英文）
- 涉及到relation类型的操作参考：https://developers.notion.com/reference/page-property-values.md中的relation
- notion budget database schema:ai_input/resources/schemas/budget.json
 - Categories：预算分类，对应预算分类表
 - Monthly Budget：月度预算
 - This Month：本月支出
 - Utilization：本月支出/预算占比
- notion month_classification database schema:ai_input/resources/schemas/month.json
 - Month：月份
 - Month Num：月份天数
- notion expenses database schema:ai_input/resources/schemas/expense.json
 - Expense：支出名称
 - Claim：关联报销（Expense Claims），`relation类型`
 - Budget：关联预算，`relation类型`
 - Month Classification：关联月份，`relation类型`
- Expense Claims: curreny 属性取消，默认都是USD,该属性不需要处理
  - 调整agent prompt和创建notion的相关方法
  - 当一笔Expense Claims审核通过时，同步到noton expenses database，字段对应：
   - Expense：使用Claim Title
   - Claim：新建的Expense Claims Page ID
   - Budget：需要根据Expense Claims的内容，推断关联的预算分类，从budget database查询对应id
   - Month Classification：需要根据当前月份，从Month Classification databse查询对应id
- 查询
 - 可以通过budget database 查询到本月支出累计，和本月支出累计/预算占比
 - 分类查询需要用过 expenses database 汇总

问题：

 - 抱歉，系统在记录支出时遇到了问题：Month "March" not found in the Month Classification database
 - Month Classification database的查找字段为Month，值的格式为：月份+年份，如March 2026

还是遇到问题，设备分类未找到。让我查询一下可用的预算分类：
已记录成功！:white_check_mark:
支出: MacBook
金额: $200
分类: Equipment Purchases
月份: March 2026

## 说明
- 根据expense内容推断预算分类即可，不需要推断具体的内容分类


查询遇到问题，直接查budget database 的this month和Utilization无法返回数据（计算类型，notion限制），改为直接查询expenses database 再汇总计算

 --

 我已经实现 `P1-1: 讨论固化 / 会议纪要` 、 `P1-3: 异常告警` 、`P2-2: 任务管理`和`P2-4: 预算管理` 帮我更新相关文档：

 ## 说明
 - 生成 `docs/kapibala_slack_agent_releasenote_v3.md` 和 `docs/kapibala_slack_agent_v3.md`
    - 参考`docs/kapibala_slack_agent_releasenote_v2.md`和`docs/kapibala_slack_agent_v2.md`
    - v3版本包括v2内容

### `P1-1: 讨论固化 / 会议纪要`实现细节：
```markdown
## 说明
- 根据 plan_v1（ai_input/resources/docs/plan_v1.md）继续完成任务： `P1-1: 讨论固化 / 会议纪要`
- 支持对话式总结thread，例如："总结今天的讨论"，"总结今天关于agent的讨论"，"总结今天@username的发言"等，即支持通过时间+话题+用户的组合来总结thread
- 生成总结文档后同步到notion的docs database

## 实现
- 通过监听 app_mention event来触发，参考：
 - https://docs.slack.dev/reference/events/app_mention.md
- notion 的 docs database schema 参考：
 - ai_input/resources/schemas/docs.json
```

### `P1-3: 异常告警`实现细节：

```markdown
## 说明
- 根据 plan_v1（ai_input/resources/docs/plan_v1.md）继续完成任务： `P1-3: 异常告警`

```

### `P2-2: 任务管理`实现细节：
```markdown
## 说明
- 根据 plan_v1（ai_input/resources/docs/plan_v1.md）继续完成任务： `P2-2: 任务管理`
- 支持对话式创建任务，例如：创建一个任务：B1,名称：PG schema 设计，说明：| wa-bridge.ts 落库，实机验证通过（OR登录/sess1on持久化 连接事件 收发消息），分配给@Chu，截止日期：4月1日，优先级高
- 支持对话式更新任务，例如：更新任务：B1，进度：| wa-bridge.ts 落库，实机验证通过（OR登录/sess1on持久化 连接事件 收发消息）
- 可以通过@agent，生成任务进度表，如：@agent，生成今天的任务进度表，格式为markdown表格，并同步到notion docs database

## 实现
- notion 的 tasks database的env参数为：NOTION_TASKS_DATABASE_ID
- notion 的 tasks database schema 参考：
 - ai_input/resources/schemas/tasks.json，重点字段说明：
    - Assignee：任务负责人，与slack的用户通过email映射
    - Task Num：任务编号，如：B1,C1
    - Log：任务日志/进度，每次更新任务进度追加到本字段
- 创建任务
    - 任务默认状态为 `Status=To Do`
    - 自动推断对话中的任务编号，通常为英文+数字，如C1、B3等
    - 自动匹配对话中的人员，如：分配给@Chu，则先通过 slack api的 `users.list` 方法返回用户列表，再通过 `name`、`real_name` 匹配，若给出emai地址，则直接通过 `users.lookupByEmail` 来匹配
    - `users.list`参考文档：https://docs.slack.dev/reference/methods/users.list.md
    - `users.lookupByEmail`参考文档：https://docs.slack.dev/reference/methods/users.lookupByEmail.md
- 更新任务
    - 自动推断对话中的任务编号，通常为英文+数字，如C1、B3等，然后通过notion api 的 `query-a-data-source` 来匹配task，匹配字段为`Task Num`
    - `query-a-data-source`参考文档：https://developers.notion.com/reference/query-a-data-source.md
    - 自动推断对话中的更新描述，追加到notion tasks database 的 `Log` 字段
    - 同时更新任务进度（对应notion 的字段为 `Status` ）若对话中有 已完成、done，100%等表示任务完成的描述，则 `Status=Done`，否则 `Status=In Progress`
- 生成任务进度表
    - 用户通过@agent 来生成进度
    - 通过查询notion tasks database生成任务进度表，比如：今天、本周、本月，时间查询根据tasks 的 `Updated at` 字段
    - 进度使用markdown的表格格式生成，生成结果参考：ai_input/resources/tasks/progress.md
    - 生成结果同步到notion 的 docs database，生成后通知用户并显示notion链接
```

### `P2-4: 预算管理`实现细节：
```markdown
## 说明
- 根据 plan_v1（ai_input/resources/docs/plan_v1.md）继续完成任务： `P2-4: 预算管理`
- 支持对话式更新预算，如：更新预算，人力资源，1000。agent根据分类和金额以及当前月份更新notion budget database 对应预算数据
- 支持对话式更新支出，如：添加支出，macbook，200。agent根据购买内容推断预算分类，添加到notion expenses database
- 支持对话式查询预算和支出，如：查看本月人力资源预算（已花费，支出/预算占比），查看本月总支出，查看本月设备支出等

## 实现
- 新增env
  - NOTION_BUDGET_DATABASE_ID
  - NOTION_BUDGET_DATASOURCE_ID
  - NOTION_EXPENSES_DATABASE_ID
  - NOTION_EXPENSES_DATASOURCE_ID
  - NOTION_MONTH_DATABASE_ID
  - NOTION_MONTH_DATASOURCE_ID
- 支出分类需要基于notion budget database，agent需要根据对话内容自动匹配对应的分类（提交时使用英文）
- 涉及到relation类型的操作参考：https://developers.notion.com/reference/page-property-values.md中的relation
- notion budget database schema:ai_input/resources/schemas/budget.json
 - Categories：预算分类，对应预算分类表
 - Monthly Budget：月度预算
 - This Month：本月支出
 - Utilization：本月支出/预算占比
- notion month_classification database schema:ai_input/resources/schemas/month.json
 - Month：月份
 - Month Num：月份天数
- notion expenses database schema:ai_input/resources/schemas/expense.json
 - Expense：支出名称
 - Claim：关联报销（Expense Claims），`relation类型`
 - Budget：关联预算，`relation类型`
 - Month Classification：关联月份，`relation类型`
- Expense Claims: curreny 属性取消，默认都是USD,该属性不需要处理
  - 调整agent prompt和创建notion的相关方法
  - 当一笔Expense Claims审核通过时，同步到noton expenses database，字段对应：
   - Expense：使用Claim Title
   - Claim：新建的Expense Claims Page ID
   - Budget：需要根据Expense Claims的内容，推断关联的预算分类，从budget database查询对应id
   - Month Classification：需要根据当前月份，从Month Classification databse查询对应id
- 查询
 - 可以通过budget database 查询到本月支出累计，和本月支出累计/预算占比
 - 分类查询需要用过 expenses database 汇总
```