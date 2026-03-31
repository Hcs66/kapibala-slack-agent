import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";

export interface ExpenseData {
  expenseName: string;
  amount: number;
  date: string;
  claimPageId: string | null;
  budgetPageId: string;
  monthPageId: string;
}

export async function createExpense(data: ExpenseData) {
  const databaseId = process.env.NOTION_EXPENSES_DATABASE_ID;
  if (!databaseId) {
    throw new Error("NOTION_EXPENSES_DATABASE_ID is not configured");
  }

  const properties: CreatePageParameters["properties"] = {
    Expense: {
      title: [{ text: { content: data.expenseName } }],
    },
    Amount: {
      number: data.amount,
    },
    Date: {
      date: { start: data.date },
    },
    Budget: {
      relation: [{ id: data.budgetPageId }],
    },
    "Month Classification": {
      relation: [{ id: data.monthPageId }],
    },
  };

  if (data.claimPageId) {
    properties.Claim = {
      relation: [{ id: data.claimPageId }],
    };
  }

  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties,
  });

  return page;
}

export interface SyncExpenseClaimInput {
  claimTitle: string;
  amount: number;
  expenseType: string;
  claimPageId: string;
}

export async function syncExpenseClaimToExpenses(
  input: SyncExpenseClaimInput,
): Promise<void> {
  const { findBudgetByCategory } = await import("~/lib/notion/query");
  const { findMonthByName, getCurrentMonthName } = await import(
    "~/lib/notion/month"
  );

  const budget = await findBudgetByCategory(input.expenseType);
  if (!budget) {
    console.warn(
      `Budget category not found for expense type "${input.expenseType}". Skipping sync.`,
    );
    return;
  }

  const monthName = getCurrentMonthName();
  const month = await findMonthByName(monthName);
  if (!month) {
    console.warn(
      `Month "${monthName}" not found in Month Classification database. Skipping sync.`,
    );
    return;
  }

  await createExpense({
    expenseName: input.claimTitle,
    amount: input.amount,
    date: new Date().toISOString().split("T")[0],
    claimPageId: input.claimPageId,
    budgetPageId: budget.id,
    monthPageId: month.id,
  });
}
