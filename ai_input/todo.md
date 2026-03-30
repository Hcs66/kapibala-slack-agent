继续完成任务 `P2-2: 任务管理`：

## 说明
- 根据 plan_v1（ai_input/resources/docs/plan_v1.md）继续完成任务： `P2-2: 任务管理`
- 支持对话式创建任务，例如：创建一个任务：B1,名称：PG schema 设计，说明：| wa-bridge.ts 落库，实机验证通过（OR登录/sess1on持久化 连接事件 收发消息），分配给@hcs，截止日期：4月1日，优先级高
- 支持对话式更新任务，例如：跟新任务：B1，进度：| wa-bridge.ts 落库，实机验证通过（OR登录/sess1on持久化 连接事件 收发消息）
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