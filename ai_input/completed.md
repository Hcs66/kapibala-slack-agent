基于 slack shortcuts 实现添加 feedback 并同步到 notion 的 feedback database：

## 说明

- 参考已有例子 sample-shortcut：server/listeners/shortcuts/sample-shortcut.ts
- 基于 slack 的 block kit 构建 modal：https://docs.slack.dev/block-kit/
    - modal 字段基于 notion 的 database schema: ai_input/resources/shortcuts/feedback/schema.json
- 用户相关字段（在notion中是person类型字段）需要通过email建立映射，参考（ai_input/resources/shortcuts/:
    - userMap.ts: 通过 notion 接口匹配用户
    - slack.ts：通过 client.users.info 获取用户email并匹配notion 用户
- 基于 notion 接口添加数据，参考：
    - notion.ts：ai_input/resources/shortcuts/notion.ts
    - api：https://developers.notion.com/reference/post-page
- shortcuts已配置，id为：new_feedback

---

参考已实现的 new-feedback shortcuts（server/listeners/shortcuts/new-feedback.ts），实现 expense-claim shortcuts:

## 说明

- modal 字段基于 notion 的 database schema: ai_input/resources/shortcuts/expnse-claim/schema.json
- shortcuts已配置，id为：expense_claim

---
参考已实现的 new-feedback shortcuts（server/listeners/shortcuts/new-feedback.ts），实现 new-candidate shortcuts:

## 说明

- modal 字段基于 notion 的 database schema: ai_input/resources/shortcuts/recruitment/schema.json
- shortcuts已配置，id为：new-candidate

---

