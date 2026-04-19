import type {
  ExpenseClaimRecord,
  FeedbackRecord,
  RecruitmentRecord,
  TaskRecord,
} from "~/lib/notion/query";
import type { WorkflowEntity } from "~/lib/workflow-engine/types";
import { fromNotionStatus } from "~/lib/workflow-engine/types";

export function expenseClaimToEntity(
  record: ExpenseClaimRecord,
): WorkflowEntity {
  return {
    id: record.id,
    type: "expense_claim",
    title: record.claimTitle,
    owner: record.submittedBy[0]?.id ?? "",
    status: fromNotionStatus("expense_claim", record.status ?? "") ?? "pending",
    logs: [],
    approvals: [],
    createdAt: record.submissionDate ?? "",
    updatedAt: record.submissionDate ?? "",
    notionPageId: record.id,
    notionPageUrl: record.url,
    metadata: {
      amount: record.amount,
      expenseType: record.expenseType,
      claimDescription: record.claimDescription,
    },
  };
}

export function recruitmentToEntity(record: RecruitmentRecord): WorkflowEntity {
  return {
    id: record.id,
    type: "recruitment",
    title: record.candidateName,
    owner: "",
    status: fromNotionStatus("recruitment", record.status ?? "") ?? "pending",
    logs: [],
    approvals: [],
    createdAt: record.interviewTime ?? "",
    updatedAt: record.interviewTime ?? "",
    notionPageId: record.id,
    notionPageUrl: record.url,
    metadata: {
      positionApplied: record.positionApplied,
      resumeSource: record.resumeSource,
      email: record.email,
      phone: record.phone,
      interviewTime: record.interviewTime,
    },
  };
}

export function taskToEntity(record: TaskRecord): WorkflowEntity {
  return {
    id: record.id,
    type: "task",
    title: `${record.taskNum} ${record.name}`,
    owner: record.assignee[0]?.id ?? "",
    assignee: record.assignee[0]?.id,
    priority:
      record.priority === "High"
        ? "High"
        : record.priority === "Medium"
          ? "Medium"
          : record.priority === "Low"
            ? "Low"
            : undefined,
    status: fromNotionStatus("task", record.status ?? "") ?? "pending",
    dueDate: record.dueDate ?? undefined,
    logs: [],
    approvals: [],
    createdAt: record.updatedAt ?? "",
    updatedAt: record.updatedAt ?? "",
    notionPageId: record.id,
    notionPageUrl: record.url,
    metadata: {
      taskNum: record.taskNum,
      description: record.description,
      summary: record.summary,
      log: record.log,
    },
  };
}

export function feedbackToEntity(record: FeedbackRecord): WorkflowEntity {
  return {
    id: record.id,
    type: "feedback",
    title: record.name,
    owner: record.createdBy[0]?.id ?? "",
    assignee: record.assignedTo[0]?.id,
    priority:
      record.priority === "P0"
        ? "P0"
        : record.priority === "P1"
          ? "P1"
          : record.priority === "P2"
            ? "P2"
            : record.priority === "P3"
              ? "P3"
              : undefined,
    status: fromNotionStatus("feedback", record.status ?? "") ?? "pending",
    dueDate: record.dueDate ?? undefined,
    logs: [],
    approvals: [],
    createdAt: record.createdDate ?? "",
    updatedAt: record.createdDate ?? "",
    notionPageId: record.id,
    notionPageUrl: record.url,
    metadata: {
      type: record.type,
      description: record.description,
      source: record.source,
      customer: record.customer,
      tags: record.tags,
    },
  };
}
