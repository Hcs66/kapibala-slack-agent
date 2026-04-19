export type EntityType = "expense_claim" | "recruitment" | "task" | "feedback";

export type WorkflowStatus =
  | "pending"
  | "in_progress"
  | "approved"
  | "rejected"
  | "done"
  | "cancelled";

export type Priority = "P0" | "P1" | "P2" | "P3" | "High" | "Medium" | "Low";

export interface LogEntry {
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
}

export interface ApprovalRecord {
  approver: string;
  decision: "approved" | "rejected";
  timestamp: string;
  comment?: string;
}

export interface WorkflowEntity {
  id: string;
  type: EntityType;
  title: string;
  owner: string;
  assignee?: string;
  priority?: Priority;
  status: WorkflowStatus;
  dueDate?: string;
  logs: LogEntry[];
  approvals: ApprovalRecord[];
  createdAt: string;
  updatedAt: string;
  notionPageId: string;
  notionPageUrl: string;
  metadata: Record<string, unknown>;
}

export const NOTION_STATUS_MAP: Record<
  EntityType,
  Record<string, WorkflowStatus>
> = {
  expense_claim: {
    Pending: "pending",
    Approved: "approved",
    Rejected: "rejected",
    Paid: "done",
  },
  recruitment: {
    "Pending Review": "pending",
    Interviewing: "in_progress",
    Offered: "approved",
    Rejected: "rejected",
    Hired: "done",
    Withdrawn: "cancelled",
  },
  task: {
    "To Do": "pending",
    "In Progress": "in_progress",
    Done: "done",
  },
  feedback: {
    Pending: "pending",
    "In Progress": "in_progress",
    Resolved: "done",
    Closed: "done",
    Rejected: "rejected",
  },
};

/**
 * Reverse map: WorkflowStatus → Notion status name.
 * First matching entry in NOTION_STATUS_MAP wins (the canonical one).
 */
export function toNotionStatus(
  entityType: EntityType,
  status: WorkflowStatus,
): string | undefined {
  const map = NOTION_STATUS_MAP[entityType];
  for (const [notionName, ws] of Object.entries(map)) {
    if (ws === status) return notionName;
  }
  return undefined;
}

export function fromNotionStatus(
  entityType: EntityType,
  notionStatus: string,
): WorkflowStatus | undefined {
  return NOTION_STATUS_MAP[entityType][notionStatus];
}
