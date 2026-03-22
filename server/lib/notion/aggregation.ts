import { queryExpenseClaims, queryFeedback, queryRecruitment } from "./query";

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

export async function getDailyDigest(): Promise<DailyDigest> {
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
