import type { AllMiddlewareArgs, SlackViewMiddlewareArgs } from "@slack/bolt";
import { updateExpenseClaimPayment } from "~/lib/notion/expense-claim";
import { findNotionUser } from "~/lib/notion/user-map";
import { canTransition } from "~/lib/workflow-engine/status-machine";

interface ExpenseClaimPayMetadata {
  pageId: string;
  pageUrl: string;
  claimTitle: string;
  amount: number;
  expenseType: string;
  submitterId: string;
  reviewedBy: string;
}

const expenseClaimPayModalCallback = async ({
  ack,
  view,
  body,
  client,
  logger,
}: AllMiddlewareArgs & SlackViewMiddlewareArgs) => {
  try {
    await ack();

    const metadata: ExpenseClaimPayMetadata = JSON.parse(view.private_metadata);
    const values = view.state.values;

    const paymentMethod =
      values.payment_method.value.selected_option?.value ?? "";
    const paymentDate = values.payment_date.value.selected_date ?? "";

    const payerId = body.user.id;

    if (!canTransition("expense_claim", "approved", "done")) {
      logger.error("Invalid transition: expense_claim approved → done");
      return;
    }

    let payerNotionUserId: string | null = null;
    try {
      const userInfo = await client.users.info({ user: payerId });
      const email = userInfo.user?.profile?.email;
      if (email) {
        payerNotionUserId = await findNotionUser(email);
      }
    } catch (error) {
      console.warn("Failed to resolve Notion user for payer", payerId, error);
    }

    await updateExpenseClaimPayment(
      metadata.pageId,
      paymentMethod,
      paymentDate,
      payerNotionUserId,
    );

    await Promise.all([
      client.chat.postMessage({
        channel: metadata.submitterId,
        text: `Your expense claim has been paid: ${metadata.claimTitle}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                `💰 Your expense claim *${metadata.claimTitle}* ($${metadata.amount}) has been paid.`,
                `*Payment Method:* ${paymentMethod}`,
                `*Payment Date:* ${paymentDate}`,
                `*Paid By:* <@${payerId}>`,
                `*Notion:* <${metadata.pageUrl}|View in Notion>`,
              ].join("\n"),
            },
          },
        ],
      }),
      client.chat.postMessage({
        channel: payerId,
        text: `Payment processed: ${metadata.claimTitle}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                `✅ Payment processed for *${metadata.claimTitle}* ($${metadata.amount})`,
                `*Payment Method:* ${paymentMethod}`,
                `*Payment Date:* ${paymentDate}`,
                `*Notion:* <${metadata.pageUrl}|View in Notion>`,
              ].join("\n"),
            },
          },
        ],
      }),
    ]);
  } catch (error) {
    logger.error("Expense claim payment processing failed:", error);
    try {
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: "Sorry, something went wrong processing the payment.",
      });
    } catch (notifyError) {
      logger.error("Also failed to notify user of error:", notifyError);
    }
  }
};

export default expenseClaimPayModalCallback;
