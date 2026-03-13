import type { AllMiddlewareArgs, SlackViewMiddlewareArgs } from "@slack/bolt";
import type { ExpenseClaimAttachment } from "~/lib/notion/expense-claim";
import { createExpenseClaim } from "~/lib/notion/expense-claim";
import { uploadFileToNotion } from "~/lib/notion/file-upload";
import { findNotionUser } from "~/lib/notion/user-map";
import { downloadSlackFile, getSlackFileInfo } from "~/lib/slack/files";

async function resolveNotionUserId(
  client: AllMiddlewareArgs["client"],
  slackUserId: string,
): Promise<string | null> {
  try {
    const userInfo = await client.users.info({ user: slackUserId });
    const email = userInfo.user?.profile?.email;
    if (!email) return null;
    return await findNotionUser(email);
  } catch (error) {
    console.warn("Failed to resolve Notion user for", slackUserId, error);
    return null;
  }
}

const expenseClaimFormCallback = async ({
  ack,
  view,
  body,
  client,
  logger,
}: AllMiddlewareArgs & SlackViewMiddlewareArgs) => {
  try {
    await ack();

    const values = view.state.values;

    const claimTitle = values.claim_title.value.value ?? "";
    const claimDescription = values.claim_description.value.value ?? "";
    const amount = Number.parseFloat(values.amount.value.value ?? "0");
    const currency = values.currency.value.selected_option?.value ?? "";
    const expenseType = values.expense_type.value.selected_option?.value ?? "";
    const paymentMethod =
      values.payment_method.value.selected_option?.value ?? "";
    const approverSlackId = values.approver.value.selected_user;
    const payerSlackId = values.payer.value.selected_user;
    const notes = values.notes.value.value ?? "";

    // Handle file attachments: Slack → download → Notion upload
    const invoiceAttachments: ExpenseClaimAttachment[] = [];
    const slackFiles =
      (
        values.invoice_attachment?.value as unknown as {
          files?: { id: string }[];
        }
      )?.files ?? [];
    const botToken = process.env.SLACK_BOT_TOKEN;

    if (slackFiles.length > 0 && botToken) {
      for (const slackFile of slackFiles) {
        const fileInfo = await getSlackFileInfo(client, slackFile.id);
        if (!fileInfo) continue;

        const buffer = await downloadSlackFile(fileInfo.url, botToken);
        const result = await uploadFileToNotion(
          buffer,
          fileInfo.name,
          fileInfo.mimetype,
        );
        invoiceAttachments.push({
          fileUploadId: result.fileUploadId,
          filename: result.filename,
        });
      }
    }

    const submittedByNotionUserId = await resolveNotionUserId(
      client,
      body.user.id,
    );

    let approverNotionUserId: string | null = null;
    if (approverSlackId) {
      approverNotionUserId = await resolveNotionUserId(client, approverSlackId);
    }

    let payerNotionUserId: string | null = null;
    if (payerSlackId) {
      payerNotionUserId = await resolveNotionUserId(client, payerSlackId);
    }

    const page = await createExpenseClaim({
      claimTitle,
      claimDescription,
      amount,
      currency,
      expenseType,
      paymentMethod,
      approverNotionUserId,
      payerNotionUserId,
      submittedByNotionUserId,
      notes,
      invoiceAttachments,
    });

    await client.chat.postMessage({
      channel: body.user.id,
      text: `Expense claim saved: ${(page as { url: string }).url}`,
    });
  } catch (error) {
    logger.error("Expense claim form submission failed:", error);
    try {
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: "Sorry, something went wrong saving your expense claim.",
      });
    } catch (notifyError) {
      logger.error("Also failed to notify user of error:", notifyError);
    }
  }
};

export default expenseClaimFormCallback;
