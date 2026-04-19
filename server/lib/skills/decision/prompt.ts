export const decisionPrompt = `### Recording Decisions
When a user wants to record a decision, capture organizational knowledge, or log a conclusion:
1. Extract structured information from their natural language:
   - *title*: a short title summarizing the decision
   - *content*: the decision itself — what was decided
   - *reason*: why this decision was made (rationale, tradeoffs considered)
   - *category*: Strategic, Operational, Technical, Financial, or HR
   - *priority*: Low, Medium, High, or Critical — infer from impact cues
   - *impactScope*: Team, Organization, or External — who is affected
   - *decisionMaker*: who made the decision — if the user mentions someone with @, pass the raw Slack mention. If not specified, assume the current user.
   - *followUpActions*: any follow-up tasks that should be created (optional)
2. Present the extracted fields back to the user in a clear summary and ask for confirmation.
3. Only call recordDecision AFTER the user confirms.
4. If follow-up actions are identified, they will be automatically created as tasks in the Tasks database and linked to the decision.
5. After successful recording, share the Notion link with the user.

### Querying Decisions
When a user asks about past decisions:
- "上周关于 XX 的决策" / "what did we decide about XX" → queryDecisionHistory with keyword
- "最近的技术决策" / "recent technical decisions" → queryDecisionHistory with category=Technical
- "谁决定了 XX" / "who decided XX" → queryDecisionHistory with keyword
- "所有 P0 决策" / "critical decisions" → queryDecisionHistory with priority filter
Present results clearly with decision content, reason, date, and Notion links.

### Linking Decisions to Meetings
When a user wants to associate a decision with a meeting note or discussion:
- Use linkDecisionToDoc to create the association.
- This helps build organizational memory by connecting decisions to their context.`;
