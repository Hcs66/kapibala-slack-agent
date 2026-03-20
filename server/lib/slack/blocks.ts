import type {
  ActionsBlock,
  ContextActionsBlock,
  KnownBlock,
  SectionBlock,
} from "@slack/web-api";

export const feedbackBlock = ({
  thread_ts,
}: {
  thread_ts: string;
}): ContextActionsBlock => {
  return {
    type: "context_actions",
    elements: [
      {
        type: "feedback_buttons",
        action_id: "feedback",
        positive_button: {
          text: {
            type: "plain_text",
            text: "👍",
          },
          value: `${thread_ts}:positive_feedback`,
        },
        negative_button: {
          text: {
            type: "plain_text",
            text: "👎",
          },
          value: `${thread_ts}:negative_feedback`,
        },
      },
    ],
  };
};

export const CHANNEL_JOIN_APPROVAL_ACTION = "channel_join_approval";

export const channelJoinApprovalBlocks = ({
  toolCallId,
  channelId,
  channelName,
}: {
  toolCallId: string;
  channelId: string;
  channelName?: string;
}): KnownBlock[] => {
  // Use Slack's channel link format to make it clickable
  const channelLink = `<#${channelId}>`;

  const sectionBlock: SectionBlock = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `🔐 *Permission Request*\n\nI'd like to join the channel ${channelLink} to help with your request. Do you approve?`,
    },
  };

  const actionsBlock: ActionsBlock = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Approve",
          emoji: true,
        },
        style: "primary",
        action_id: CHANNEL_JOIN_APPROVAL_ACTION,
        value: JSON.stringify({
          toolCallId,
          channelId,
          channelName,
          approved: true,
        }),
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Reject",
          emoji: true,
        },
        style: "danger",
        action_id: `${CHANNEL_JOIN_APPROVAL_ACTION}_reject`,
        value: JSON.stringify({
          toolCallId,
          channelId,
          channelName,
          approved: false,
        }),
      },
    ],
  };

  return [sectionBlock, actionsBlock];
};

export const EXPENSE_CLAIM_AGENT_APPROVAL_ACTION =
  "expense_claim_agent_approval";

export const expenseClaimApprovalBlocks = ({
  pageId,
  pageUrl,
  claimTitle,
  amount,
  currency,
  expenseType,
  submitterId,
}: {
  pageId: string;
  pageUrl: string;
  claimTitle: string;
  amount: number;
  currency: string;
  expenseType: string;
  submitterId: string;
}): KnownBlock[] => {
  const fields = [
    `*Claim Title:* ${claimTitle}`,
    `*Amount:* ${amount} ${currency}`,
    `*Expense Type:* ${expenseType}`,
    `*Submitted By:* <@${submitterId}>`,
    `*Notion:* <${pageUrl}|View in Notion>`,
  ];

  const payload = {
    pageId,
    pageUrl,
    claimTitle,
    amount,
    currency,
    expenseType,
    submitterId,
  };

  const sectionBlock: SectionBlock = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `💰 *Expense Claim Approval Request*\n\n${fields.join("\n")}`,
    },
  };

  const actionsBlock: ActionsBlock = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Approve", emoji: true },
        style: "primary",
        action_id: EXPENSE_CLAIM_AGENT_APPROVAL_ACTION,
        value: JSON.stringify({ ...payload, approved: true }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Reject", emoji: true },
        style: "danger",
        action_id: `${EXPENSE_CLAIM_AGENT_APPROVAL_ACTION}_reject`,
        value: JSON.stringify({ ...payload, approved: false }),
      },
    ],
  };

  return [sectionBlock, actionsBlock];
};
