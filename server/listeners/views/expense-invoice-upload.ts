import type { AllMiddlewareArgs, SlackViewMiddlewareArgs } from "@slack/bolt";
import type { ExpenseClaimAttachment } from "~/lib/notion/expense-claim";
import { updateExpenseClaimAttachments } from "~/lib/notion/expense-claim";
import { uploadFileToNotion } from "~/lib/notion/file-upload";
import { downloadSlackFile, getSlackFileInfo } from "~/lib/slack/files";

interface InvoiceUploadMetadata {
  pageId: string;
  pageUrl: string;
  claimTitle: string;
  channelId?: string;
  messageTs?: string;
}

const expenseInvoiceUploadViewCallback = async ({
  ack,
  view,
  body,
  client,
  logger,
}: AllMiddlewareArgs & SlackViewMiddlewareArgs) => {
  try {
    await ack();

    const metadata: InvoiceUploadMetadata = JSON.parse(view.private_metadata);
    const { pageId, pageUrl, claimTitle, channelId, messageTs } = metadata;

    const slackFiles =
      (
        view.state.values.invoice?.value as unknown as {
          files?: { id: string }[];
        }
      )?.files ?? [];

    if (slackFiles.length === 0) {
      await client.chat.postMessage({
        channel: body.user.id,
        text: "No file was selected. Please try again.",
      });
      return;
    }

    const botToken = process.env.SLACK_BOT_TOKEN;
    if (!botToken) {
      throw new Error("SLACK_BOT_TOKEN is not configured");
    }

    const attachments: ExpenseClaimAttachment[] = [];
    for (const slackFile of slackFiles) {
      const fileInfo = await getSlackFileInfo(client, slackFile.id);
      if (!fileInfo) continue;

      const buffer = await downloadSlackFile(fileInfo.url, botToken);
      const result = await uploadFileToNotion(
        buffer,
        fileInfo.name,
        fileInfo.mimetype,
      );
      attachments.push({
        fileUploadId: result.fileUploadId,
        filename: result.filename,
      });
    }

    if (attachments.length === 0) {
      await client.chat.postMessage({
        channel: body.user.id,
        text: "Failed to process the uploaded file. Please try again.",
      });
      return;
    }

    await updateExpenseClaimAttachments(pageId, attachments);

    if (channelId && messageTs) {
      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `✅ 报销 *${claimTitle}* 的发票/收据已上传至 Notion。\n<${pageUrl}|在 Notion 中查看>`,
            },
          },
        ],
        text: `Invoice uploaded for ${claimTitle}`,
      });
    }

    await client.chat.postMessage({
      channel: body.user.id,
      text: `✅ 发票/收据已成功上传至报销 *${claimTitle}* 的 Notion 页面。\n<${pageUrl}|在 Notion 中查看>`,
    });
  } catch (error) {
    logger.error("Invoice upload view submission failed:", error);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: "Sorry, something went wrong uploading the invoice. Please try again.",
      });
    } catch (notifyError) {
      logger.error("Also failed to notify user of error:", notifyError);
    }
  }
};

export default expenseInvoiceUploadViewCallback;
