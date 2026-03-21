import type {
  AllMiddlewareArgs,
  BlockAction,
  ButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { updateExpenseClaimStatus } from "~/lib/notion/expense-claim";

interface ExpenseClaimApprovalValue {
  pageId: string;
  pageUrl: string;
  claimTitle: string;
  amount: number;
  currency: string;
  expenseType: string;
  submitterId: string;
  approved: boolean;
}

export const expenseClaimApprovalCallback = async ({
  ack,
  action,
  body,
  client,
  logger,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();

  const buttonAction = action as ButtonAction;
  const value: ExpenseClaimApprovalValue = JSON.parse(buttonAction.value);
  const {
    pageId,
    pageUrl,
    claimTitle,
    amount,
    currency,
    expenseType,
    submitterId,
    approved,
  } = value;

  const status = approved ? "Approved" : "Rejected";
  const statusEmoji = approved ? "\u2705" : "\u274C";
  const reviewedBy = body.user.id;
  if (body.message?.ts && body.channel?.id) {
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              `\u23F3 *Expense Claim Processing (${status})...*`,
              `*Claim Title:* ${claimTitle}`,
              `*Amount:* ${amount} ${currency}`,
              `*Expense Type:* ${expenseType}`,
              `*Submitted By:* <@${submitterId}>`,
              `*Reviewed By:* <@${reviewedBy}>`,
              `*Notion:* <${pageUrl}|View in Notion>`,
            ].join("\n"),
          },
        },
      ],
      text: `Expense claim processing: ${claimTitle}`,
    });
  }

  try {
    await Promise.all([
      updateExpenseClaimStatus(pageId, status),
      client.chat.postMessage({
        channel: submitterId,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                `${statusEmoji} Your expense claim *${claimTitle}* (${amount} ${currency}) has been *${status}* by <@${reviewedBy}>.`,
                `*Notion:* <${pageUrl}|View in Notion>`,
              ].join("\n"),
            },
          },
        ],
      }),
    ]);

    if (body.message?.ts && body.channel?.id) {
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                `${statusEmoji} *Expense Claim ${status}*`,
                `*Claim Title:* ${claimTitle}`,
                `*Amount:* ${amount} ${currency}`,
                `*Expense Type:* ${expenseType}`,
                `*Submitted By:* <@${submitterId}>`,
                `*Reviewed By:* <@${reviewedBy}>`,
                `*Notion:* <${pageUrl}|View in Notion>`,
              ].join("\n"),
            },
          },
        ],
        text: `Expense claim ${status}: ${claimTitle}`,
      });
    }
  } catch (error) {
    logger.error("Failed to process expense claim approval:", error);

    if (body.message?.ts && body.channel?.id) {
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                `\u26A0\uFE0F *Expense Claim ${status} (Sync Failed)*`,
                `*Claim Title:* ${claimTitle}`,
                `*Amount:* ${amount} ${currency}`,
                `*Expense Type:* ${expenseType}`,
                `*Submitted By:* <@${submitterId}>`,
                `*Reviewed By:* <@${reviewedBy}>`,
                `*Notion:* <${pageUrl}|View in Notion>`,
                `_Notion sync failed. Please update manually._`,
              ].join("\n"),
            },
          },
        ],
        text: `Expense claim ${status} (sync failed): ${claimTitle}`,
      });
    }
  }
};
