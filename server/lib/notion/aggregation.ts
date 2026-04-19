import type { WorkflowEntity } from "~/lib/workflow-engine/types";

export interface WeeklyStats {
  feedbackCount: number;
  expenseCount: number;
  recruitmentCount: number;
}

export interface DailyDigest {
  pendingExpenses: Array<{
    id: string;
    url: string;
    claimTitle: string;
    amount: number | null;
    currency: string | null;
    submittedBy: Array<{ id: string; name: string | null }>;
  }>;
  approvedExpenses: Array<{
    id: string;
    url: string;
    claimTitle: string;
    amount: number | null;
    currency: string | null;
    submittedBy: Array<{ id: string; name: string | null }>;
  }>;
  pendingRecruitment: Array<{
    id: string;
    url: string;
    candidateName: string;
    positionApplied: string | null;
    email: string | null;
    phone: string | null;
  }>;
  pendingFeedback: Array<{
    id: string;
    url: string;
    name: string;
    type: string | null;
    priority: string | null;
    customer: string;
  }>;
}

export async function getWeeklyStats(): Promise<WeeklyStats> {
  const { queryFeedback, queryExpenseClaims, queryRecruitment } = await import(
    "~/lib/notion/query"
  );

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const [allFeedback, allExpenses, allRecruitment] = await Promise.all([
    queryFeedback(),
    queryExpenseClaims(),
    queryRecruitment(),
  ]);

  const feedbackCount = allFeedback.filter((f) => {
    if (!f.createdDate) return false;
    const createdDate = new Date(f.createdDate);
    return createdDate >= weekStart;
  }).length;

  const expenseCount = allExpenses.filter((e) => {
    if (!e.submissionDate) return false;
    const submissionDate = new Date(e.submissionDate);
    return submissionDate >= weekStart;
  }).length;

  const recruitmentCount = allRecruitment.length;

  return {
    feedbackCount,
    expenseCount,
    recruitmentCount,
  };
}

export type PendingCategory =
  | "expense_approval"
  | "expense_payment"
  | "recruitment"
  | "feedback"
  | "task";

const ALL_PENDING_CATEGORIES: PendingCategory[] = [
  "expense_approval",
  "expense_payment",
  "recruitment",
  "feedback",
  "task",
];

export interface UserPendingResult {
  items: WorkflowEntity[];
  countByCategory: Record<PendingCategory, number>;
  total: number;
}

/**
 * Query all pending items for a specific user across all modules.
 * Queries run in parallel for performance.
 *
 * @param notionUserId - The Notion user ID to filter by (owner/assignee)
 * @param categories - Optional subset of categories to query. Defaults to all.
 */
export async function getUserPendingItems(
  notionUserId: string | null,
  categories?: PendingCategory[],
): Promise<UserPendingResult> {
  const { queryExpenseClaims, queryFeedback, queryRecruitment, queryTasks } =
    await import("~/lib/notion/query");
  const {
    expenseClaimToEntity,
    feedbackToEntity,
    recruitmentToEntity,
    taskToEntity,
  } = await import("~/lib/workflow-engine/adapters");

  const cats = categories ?? ALL_PENDING_CATEGORIES;

  const queries: Array<Promise<WorkflowEntity[]>> = [];
  const catOrder: PendingCategory[] = [];

  if (cats.includes("expense_approval")) {
    catOrder.push("expense_approval");
    queries.push(
      queryExpenseClaims({
        status: "Pending",
        ...(notionUserId ? { submitterNotionUserId: notionUserId } : {}),
      }).then((items) => items.map(expenseClaimToEntity)),
    );
  }

  if (cats.includes("expense_payment")) {
    catOrder.push("expense_payment");
    queries.push(
      queryExpenseClaims({
        status: "Approved",
        ...(notionUserId ? { submitterNotionUserId: notionUserId } : {}),
      }).then((items) => items.map(expenseClaimToEntity)),
    );
  }

  if (cats.includes("recruitment")) {
    catOrder.push("recruitment");
    queries.push(
      queryRecruitment({ status: "Pending Review" }).then((items) =>
        items.map(recruitmentToEntity),
      ),
    );
  }

  if (cats.includes("feedback")) {
    catOrder.push("feedback");
    queries.push(
      queryFeedback({
        status: "Pending",
        ...(notionUserId ? { assigneeNotionUserId: notionUserId } : {}),
      }).then((items) => items.map(feedbackToEntity)),
    );
  }

  if (cats.includes("task")) {
    catOrder.push("task");
    queries.push(
      queryTasks({
        ...(notionUserId ? { assigneeNotionUserId: notionUserId } : {}),
        status: "To Do",
      })
        .then((todoItems) =>
          queryTasks({
            ...(notionUserId ? { assigneeNotionUserId: notionUserId } : {}),
            status: "In Progress",
          }).then((inProgressItems) => [...todoItems, ...inProgressItems]),
        )
        .then((items) => items.map(taskToEntity)),
    );
  }

  const results = await Promise.all(queries);

  const countByCategory = {} as Record<PendingCategory, number>;
  for (const cat of ALL_PENDING_CATEGORIES) {
    countByCategory[cat] = 0;
  }

  const allItems: WorkflowEntity[] = [];
  for (let i = 0; i < results.length; i++) {
    const cat = catOrder[i];
    const items = results[i];
    countByCategory[cat] = items.length;
    allItems.push(...items);
  }

  // Sort: overdue first (by dueDate ascending), then by createdAt descending
  allItems.sort((a, b) => {
    const now = new Date().toISOString();
    const aOverdue = a.dueDate && a.dueDate < now;
    const bOverdue = b.dueDate && b.dueDate < now;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (aOverdue && bOverdue) {
      return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  return {
    items: allItems,
    countByCategory,
    total: allItems.length,
  };
}

export async function getDailyDigest(): Promise<DailyDigest> {
  const { queryExpenseClaims, queryRecruitment, queryFeedback } = await import(
    "~/lib/notion/query"
  );

  const [
    pendingExpenses,
    approvedExpenses,
    pendingRecruitment,
    pendingFeedback,
  ] = await Promise.all([
    queryExpenseClaims({ status: "Pending" }),
    queryExpenseClaims({ status: "Approved" }),
    queryRecruitment({ status: "Pending Review" }),
    queryFeedback(),
  ]);

  return {
    pendingExpenses: pendingExpenses.map((e) => ({
      id: e.id,
      url: e.url,
      claimTitle: e.claimTitle,
      amount: e.amount,
      currency: e.currency,
      submittedBy: e.submittedBy,
    })),
    approvedExpenses: approvedExpenses.map((e) => ({
      id: e.id,
      url: e.url,
      claimTitle: e.claimTitle,
      amount: e.amount,
      currency: e.currency,
      submittedBy: e.submittedBy,
    })),
    pendingRecruitment: pendingRecruitment.map((r) => ({
      id: r.id,
      url: r.url,
      candidateName: r.candidateName,
      positionApplied: r.positionApplied,
      email: r.email,
      phone: r.phone,
    })),
    pendingFeedback: pendingFeedback
      .filter((f) => f.priority === "Pending" || !f.priority)
      .map((f) => ({
        id: f.id,
        url: f.url,
        name: f.name,
        type: f.type,
        priority: f.priority,
        customer: f.customer,
      })),
  };
}
