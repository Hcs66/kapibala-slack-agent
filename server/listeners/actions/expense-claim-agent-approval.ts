import type {
  AllMiddlewareArgs,
  BlockAction,
  ButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { updateExpenseClaimStatus } from "~/lib/notion/expense-claim";
import { syncExpenseClaimToExpenses } from "~/lib/notion/expenses";
import { findNotionUser } from "~/lib/notion/user-map";
import { toNotionStatus } from "~/lib/workflow-engine/types";

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

  const workflowStatus = approved ? "approved" : "rejected";
  const status = toNotionStatus("expense_claim", workflowStatus) as
    | "Approved"
    | "Rejected";
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

    const promises = [
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
    ];

    if (approved) {
      const payerEmail = process.env.EXPENSE_CLAIM_PAYER_EMAIL;
      if (payerEmail) {
        try {
          const lookupResult = await client.users.lookupByEmail({
            email: payerEmail,
          });
          const payerSlackId = lookupResult.user?.id;
          if (payerSlackId) {
            const payButtonValue = JSON.stringify({
              pageId,
              pageUrl,
              claimTitle,
              amount,
              currency,
              expenseType,
              submitterId,
              reviewedBy,
            });

            promises.push(
              client.chat.postMessage({
                channel: payerSlackId,
                text: `New approved expense claim: ${claimTitle}`,
                blocks: [
                  {
                    type: "header",
                    text: {
                      type: "plain_text",
                      text: "New Approved Expense Claim",
                    },
                  },
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: [
                        `*Claim Title:* ${claimTitle}`,
                        `*Amount:* ${amount} ${currency}`,
                        `*Expense Type:* ${expenseType}`,
                        `*Submitted By:* <@${submitterId}>`,
                        `*Approved By:* <@${reviewedBy}>`,
                        `*Notion:* <${pageUrl}|View in Notion>`,
                      ].join("\n"),
                    },
                  },
                  {
                    type: "actions",
                    elements: [
                      {
                        type: "button",
                        text: { type: "plain_text", text: "Pay", emoji: true },
                        style: "primary",
                        action_id: "expense_claim_pay",
                        value: payButtonValue,
                      },
                    ],
                  },
                ],
              }),
            );
          }
        } catch (error) {
          console.warn("Failed to lookup payer by email:", payerEmail, error);
        }
      }
    }

    await Promise.all(promises);

    if (approved) {
      try {
        await syncExpenseClaimToExpenses({
          claimTitle,
          amount,
          expenseType,
          claimPageId: pageId,
        });
      } catch (syncError) {
        console.warn("Failed to sync expense claim to expenses DB:", syncError);
      }
    }

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
