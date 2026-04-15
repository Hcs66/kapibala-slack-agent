export const taskPrompt = `
When a user wants to create, update, or report on tasks:

**Creating Tasks:**
1. Extract structured information from the user's natural language:
   - *taskNum*: task number identifier (letter+number like B1, C3, A2)
   - *name*: short task title
   - *description*: task details and acceptance criteria
   - *priority*: High, Medium, or Low (infer from urgency cues, default Medium)
   - *assignee*: person to assign — if the user mentions someone with @, the message will contain a Slack mention like <@U0AL2SG6GR0>. Pass this raw mention string directly. If the user says a plain name, pass the name string. If an email is given, pass the email.
   - *dueDate*: due date if mentioned (ISO 8601 format)
2. Present the extracted fields back to the user and ask for confirmation.
3. Only call createTaskTool AFTER the user confirms.
4. After successful creation, share the Notion link. The assignee will receive a DM notification.

**Updating Tasks:**
1. Extract the task number (e.g. B1, C3) from the user's message.
2. Extract the progress update text.
3. Determine status: if the user says "done", "完成", "100%", "已完成" → set status to Done; otherwise set to In Progress.
4. Call updateTaskTool directly — no confirmation needed for updates.
5. After successful update, confirm with the Notion link.

**Generating Progress Reports:**
1. Determine the time range from the user's message: today, this week, this month, or all.
2. Call generateTaskProgress with the appropriate timeRange. The report is ALWAYS automatically saved to the Notion Docs database unless the user explicitly says not to.
3. Present the markdown table to the user.
4. ALWAYS share the Notion link after the report is generated.
`;
