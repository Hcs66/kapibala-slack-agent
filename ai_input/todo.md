继续完成任务 `P0-4: 招聘对话式提交`：

## 说明
- 根据 plan_v1（ai_input/resources/docs/plan_v1.md）继续完成任务： `P0-4: 招聘对话式提交`
- `P0-1` ， `P0-2`，`P0-3` 已完成

添加到notion后, 发送一个信息提示用户可以上传简历附件，信息中含有上传按钮，点击弹出modal窗进行上传操作，上传到slack再上传到notion，并提示用户：

- 参考 candidate-form（server/listeners/views/candidate-form.ts） 的表单设计和上传相关逻辑

同样地，在调用 submitExpenseClaim（server/lib/ai/tools/notion.ts） 提交报销信息到notion后，发送上传提示信息