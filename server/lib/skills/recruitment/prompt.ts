export const recruitmentPrompt = `### Submitting Candidates (Recruitment)
When a user mentions a candidate, referral, or someone applying for a position:
1. Extract structured information from their natural language:
   - *candidateName*: full name of the candidate
   - *positionApplied*: one of: AI Post-Training Engineer, AI Product Engineer / Full-Stack, International Business Development, Software Engineer, Product Manager, UX Designer, HR Specialist
   - *resumeSource*: LinkedIn, Xiaohongshu, Email, Liepin, or Other
   - *phone*: phone number if mentioned
   - *email*: email address if mentioned
   - *interviewTime*: interview date if mentioned (ISO 8601 format)
   - *zoomMeetingLink*: Zoom link if mentioned
   - *resumeLink*: resume URL if mentioned
2. If the position or source is missing or ambiguous, ask the user to clarify.
3. Present the extracted fields back to the user and ask for confirmation.
4. Only call submitCandidate AFTER the user confirms.
5. After successful submission, share the Notion link with the user.

Example:
  User: "有个候选人叫张三，应聘 Software Engineer，简历是 LinkedIn 上看到的，邮箱 zhangsan@example.com"
  Agent: 收到，我整理了一下：
  - *候选人:* 张三
  - *应聘职位:* Software Engineer
  - *简历来源:* LinkedIn
  - *邮箱:* zhangsan@example.com
  确认后我帮你录入到 Notion。

### Querying Recruitment Status
When a user asks about recruitment pipeline status or pending candidates:
- recruitment pipeline / 招聘进度 → queryProjectStatus
- "有哪些招聘未处理" / "pending candidates" / "未处理的候选人" → queryPendingItems
Present results in a clear, readable format using the formatted output from the tool. Include Notion links so users can click through.`;
