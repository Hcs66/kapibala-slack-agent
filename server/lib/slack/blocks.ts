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
  expenseType,
  submitterId,
}: {
  pageId: string;
  pageUrl: string;
  claimTitle: string;
  amount: number;
  expenseType: string;
  submitterId: string;
}): KnownBlock[] => {
  const fields = [
    `*Claim Title:* ${claimTitle}`,
    `*Amount:* $${amount}`,
    `*Expense Type:* ${expenseType}`,
    `*Submitted By:* <@${submitterId}>`,
    `*Notion:* <${pageUrl}|View in Notion>`,
  ];

  const payload = {
    pageId,
    pageUrl,
    claimTitle,
    amount,
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

export const EXPENSE_INVOICE_UPLOAD_ACTION = "expense_invoice_upload";

export const expenseInvoiceUploadBlocks = ({
  pageId,
  pageUrl,
  claimTitle,
  amount,
}: {
  pageId: string;
  pageUrl: string;
  claimTitle: string;
  amount: number;
}): KnownBlock[] => {
  const sectionBlock: SectionBlock = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `📎 报销 *${claimTitle}* ($${amount}) 已提交。\n如需上传发票/收据附件，请点击下方按钮。\n<${pageUrl}|在 Notion 中查看>`,
    },
  };

  const actionsBlock: ActionsBlock = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Upload Invoice",
          emoji: true,
        },
        style: "primary",
        action_id: EXPENSE_INVOICE_UPLOAD_ACTION,
        value: JSON.stringify({ pageId, pageUrl, claimTitle }),
      },
    ],
  };

  return [sectionBlock, actionsBlock];
};

export const CANDIDATE_RESUME_UPLOAD_ACTION = "candidate_resume_upload";

export const candidateResumeUploadBlocks = ({
  pageId,
  pageUrl,
  candidateName,
}: {
  pageId: string;
  pageUrl: string;
  candidateName: string;
}): KnownBlock[] => {
  const sectionBlock: SectionBlock = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `📎 候选人 *${candidateName}* 已录入 Notion。\n如需上传简历附件，请点击下方按钮。\n<${pageUrl}|在 Notion 中查看>`,
    },
  };

  const actionsBlock: ActionsBlock = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Upload Resume", emoji: true },
        style: "primary",
        action_id: CANDIDATE_RESUME_UPLOAD_ACTION,
        value: JSON.stringify({ pageId, pageUrl, candidateName }),
      },
    ],
  };

  return [sectionBlock, actionsBlock];
};

export const MEETING_ACTION_ITEMS_ACTION = "meeting_action_items_approval";

export interface MeetingActionItem {
  taskName: string;
  description: string;
  assignee?: string;
  priority: string;
  dueDate?: string;
}

export const meetingActionItemsApprovalBlocks = ({
  toolCallId,
  meetingTitle,
  actionItems,
}: {
  toolCallId: string;
  meetingTitle: string;
  actionItems: MeetingActionItem[];
}): KnownBlock[] => {
  const itemLines = actionItems
    .map((item, i) => {
      const parts = [`${i + 1}. *${item.taskName}*`];
      if (item.assignee) parts.push(`Assignee: ${item.assignee}`);
      parts.push(`Priority: ${item.priority}`);
      if (item.dueDate) parts.push(`Due: ${item.dueDate}`);
      if (item.description) parts.push(`\n    ${item.description}`);
      return parts.join(" | ");
    })
    .join("\n");

  const sectionBlock: SectionBlock = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `📋 *Action Items from: ${meetingTitle}*\n\n${itemLines}\n\nCreate ${actionItems.length} task(s) in Notion?`,
    },
  };

  const actionsBlock: ActionsBlock = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Create Tasks", emoji: true },
        style: "primary",
        action_id: MEETING_ACTION_ITEMS_ACTION,
        value: JSON.stringify({ toolCallId, approved: true }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Skip", emoji: true },
        style: "danger",
        action_id: `${MEETING_ACTION_ITEMS_ACTION}_reject`,
        value: JSON.stringify({ toolCallId, approved: false }),
      },
    ],
  };

  return [sectionBlock, actionsBlock];
};

export const SAVE_DOC_ACTION = "save_doc_to_notion";

export const saveDocApprovalBlocks = ({
  toolCallId,
  docName,
  summary,
}: {
  toolCallId: string;
  docName: string;
  summary: string;
}): KnownBlock[] => {
  const sectionBlock: SectionBlock = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `📝 *保存到 Notion?*\n\n*标题:* ${docName}\n*摘要:* ${summary}`,
    },
  };

  const actionsBlock: ActionsBlock = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Save to Notion", emoji: true },
        style: "primary",
        action_id: SAVE_DOC_ACTION,
        value: JSON.stringify({ toolCallId, approved: true }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Cancel", emoji: true },
        style: "danger",
        action_id: `${SAVE_DOC_ACTION}_reject`,
        value: JSON.stringify({ toolCallId, approved: false }),
      },
    ],
  };

  return [sectionBlock, actionsBlock];
};
