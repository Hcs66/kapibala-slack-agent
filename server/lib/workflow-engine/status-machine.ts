import type {
  EntityType,
  LogEntry,
  WorkflowEntity,
  WorkflowStatus,
} from "./types";

const TRANSITIONS: Record<EntityType, Record<string, WorkflowStatus[]>> = {
  expense_claim: {
    pending: ["approved", "rejected", "cancelled"],
    approved: ["done", "cancelled"],
    rejected: ["pending"],
    done: [],
    cancelled: [],
  },
  recruitment: {
    pending: ["in_progress", "rejected", "cancelled"],
    in_progress: ["approved", "rejected", "cancelled"],
    approved: ["done", "cancelled"],
    rejected: ["pending"],
    done: [],
    cancelled: [],
  },
  task: {
    pending: ["in_progress", "cancelled"],
    in_progress: ["done", "pending"],
    done: [],
    cancelled: [],
  },
  feedback: {
    pending: ["in_progress", "rejected", "cancelled"],
    in_progress: ["done", "pending"],
    rejected: ["pending"],
    done: [],
    cancelled: [],
  },
};

export function getValidTransitions(
  entityType: EntityType,
  currentStatus: WorkflowStatus,
): WorkflowStatus[] {
  return TRANSITIONS[entityType][currentStatus] ?? [];
}

export function canTransition(
  entityType: EntityType,
  from: WorkflowStatus,
  to: WorkflowStatus,
): boolean {
  return getValidTransitions(entityType, from).includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly entityType: EntityType,
    public readonly from: WorkflowStatus,
    public readonly to: WorkflowStatus,
  ) {
    super(
      `Invalid transition for ${entityType}: "${from}" → "${to}". Valid targets: [${getValidTransitions(entityType, from).join(", ")}]`,
    );
    this.name = "InvalidTransitionError";
  }
}

export function transition(
  entity: WorkflowEntity,
  to: WorkflowStatus,
  actor: string,
  detail?: string,
): WorkflowEntity {
  if (!canTransition(entity.type, entity.status, to)) {
    throw new InvalidTransitionError(entity.type, entity.status, to);
  }

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    actor,
    action: `status_change:${entity.status}→${to}`,
    detail: detail ?? "",
  };

  return {
    ...entity,
    status: to,
    updatedAt: logEntry.timestamp,
    logs: [...entity.logs, logEntry],
  };
}
