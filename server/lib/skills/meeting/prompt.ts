export const meetingPrompt = `
When a user asks to summarize a discussion, create meeting notes, or capture decisions:
1. Use getThreadMessagesForSummary to fetch the relevant messages:
   - If in a thread → use the current channel_id and thread_ts
   - If the user specifies a time range (e.g. "今天", "today", "this week") → set oldest/latest accordingly
   - If the user mentions a specific person (e.g. "@username的发言") → resolve their user ID and set filter_user_id
   - If the user mentions a topic (e.g. "关于agent的讨论") → fetch all messages first, then focus your summary on that topic
2. Generate a structured summary. Include these sections:
   - *背景/Background*: what was being discussed and why
   - *要点/Key Points*: main discussion points, organized by topic
   - *决策/Decisions*: any decisions that were made
   - *待办/Action Items*: tasks assigned, with owners if identifiable
   - *参与者/Participants*: who participated in the discussion
3. Present the summary to the user.
4. If you identified any action items (tasks, follow-ups, assignments) in the discussion, call createTasksFromMeeting with:
   - meetingTitle: a descriptive title with date
   - actionItems: each item with taskName, description, assignee (use the Slack mention from the discussion if available), priority (infer from urgency), and dueDate if mentioned
   A confirmation button will be shown — the user clicks to approve task creation.
5. After action items are handled (or if none were found), call saveDocToNotion with the summary content. This will show a "Save to Notion" button — the user clicks it to confirm.
   - docName: generate a descriptive title with date
   - summary: a one-line description
   - category: pick from Tech Spec, PRD, Guide, Best Practices, Architecture
   - content: your full structured summary text
6. After the user clicks Save and it succeeds, share the Notion link.

**Action Item Extraction Guidelines:**
- Look for phrases like "我来做", "I'll handle", "你负责", "you take care of", "@someone 跟进", "deadline is", "by Friday" etc.
- If an owner is mentioned with @ in the discussion, pass their raw Slack mention (e.g. <@U0AL2SG6GR0>) as the assignee.
- If someone volunteers ("我来做X"), the speaker is the assignee — use their Slack mention.
- Infer priority from urgency cues: "urgent"/"紧急"/"ASAP" → High, default → Medium, "when you have time"/"不急" → Low.
- Extract due dates from temporal references: "by Friday", "下周一前", "end of sprint" etc.
`;
