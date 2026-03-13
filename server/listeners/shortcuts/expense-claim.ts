import type {
  AllMiddlewareArgs,
  SlackShortcutMiddlewareArgs,
} from "@slack/bolt";

export const EXPENSE_CLAIM_FORM_CALLBACK_ID = "expense_claim_form";

const expenseClaimCallback = async ({
  shortcut,
  ack,
  client,
  logger,
}: AllMiddlewareArgs & SlackShortcutMiddlewareArgs) => {
  try {
    const { trigger_id } = shortcut;

    await ack();
    await client.views.open({
      trigger_id,
      view: {
        type: "modal",
        callback_id: EXPENSE_CLAIM_FORM_CALLBACK_ID,
        title: {
          type: "plain_text",
          text: "Expense Claim",
        },
        submit: {
          type: "plain_text",
          text: "Submit",
        },
        close: {
          type: "plain_text",
          text: "Cancel",
        },
        blocks: [
          {
            type: "input",
            block_id: "claim_title",
            label: { type: "plain_text", text: "Claim Title" },
            element: {
              type: "plain_text_input",
              action_id: "value",
              placeholder: {
                type: "plain_text",
                text: "Brief title for the expense",
              },
            },
          },
          {
            type: "input",
            block_id: "claim_description",
            label: { type: "plain_text", text: "Claim Description" },
            element: {
              type: "plain_text_input",
              action_id: "value",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "Detailed description of the expense",
              },
            },
          },
                   {
            type: "input",
            block_id: "currency",
            label: { type: "plain_text", text: "Currency" },
            element: {
              type: "static_select",
              action_id: "value",
              options: ["CNY", "USD", "AED"].map((opt) => ({
                text: { type: "plain_text" as const, text: opt },
                value: opt,
              })),
            },
          },
          {
            type: "input",
            block_id: "amount",
            label: { type: "plain_text", text: "Amount" },
            element: {
              type: "number_input",
              action_id: "value",
              is_decimal_allowed: true,
              placeholder: {
                type: "plain_text",
                text: "0.00",
              },
            },
          },
          {
            type: "input",
            block_id: "expense_type",
            label: { type: "plain_text", text: "Expense Type" },
            element: {
              type: "static_select",
              action_id: "value",
              options: [
                "Travel",
                "Office Supplies",
                "Entertainment",
                "Training",
                "Meals",
                "Equipment",
                "Other",
              ].map((opt) => ({
                text: { type: "plain_text" as const, text: opt },
                value: opt,
              })),
            },
          },
          {
            type: "input",
            block_id: "invoice_attachment",
            label: { type: "plain_text", text: "Attachments" },
            element: {
              type: "file_input",
              action_id: "value",
              max_files: 5,
            },
            optional: true,
          },
        ],
      },
    });
  } catch (error) {
    logger.error("Expense claim shortcut handler failed:", error);
  }
};

export default expenseClaimCallback;
