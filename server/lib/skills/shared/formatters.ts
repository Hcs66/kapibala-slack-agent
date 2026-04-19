import type {
  DecisionRecord,
  ExpenseClaimRecord,
  FeedbackRecord,
  RecruitmentRecord,
  TaskRecord,
} from "~/lib/notion/query";

export function formatFeedbackList(items: FeedbackRecord[]): string {
  if (items.length === 0) return "No feedback items found.";
  return items
    .map((f, i) => {
      const parts = [`${i + 1}. *${f.name}*`];
      if (f.type) parts.push(`Type: ${f.type}`);
      if (f.status) parts.push(`Status: ${f.status}`);
      if (f.priority) parts.push(`Priority: ${f.priority}`);
      if (f.source) parts.push(`Source: ${f.source}`);
      if (f.dueDate) parts.push(`Due: ${f.dueDate}`);
      if (f.tags.length > 0) parts.push(`Tags: ${f.tags.join(", ")}`);
      parts.push(`<${f.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}

export function formatExpenseClaimList(items: ExpenseClaimRecord[]): string {
  if (items.length === 0) return "No expense claims found.";
  return items
    .map((e, i) => {
      const parts = [`${i + 1}. *${e.claimTitle}*`];
      if (e.amount != null) parts.push(`$${e.amount}`);
      if (e.expenseType) parts.push(`Type: ${e.expenseType}`);
      if (e.status) parts.push(`Status: ${e.status}`);
      if (e.submissionDate) parts.push(`Submitted: ${e.submissionDate}`);
      parts.push(`<${e.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}

export function formatRecruitmentList(items: RecruitmentRecord[]): string {
  if (items.length === 0) return "No candidates found.";
  return items
    .map((r, i) => {
      const parts = [`${i + 1}. *${r.candidateName}*`];
      if (r.positionApplied) parts.push(`Position: ${r.positionApplied}`);
      if (r.status) parts.push(`Status: ${r.status}`);
      if (r.interviewTime) parts.push(`Interview: ${r.interviewTime}`);
      parts.push(`<${r.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}

export function formatTaskList(items: TaskRecord[]): string {
  if (items.length === 0) return "No tasks found.";
  return items
    .map((t, i) => {
      const parts = [`${i + 1}. *${t.taskNum}* ${t.name}`];
      if (t.status) parts.push(`Status: ${t.status}`);
      if (t.priority) parts.push(`Priority: ${t.priority}`);
      if (t.dueDate) parts.push(`Due: ${t.dueDate}`);
      if (t.assignee.length > 0) {
        const names = t.assignee.map((a) => a.name ?? "Unknown").join(", ");
        parts.push(`Assignee: ${names}`);
      }
      parts.push(`<${t.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}

export interface BudgetStatusItem {
  category: string;
  monthlyBudget: number | null;
  spent: number;
  utilization: number | null;
  url: string;
}

export function formatBudgetStatusList(items: BudgetStatusItem[]): string {
  if (items.length === 0) return "No budget items found.";
  return items
    .map((b, i) => {
      const parts = [`${i + 1}. *${b.category}*`];
      if (b.monthlyBudget != null) parts.push(`Budget: $${b.monthlyBudget}`);
      parts.push(`Spent: $${b.spent}`);
      if (b.utilization != null)
        parts.push(`Utilization: ${Math.round(b.utilization * 100)}%`);
      parts.push(`<${b.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}

const ENTITY_TYPE_LABEL: Record<string, string> = {
  expense_claim: "Expense",
  recruitment: "Recruitment",
  task: "Task",
  feedback: "Feedback",
  decision: "Decision",
};

const STATUS_EMOJI: Record<string, string> = {
  pending: "🟡",
  in_progress: "🔵",
  approved: "✅",
  rejected: "❌",
  done: "✅",
  cancelled: "⚪",
};

export function formatPendingEntityList(
  items: Array<{
    type: string;
    title: string;
    status: string;
    priority?: string;
    dueDate?: string;
    notionPageUrl: string;
    metadata: Record<string, unknown>;
  }>,
): string {
  if (items.length === 0) return "No pending items found.";
  return items
    .map((item, i) => {
      const emoji = STATUS_EMOJI[item.status] ?? "⬜";
      const label = ENTITY_TYPE_LABEL[item.type] ?? item.type;
      const parts = [`${i + 1}. ${emoji} *[${label}]* ${item.title}`];
      if (item.priority) parts.push(`Priority: ${item.priority}`);
      if (item.dueDate) parts.push(`Due: ${item.dueDate}`);
      if (item.type === "expense_claim" && item.metadata.amount != null) {
        parts.push(`$${item.metadata.amount}`);
      }
      parts.push(`<${item.notionPageUrl}|View>`);
      return parts.join(" | ");
    })
    .join("\n");
}

export function formatExpenseList(
  items: Array<{
    expense: string;
    amount: number | null;
    date: string | null;
    url: string;
  }>,
): string {
  if (items.length === 0) return "No expenses found.";
  return items
    .map((e, i) => {
      const parts = [`${i + 1}. *${e.expense}*`];
      if (e.amount != null) parts.push(`$${e.amount}`);
      if (e.date) parts.push(`Date: ${e.date}`);
      parts.push(`<${e.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}

export function formatKnowledgeResults(
  items: Array<{
    title: string;
    source: string;
    snippet: string;
    url: string;
    lastEdited: string;
  }>,
): string {
  if (items.length === 0) return "No knowledge base results found.";
  const sourceLabel: Record<string, string> = {
    docs: "📄 Doc",
    decisions: "🔖 Decision",
  };
  return items
    .map((item, i) => {
      const label = sourceLabel[item.source] ?? item.source;
      const parts = [`${i + 1}. *[${label}]* ${item.title}`];
      if (item.snippet) parts.push(item.snippet.slice(0, 120));
      if (item.lastEdited) {
        parts.push(`Updated: ${item.lastEdited.split("T")[0]}`);
      }
      parts.push(`<${item.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}

export function formatDecisionList(items: DecisionRecord[]): string {
  if (items.length === 0) return "No decisions found.";
  return items
    .map((d, i) => {
      const parts = [`${i + 1}. *${d.title}*`];
      if (d.status) parts.push(`Status: ${d.status}`);
      if (d.category) parts.push(`Category: ${d.category}`);
      if (d.priority) parts.push(`Priority: ${d.priority}`);
      if (d.date) parts.push(`Date: ${d.date}`);
      if (d.impactScope.length > 0)
        parts.push(`Scope: ${d.impactScope.join(", ")}`);
      if (d.decisionMaker.length > 0) {
        const names = d.decisionMaker
          .map((m) => m.name ?? "Unknown")
          .join(", ");
        parts.push(`By: ${names}`);
      }
      parts.push(`<${d.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}
