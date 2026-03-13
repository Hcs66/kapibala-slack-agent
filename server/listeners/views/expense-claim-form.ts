import type { AllMiddlewareArgs, SlackViewMiddlewareArgs } from "@slack/bolt";
import type { ExpenseClaimAttachment } from "~/lib/notion/expense-claim";
import { createExpenseClaim } from "~/lib/notion/expense-claim";
import { uploadFileToNotion } from "~/lib/notion/file-upload";
import { findNotionUser } from "~/lib/notion/user-map";
import { downloadSlackFile, getSlackFileInfo } from "~/lib/slack/files";

export const EXPENSE_CLAIM_APPROVAL_ACTION = "expense_claim_approval";

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

    let approverSlackId: string | null = null;
    const approverEmail = process.env.EXPENSE_CLAIM_APPROVER_EMAIL;
    if (approverEmail) {
      try {
        const lookupResult = await client.users.lookupByEmail({
          email: approverEmail,
        });
        approverSlackId = lookupResult.user?.id ?? null;
      } catch (error) {
        console.warn(
          "Failed to lookup approver by email:",
          approverEmail,
          error,
        );
      }
    }

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

    const page = await createExpenseClaim({
      claimTitle,
      claimDescription,
      amount,
      currency,
      expenseType,
      paymentMethod: "",
      approverNotionUserId,
      payerNotionUserId: null,
      submittedByNotionUserId,
      notes: "",
      invoiceAttachments,
    });

    const pageUrl = (page as { url: string }).url;
    const submitterId = body.user.id;

    const fields = [
      `*Claim Title:* ${claimTitle}`,
      `*Amount:* ${amount} ${currency}`,
      `*Expense Type:* ${expenseType}`,
      `*Submitted By:* <@${submitterId}>`,
    ];
    fields.push(`*Notion:* <${pageUrl}|View in Notion>`);
    if (claimDescription) fields.push(`*Description:* ${claimDescription}`);

    const notificationChannel = process.env.EXPENSE_CLAIM_CHANNEL_ID;
    if (notificationChannel) {
      await client.chat.postMessage({
        channel: notificationChannel,
        text: `New expense claim: ${claimTitle}`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "New Expense Claim",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${fields.join("\n")}`,
            },
          },
        ],
      });
    }

    await client.chat.postMessage({
      channel: submitterId,
      text: `Expense claim saved: ${pageUrl}`,
    });

    const pageId = (page as { id: string }).id;
    const approvalPayload = JSON.stringify({
      pageId,
      pageUrl,
      claimTitle,
      amount,
      currency,
      expenseType,
      submitterId,
      approved: true,
    });
    const rejectPayload = JSON.stringify({
      pageId,
      pageUrl,
      claimTitle,
      amount,
      currency,
      expenseType,
      submitterId,
      approved: false,
    });

    if (approverSlackId) {
      await client.chat.postMessage({
        channel: approverSlackId,
        text: `Expense claim approval request: ${claimTitle}`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "Expense Claim Approval Request",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: fields.join("\n"),
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Approve", emoji: true },
                style: "primary",
                action_id: EXPENSE_CLAIM_APPROVAL_ACTION,
                value: approvalPayload,
              },
              {
                type: "button",
                text: { type: "plain_text", text: "Reject", emoji: true },
                style: "danger",
                action_id: `${EXPENSE_CLAIM_APPROVAL_ACTION}_reject`,
                value: rejectPayload,
              },
            ],
          },
        ],
      });
    }
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
