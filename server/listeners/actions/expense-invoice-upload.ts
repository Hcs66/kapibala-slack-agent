import type {
  AllMiddlewareArgs,
  BlockAction,
  ButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";

export const EXPENSE_INVOICE_UPLOAD_VIEW_CALLBACK_ID =
  "expense_invoice_upload_view";

interface ExpenseInvoiceUploadValue {
  pageId: string;
  pageUrl: string;
  claimTitle: string;
}

export const expenseInvoiceUploadCallback = async ({
  ack,
  action,
  body,
  client,
  logger,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();

  const buttonAction = action as ButtonAction;
  const value: ExpenseInvoiceUploadValue = JSON.parse(buttonAction.value);

  const triggerId = body.trigger_id;
  if (!triggerId) return;

  try {
    await client.views.open({
      trigger_id: triggerId,
      view: {
        type: "modal",
        callback_id: EXPENSE_INVOICE_UPLOAD_VIEW_CALLBACK_ID,
        private_metadata: JSON.stringify({
          pageId: value.pageId,
          pageUrl: value.pageUrl,
          claimTitle: value.claimTitle,
          channelId: body.channel?.id,
          messageTs: body.message?.ts,
        }),
        title: {
          type: "plain_text",
          text: "Upload Invoice",
        },
        submit: {
          type: "plain_text",
          text: "Upload",
        },
        close: {
          type: "plain_text",
          text: "Cancel",
        },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Upload invoice for *${value.claimTitle}*`,
            },
          },
          {
            type: "input",
            block_id: "invoice",
            label: { type: "plain_text", text: "Invoice / Receipt" },
            element: {
              type: "file_input",
              action_id: "value",
              max_files: 3,
            },
          },
        ],
      },
    });
  } catch (error) {
    logger.error("Failed to open invoice upload modal:", error);
  }
};
