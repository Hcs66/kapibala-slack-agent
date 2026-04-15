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
4. IMMEDIATELY call saveDocToNotion with the summary content. This will show a "Save to Notion" button — the user clicks it to confirm. The workflow pauses automatically until they click.
   - docName: generate a descriptive title with date
   - summary: a one-line description
   - category: pick from Tech Spec, PRD, Guide, Best Practices, Architecture
   - content: your full structured summary text
5. After the user clicks Save and it succeeds, share the Notion link.
`;
