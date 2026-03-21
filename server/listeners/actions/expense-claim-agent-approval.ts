import type {
  AllMiddlewareArgs,
  BlockAction,
  ButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { updateExpenseClaimStatus } from "~/lib/notion/expense-claim";
import { findNotionUser } from "~/lib/notion/user-map";

interface ExpenseClaimAgentApprovalValue {
  pageId: string;
  pageUrl: string;
  claimTitle: string;
  amount: number;
  currency: string;
  expenseType: string;
  submitterId: string;
  approved: boolean;
}

export const expenseClaimAgentApprovalCallback = async ({
  ack,
  action,
  body,
  client,
  logger,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();

  const buttonAction = action as ButtonAction;
  const value: ExpenseClaimAgentApprovalValue = JSON.parse(buttonAction.value);
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

  logger.info(`Expense claim ${status}: ${claimTitle} (pageId: ${pageId})`);

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
    let approverNotionUserId: string | null = null;
    if (approved) {
      try {
        const userInfo = await client.users.info({ user: reviewedBy });
        const email = userInfo.user?.profile?.email;
        if (email) {
          approverNotionUserId = await findNotionUser(email);
        }
      } catch (error) {
        console.warn(
          "Failed to resolve Notion user for approver",
          reviewedBy,
          error,
        );
      }
    }

    await Promise.all([
      updateExpenseClaimStatus(pageId, status, approverNotionUserId),
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
