import { tool } from "ai";
import { z } from "zod";
import {
  type BudgetStatusItem,
  formatBudgetStatusList,
  formatExpenseList,
} from "~/lib/skills/shared/formatters";

const updateBudget = tool({
  description:
    "Update the monthly budget amount for a specific budget category in Notion.",
  inputSchema: z.object({
    category: z
      .string()
      .describe(
        "Budget category name in English. Available: Human Resources, Rent, Living Expenses, Visa Costs, Materials, Equipment Purchases, Miscellaneous, Transportation & Travel, Client Entertainment.",
      ),
    monthlyBudget: z.number().describe("The new monthly budget amount in USD"),
  }),
  execute: async (
    { category, monthlyBudget },
    { experimental_context: _ctx },
  ) => {
    "use step";

    const { findBudgetByCategory } = await import("~/lib/notion/query");
    const { updateBudgetAmount } = await import("~/lib/notion/budget");

    try {
      const budget = await findBudgetByCategory(category);
      if (!budget) {
        return {
          success: false,
          message: `Budget category "${category}" not found. Please check the category name.`,
        };
      }

      await updateBudgetAmount(budget.id, monthlyBudget);

      return {
        success: true,
        message: `Budget for "${category}" has been updated to $${monthlyBudget}.`,
        pageUrl: budget.url,
      };
    } catch (error) {
      console.error("Failed to update budget:", error);
      return {
        success: false,
        message: "Failed to update budget in Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const addExpense = tool({
  description:
    "Add a new expense entry to the Notion expenses database. You MUST call this tool immediately when the user confirms the expense details. Do NOT respond with text only — invoke this tool. The agent should infer the budget category from the expense description. The current month is resolved automatically.",
  inputSchema: z.object({
    expenseName: z.string().describe("Name/description of the expense"),
    amount: z.number().describe("Expense amount in USD"),
    category: z
      .string()
      .describe(
        "Budget category inferred from the expense description. Use the English name. The tool will fuzzy-match if not exact.",
      ),
    date: z
      .string()
      .optional()
      .describe("Expense date in ISO 8601 format. Defaults to today."),
  }),
  execute: async (
    { expenseName, amount, category, date },
    { experimental_context: _ctx },
  ) => {
    "use step";

    const { findBudgetByCategory } = await import("~/lib/notion/query");
    const { createExpense } = await import("~/lib/notion/expenses");
    const { findMonthByName, getCurrentMonthName } = await import(
      "~/lib/notion/month"
    );

    try {
      const budget = await findBudgetByCategory(category);
      if (!budget) {
        return {
          success: false,
          message: `Budget category "${category}" not found. Please check the category name.`,
        };
      }

      const monthName = getCurrentMonthName();
      const month = await findMonthByName(monthName);
      if (!month) {
        return {
          success: false,
          message: `Month "${monthName}" not found in the Month Classification database.`,
        };
      }

      const expenseDate = date || new Date().toISOString().split("T")[0];

      const page = await createExpense({
        expenseName,
        amount,
        date: expenseDate,
        claimPageId: null,
        budgetPageId: budget.id,
        monthPageId: month.id,
      });

      const pageUrl = (page as { url: string }).url;

      return {
        success: true,
        message: `Expense "${expenseName}" ($${amount}) has been added under "${category}" for ${monthName}.`,
        pageUrl,
      };
    } catch (error) {
      console.error("Failed to add expense:", error);
      return {
        success: false,
        message: "Failed to add expense to Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const queryBudgetStatus = tool({
  description:
    "Query budget status from Notion. Shows monthly budget, current spending, and utilization for one or all categories.",
  inputSchema: z.object({
    category: z
      .string()
      .optional()
      .describe(
        "Specific budget category to query (English). If omitted, returns all categories.",
      ),
    includeExpenses: z
      .boolean()
      .optional()
      .describe(
        "If true, also return individual expense line items. Default false.",
      ),
  }),
  execute: async (
    { category, includeExpenses },
    { experimental_context: _ctx },
  ) => {
    "use step";

    const { queryBudgets, queryExpenses, findBudgetByCategory } = await import(
      "~/lib/notion/query"
    );
    const { findMonthByName, getCurrentMonthName } = await import(
      "~/lib/notion/month"
    );

    try {
      const monthName = getCurrentMonthName();
      const month = await findMonthByName(monthName);

      if (!month) {
        return {
          success: false,
          message: `Month "${monthName}" not found in the Month Classification database.`,
        };
      }

      if (category) {
        const budget = await findBudgetByCategory(category);
        if (!budget) {
          return {
            success: false,
            message: `Budget category "${category}" not found.`,
          };
        }

        const expenses = await queryExpenses({
          budgetPageId: budget.id,
          monthPageId: month.id,
        });

        const spent = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);
        const utilization =
          budget.monthlyBudget && budget.monthlyBudget > 0
            ? spent / budget.monthlyBudget
            : null;

        const statusItem: BudgetStatusItem = {
          category: budget.category,
          monthlyBudget: budget.monthlyBudget,
          spent,
          utilization,
          url: budget.url,
        };

        return {
          success: true,
          month: monthName,
          category: budget.category,
          monthlyBudget: budget.monthlyBudget,
          spent,
          utilization:
            utilization != null ? Math.round(utilization * 100) : null,
          formatted: formatBudgetStatusList([statusItem]),
          expenses: includeExpenses ? formatExpenseList(expenses) : undefined,
          expenseItems: includeExpenses ? expenses : undefined,
        };
      }

      const budgets = await queryBudgets();

      const statusItems: BudgetStatusItem[] = await Promise.all(
        budgets.map(async (b) => {
          const expenses = await queryExpenses({
            budgetPageId: b.id,
            monthPageId: month.id,
          });
          const spent = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);
          const utilization =
            b.monthlyBudget && b.monthlyBudget > 0
              ? spent / b.monthlyBudget
              : null;
          return {
            category: b.category,
            monthlyBudget: b.monthlyBudget,
            spent,
            utilization,
            url: b.url,
          };
        }),
      );

      const totalBudget = statusItems.reduce(
        (sum, b) => sum + (b.monthlyBudget ?? 0),
        0,
      );
      const totalSpent = statusItems.reduce((sum, b) => sum + b.spent, 0);
      const overallUtilization = totalBudget > 0 ? totalSpent / totalBudget : 0;

      return {
        success: true,
        month: monthName,
        summary: {
          totalBudget,
          totalSpent,
          overallUtilization: Math.round(overallUtilization * 100),
          categoryCount: statusItems.length,
        },
        formatted: formatBudgetStatusList(statusItems),
        budgets: statusItems,
      };
    } catch (error) {
      console.error("Failed to query budget status:", error);
      return {
        success: false,
        message: "Failed to query budget status from Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const budgetTools = { updateBudget, addExpense, queryBudgetStatus };
