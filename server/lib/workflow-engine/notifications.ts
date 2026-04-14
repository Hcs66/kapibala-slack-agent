import type { KnownBlock } from "@slack/web-api";
import type { EntityType, WorkflowEntity, WorkflowStatus } from "./types";

const STATUS_EMOJI: Record<WorkflowStatus, string> = {
  pending: "🟡",
  in_progress: "🔵",
  approved: "✅",
  rejected: "❌",
  done: "✅",
  cancelled: "⚪",
};

const ENTITY_LABEL: Record<EntityType, string> = {
  expense_claim: "Expense Claim",
  recruitment: "Recruitment",
  task: "Task",
  feedback: "Feedback",
};

function buildStatusChangeBlocks(params: {
  entity: WorkflowEntity;
  oldStatus: WorkflowStatus;
  newStatus: WorkflowStatus;
  actor: string;
}): KnownBlock[] {
  const { entity, oldStatus, newStatus, actor } = params;
  const emoji = STATUS_EMOJI[newStatus];
  const label = ENTITY_LABEL[entity.type];

  const fields = [
    `*${label}:* ${entity.title}`,
    `*Status:* ${oldStatus} → ${newStatus}`,
    `*Updated by:* <@${actor}>`,
  ];

  if (entity.notionPageUrl) {
    fields.push(`*Notion:* <${entity.notionPageUrl}|View in Notion>`);
  }

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *${label} ${newStatus.replace("_", " ")}*\n\n${fields.join("\n")}`,
      },
    },
  ];
}

export interface NotifyStatusChangeParams {
  entity: WorkflowEntity;
  oldStatus: WorkflowStatus;
  newStatus: WorkflowStatus;
  actor: string;
  token: string;
  notifyUserIds: string[];
  notifyChannelId?: string;
}

export async function notifyStatusChange(
  params: NotifyStatusChangeParams,
): Promise<void> {
  const { token, notifyUserIds, notifyChannelId } = params;
  const { WebClient } = await import("@slack/web-api");
  const client = new WebClient(token);

  const blocks = buildStatusChangeBlocks(params);
  const label = ENTITY_LABEL[params.entity.type];
  const text = `${label} "${params.entity.title}" is now ${params.newStatus}`;

  const promises: Promise<unknown>[] = [];

  for (const userId of notifyUserIds) {
    promises.push(client.chat.postMessage({ channel: userId, blocks, text }));
  }

  if (notifyChannelId) {
    promises.push(
      client.chat.postMessage({ channel: notifyChannelId, blocks, text }),
    );
  }

  await Promise.all(promises);
}

export interface NotifyAssignmentParams {
  entity: WorkflowEntity;
  assignee: string;
  assigner: string;
  token: string;
}

export async function notifyAssignment(
  params: NotifyAssignmentParams,
): Promise<void> {
  const { entity, assignee, assigner, token } = params;
  const { WebClient } = await import("@slack/web-api");
  const client = new WebClient(token);

  const label = ENTITY_LABEL[entity.type];
  const fields = [
    `*${label}:* ${entity.title}`,
    `*Assigned by:* <@${assigner}>`,
  ];

  if (entity.dueDate) {
    fields.push(`*Due:* ${entity.dueDate}`);
  }
  if (entity.notionPageUrl) {
    fields.push(`*Notion:* <${entity.notionPageUrl}|View in Notion>`);
  }

  await client.chat.postMessage({
    channel: assignee,
    text: `New ${label.toLowerCase()} assigned: ${entity.title}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `📋 New ${label} Assigned`,
        },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: fields.join("\n") },
      },
    ],
  });
}
