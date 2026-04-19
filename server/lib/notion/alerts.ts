import type { SLACheckInput } from "~/lib/workflow-engine/sla";
import { checkSLAViolations, DEFAULT_SLA } from "~/lib/workflow-engine/sla";
import type {
  ExpenseClaimRecord,
  FeedbackRecord,
  RecruitmentRecord,
} from "./query";
import { queryExpenseClaims, queryFeedback, queryRecruitment } from "./query";

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

function expensesToSLAInputs(
  expenses: ExpenseClaimRecord[],
  status: "pending" | "approved",
): SLACheckInput[] {
  return expenses.map((e) => ({
    entityType: "expense_claim" as const,
    entityId: e.id,
    entityTitle: e.claimTitle,
    entityUrl: e.url,
    status,
    statusSinceDate: e.submissionDate,
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

  const allSLAInputs: SLACheckInput[] = [
    ...expensesToSLAInputs(pendingExpenses, "pending"),
    ...expensesToSLAInputs(approvedExpenses, "approved"),
    ...pendingRecruitment.map((r) => ({
      entityType: "recruitment" as const,
      entityId: r.id,
      entityTitle: r.candidateName,
      entityUrl: r.url,
      status: "pending" as const,
      statusSinceDate: r.interviewTime,
    })),
    ...pendingFeedback.map((f) => ({
      entityType: "feedback" as const,
      entityId: f.id,
      entityTitle: f.name,
      entityUrl: f.url,
      status: "pending" as const,
      statusSinceDate: f.createdDate,
    })),
  ];

  const violations = checkSLAViolations(allSLAInputs, DEFAULT_SLA, now);

  const expenseById = new Map(
    [...pendingExpenses, ...approvedExpenses].map((e) => [e.id, e]),
  );
  const recruitmentById = new Map(pendingRecruitment.map((r) => [r.id, r]));
  const feedbackById = new Map(pendingFeedback.map((f) => [f.id, f]));

  const overdueExpenses: OverdueExpense[] = [];
  const overdueRecruitment: OverdueRecruitment[] = [];
  const overdueFeedback: OverdueFeedback[] = [];

  for (const v of violations) {
    const daysOverdue =
      (Math.floor(v.hoursOverdue / 24) ||
        getDaysOverdue(
          allSLAInputs.find((i) => i.entityId === v.entityId)
            ?.statusSinceDate ?? null,
          now,
        )) ??
      0;

    if (v.entityType === "expense_claim") {
      const record = expenseById.get(v.entityId);
      if (record) {
        const alertReason =
          v.status === "pending" ? "pending_approval" : "pending_payment";
        overdueExpenses.push({
          ...record,
          daysOverdue: getDaysOverdue(record.submissionDate, now) as number,
          alertReason,
        });
      }
    } else if (v.entityType === "recruitment") {
      const record = recruitmentById.get(v.entityId);
      if (record) {
        overdueRecruitment.push({
          ...record,
          daysOverdue: getDaysOverdue(record.interviewTime, now) ?? daysOverdue,
        });
      }
    } else if (v.entityType === "feedback") {
      const record = feedbackById.get(v.entityId);
      if (record) {
        overdueFeedback.push({
          ...record,
          daysOverdue: getDaysOverdue(record.createdDate, now) as number,
        });
      }
    }
  }

  // Recruitment items with no interview time are included as fallback
  // (same behavior as before — SLA engine skips null dates)
  for (const r of pendingRecruitment) {
    if (!r.interviewTime && !overdueRecruitment.some((o) => o.id === r.id)) {
      overdueRecruitment.push({
        ...r,
        daysOverdue: 3,
      });
    }
  }

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
