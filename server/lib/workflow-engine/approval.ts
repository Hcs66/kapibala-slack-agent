import type { ActionsBlock, KnownBlock, SectionBlock } from "@slack/web-api";
import { canTransition } from "./status-machine";
import type { ApprovalRecord, EntityType, WorkflowEntity } from "./types";

const ENTITY_LABEL: Record<EntityType, string> = {
  expense_claim: "Expense Claim",
  recruitment: "Recruitment",
  task: "Task",
  feedback: "Feedback",
};

export interface ApprovalRequestParams {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  requesterId: string;
  actionIdPrefix: string;
  fields: Array<{ label: string; value: string }>;
  metadata: Record<string, unknown>;
}

export function createApprovalBlocks(
  params: ApprovalRequestParams,
): KnownBlock[] {
  const {
    entityType,
    entityTitle,
    requesterId,
    actionIdPrefix,
    fields,
    metadata,
  } = params;
  const label = ENTITY_LABEL[entityType];

  const fieldLines = fields.map((f) => `*${f.label}:* ${f.value}`);
  fieldLines.push(`*Submitted By:* <@${requesterId}>`);

  const sectionBlock: SectionBlock = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `💰 *${label} Approval Request*\n\n${fieldLines.join("\n")}`,
    },
  };

  const payload = {
    ...metadata,
    entityId: params.entityId,
    entityTitle,
    entityType,
    requesterId,
  };

  const actionsBlock: ActionsBlock = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Approve", emoji: true },
        style: "primary",
        action_id: actionIdPrefix,
        value: JSON.stringify({ ...payload, approved: true }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Reject", emoji: true },
        style: "danger",
        action_id: `${actionIdPrefix}_reject`,
        value: JSON.stringify({ ...payload, approved: false }),
      },
    ],
  };

  return [sectionBlock, actionsBlock];
}

export interface ProcessApprovalParams {
  entity: WorkflowEntity;
  decision: "approved" | "rejected";
  approver: string;
  comment?: string;
}

export interface ProcessApprovalResult {
  entity: WorkflowEntity;
  approval: ApprovalRecord;
  transitionValid: boolean;
}

export function processApproval(
  params: ProcessApprovalParams,
): ProcessApprovalResult {
  const { entity, decision, approver, comment } = params;

  const targetStatus = decision === "approved" ? "approved" : "rejected";
  const transitionValid = canTransition(
    entity.type,
    entity.status,
    targetStatus,
  );

  const approval: ApprovalRecord = {
    approver,
    decision,
    timestamp: new Date().toISOString(),
    comment,
  };

  const updatedEntity: WorkflowEntity = {
    ...entity,
    status: transitionValid ? targetStatus : entity.status,
    updatedAt: approval.timestamp,
    approvals: [...entity.approvals, approval],
    logs: [
      ...entity.logs,
      {
        timestamp: approval.timestamp,
        actor: approver,
        action: `approval:${decision}`,
        detail: comment ?? "",
      },
    ],
  };

  return {
    entity: updatedEntity,
    approval,
    transitionValid,
  };
}
