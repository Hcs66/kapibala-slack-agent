import type {
  ExpenseClaimRecord,
  FeedbackRecord,
  RecruitmentRecord,
} from "./query";
import { queryExpenseClaims, queryFeedback, queryRecruitment } from "./query";

const OVERDUE_DAYS = 3;

export interface OverdueExpense extends ExpenseClaimRecord {
  daysOverdue: number;
  alertReason: "pending_approval" | "pending_payment";
}

export interface OverdueRecruitment extends RecruitmentRecord {
  daysOverdue: number;
}

export interface OverdueFeedback extends FeedbackRecord {
  daysOverdue: number;
}

export interface AlertDigest {
  overdueExpenses: OverdueExpense[];
  overdueRecruitment: OverdueRecruitment[];
  overdueFeedback: OverdueFeedback[];
  totalAlerts: number;
}

export function getDaysOverdue(
  dateStr: string | null,
  now: Date,
): number | null {
  if (!dateStr) return null;
  const created = new Date(dateStr);
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

function filterOverdueExpenses(
  expenses: ExpenseClaimRecord[],
  alertReason: "pending_approval" | "pending_payment",
  now: Date,
): OverdueExpense[] {
  return expenses
    .filter((e) => {
      const days = getDaysOverdue(e.submissionDate, now);
      return days !== null && days >= OVERDUE_DAYS;
    })
    .map((e) => ({
      ...e,
      daysOverdue: getDaysOverdue(e.submissionDate, now) as number,
      alertReason,
    }));
}

export async function getAlertDigest(now = new Date()): Promise<AlertDigest> {
  const [
    pendingExpenses,
    approvedExpenses,
    pendingRecruitment,
    pendingFeedback,
  ] = await Promise.all([
    queryExpenseClaims({ status: "Pending" }),
    queryExpenseClaims({ status: "Approved" }),
    queryRecruitment({ status: "Pending Review" }),
    queryFeedback({ status: "Pending" }),
  ]);

  const overdueExpenses = [
    ...filterOverdueExpenses(pendingExpenses, "pending_approval", now),
    ...filterOverdueExpenses(approvedExpenses, "pending_payment", now),
  ];

  const overdueRecruitment = pendingRecruitment
    .filter((r) => {
      const days = getDaysOverdue(r.interviewTime, now);
      if (days !== null) return days >= OVERDUE_DAYS;
      // No interview time — use page created_time approximation via status
      // Since RecruitmentRecord doesn't have a created date, we can't filter
      // by age. Include all pending review items as a fallback.
      return true;
    })
    .map((r) => ({
      ...r,
      daysOverdue: getDaysOverdue(r.interviewTime, now) ?? OVERDUE_DAYS,
    }));

  const overdueFeedback = pendingFeedback
    .filter((f) => {
      const days = getDaysOverdue(f.createdDate, now);
      return days !== null && days >= OVERDUE_DAYS;
    })
    .map((f) => ({
      ...f,
      daysOverdue: getDaysOverdue(f.createdDate, now) as number,
    }));

  return {
    overdueExpenses,
    overdueRecruitment,
    overdueFeedback,
    totalAlerts:
      overdueExpenses.length +
      overdueRecruitment.length +
      overdueFeedback.length,
  };
}
