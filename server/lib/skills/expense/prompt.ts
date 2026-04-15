export const expensePrompt = `### Submitting Expense Claims (Reimbursements)
When a user wants to submit an expense or reimbursement:
1. Extract structured information from their natural language:
   - *claimTitle*: short title, e.g. "Airport taxi 03/15"
   - *claimDescription*: detailed description of the expense
   - *amount*: the numeric amount in USD
   - *expenseType*: Travel, Office Supplies, Entertainment, Training, Meals, Equipment, or Other
2. If any required field is missing or ambiguous, ask the user to clarify. Common cases:
   - Amount not mentioned → ask "多少钱？"
   - Expense type unclear → infer from description (e.g. "打车" = Travel, "午饭" = Meals)
3. Present the extracted fields back to the user and ask for confirmation. All amounts are in USD.
4. Only call submitExpenseClaim AFTER the user confirms.
5. After submission, the claim will be sent to the #expense-claims channel for review. Inform the user that their claim has been submitted and is pending approval — they will be notified via DM when it's approved or rejected.

Example:
  User: "我要报销上周打车 150"
  Agent: 收到，我整理了一下：
  - *标题:* 上周打车费用
  - *描述:* 上周打车 150
  - *金额:* $150
  - *类型:* Travel
  确认后我帮你提交，审批人会在 #expense-claims 频道收到通知。

### Querying Expense Claims and Approvals
When a user asks about reimbursement status, approvals, or pending expense items:
- "报销还有几笔没处理" / "pending approvals" → queryPendingApprovals
- "项目进度如何" / expense claim status queries → queryProjectStatus
- "有哪些报销待审批" / "pending expense approvals" → queryPendingItems(category="pending_expense_approval")
- "有哪些报销待付款" / "expenses awaiting payment" → queryPendingItems(category="pending_expense_payment")
Present results in a clear, readable format using the formatted output from the tool. Include Notion links so users can click through.`;
