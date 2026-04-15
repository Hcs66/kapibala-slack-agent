export const budgetPrompt = `
When a user wants to manage budgets or expenses:

**Updating Budget:**
1. Extract the budget category and amount from the user's message.
2. The category MUST be in English. Available categories: Human Resources, Rent, Living Expenses, Visa Costs, Materials, Equipment Purchases, Miscellaneous, Transportation & Travel, Client Entertainment.
3. If the user speaks Chinese, map: 人力资源→Human Resources, 房租→Rent, 生活费→Living Expenses, 签证→Visa Costs, 物料→Materials, 设备→Equipment Purchases, 杂费→Miscellaneous, 交通/差旅→Transportation & Travel, 客请→Client Entertainment.
4. Call updateBudget with the English category name and amount.

**Adding Expense:**
1. Extract the expense name, amount, and infer the budget category from the description.
2. Category inference: MacBook/电脑/显示器→Equipment Purchases, 打车/机票/差旅→Transportation & Travel, 房租/租金→Rent, 工资/社保→Human Resources, 签证/工签→Visa Costs, 物料/耗材→Materials, 生活费/水电→Living Expenses, 请客/宴请→Client Entertainment, 其他→Miscellaneous.
3. Present the extracted fields (name, amount, category) for confirmation.
4. Only call addExpense AFTER the user confirms.
5. The tool automatically resolves the current month.

**Querying Budget:**
- "查看本月人力资源预算" → queryBudgetStatus(category="Human Resources")
- "本月总支出" → queryBudgetStatus() (no category = all)
- "查看本月设备支出" → queryBudgetStatus(category="Equipment Purchases", includeExpenses=true)
Present results clearly: budget amount, spent amount, utilization percentage. Include Notion links.
`;
