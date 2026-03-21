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

  const tasks: Promise<unknown>[] = [
    updateExpenseClaimStatus(pageId, status).catch((error) =>
      logger.error("Failed to update Notion expense claim status:", error),
    ),
    client.chat.postMessage({
      channel: submitterId,
      text: `${statusEmoji} Your expense claim *${claimTitle}* (${amount} ${currency}) has been *${status}* by <@${body.user.id}>.`,
    }),
  ];

  if (body.message?.ts && body.channel?.id) {
    tasks.push(
      client.chat.update({
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
                `*Notion:* <${pageUrl}|View in Notion>`,
              ].join("\n"),
            },
          },
        ],
        text: `Expense claim ${status}: ${claimTitle}`,
      }),
    );
  }

  await Promise.all(tasks);
};
