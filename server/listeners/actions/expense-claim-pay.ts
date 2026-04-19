import type {
  AllMiddlewareArgs,
  BlockAction,
  ButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";

interface ExpenseClaimPayValue {
  pageId: string;
  pageUrl: string;
  claimTitle: string;
  amount: number;
  expenseType: string;
  submitterId: string;
  reviewedBy: string;
}

export const expenseClaimPayCallback = async ({
  ack,
  action,
  body,
  client,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();

  const buttonAction = action as ButtonAction;
  const value: ExpenseClaimPayValue = JSON.parse(buttonAction.value);

  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      type: "modal",
      callback_id: "expense_claim_pay_modal",
      private_metadata: JSON.stringify({
        pageId: value.pageId,
        pageUrl: value.pageUrl,
        claimTitle: value.claimTitle,
        amount: value.amount,
        expenseType: value.expenseType,
        submitterId: value.submitterId,
        reviewedBy: value.reviewedBy,
      }),
      title: {
        type: "plain_text",
        text: "Process Payment",
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
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Claim:* ${value.claimTitle}\n*Amount:* $${value.amount}`,
          },
        },
        {
          type: "input",
          block_id: "payment_method",
          label: {
            type: "plain_text",
            text: "Payment Method",
          },
          element: {
            type: "static_select",
            action_id: "value",
            placeholder: {
              type: "plain_text",
              text: "Select payment method",
            },
            options: [
              {
                text: { type: "plain_text", text: "Bank Transfer" },
                value: "Bank Transfer",
              },
              {
                text: { type: "plain_text", text: "Cash" },
                value: "Cash",
              },
              {
                text: { type: "plain_text", text: "Paynow" },
                value: "Paynow",
              },
              {
                text: { type: "plain_text", text: "OKX Transfer" },
                value: "OKX Transfer",
              },
              {
                text: { type: "plain_text", text: "Other" },
                value: "Other",
              },
            ],
          },
        },
        {
          type: "input",
          block_id: "payment_date",
          label: {
            type: "plain_text",
            text: "Payment Date",
          },
          element: {
            type: "datepicker",
            action_id: "value",
            initial_date: new Date().toISOString().split("T")[0],
            placeholder: {
              type: "plain_text",
              text: "Select date",
            },
          },
        },
      ],
    },
  });
};
