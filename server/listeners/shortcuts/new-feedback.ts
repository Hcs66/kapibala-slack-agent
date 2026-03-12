import type {
  AllMiddlewareArgs,
  SlackShortcutMiddlewareArgs,
} from "@slack/bolt";

export const FEEDBACK_FORM_CALLBACK_ID = "feedback_form";

const newFeedbackCallback = async ({
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
        callback_id: FEEDBACK_FORM_CALLBACK_ID,
        title: {
          type: "plain_text",
          text: "New Feedback",
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
            block_id: "name",
            label: { type: "plain_text", text: "Name" },
            element: {
              type: "plain_text_input",
              action_id: "value",
              placeholder: {
                type: "plain_text",
                text: "Feedback title",
              },
            },
          },
          {
            type: "input",
            block_id: "type",
            label: { type: "plain_text", text: "Type" },
            element: {
              type: "static_select",
              action_id: "value",
              options: [
                "Feature Request",
                "Enhancement",
                "Bug Fix",
                "Consultation",
                "Documentation",
                "Performance",
                "Security",
              ].map((opt) => ({
                text: { type: "plain_text" as const, text: opt },
                value: opt,
              })),
            },
          },
          {
            type: "input",
            block_id: "description",
            label: { type: "plain_text", text: "Description" },
            element: {
              type: "plain_text_input",
              action_id: "value",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "Detailed description of the feedback",
              },
            },
          },
          {
            type: "input",
            block_id: "summary",
            label: { type: "plain_text", text: "Summary" },
            element: {
              type: "plain_text_input",
              action_id: "value",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "Brief summary",
              },
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "priority",
            label: { type: "plain_text", text: "Priority" },
            element: {
              type: "static_select",
              action_id: "value",
              options: ["High", "Medium", "Low"].map((opt) => ({
                text: { type: "plain_text" as const, text: opt },
                value: opt,
              })),
            },
          },
          {
            type: "input",
            block_id: "source",
            label: { type: "plain_text", text: "Source" },
            element: {
              type: "static_select",
              action_id: "value",
              options: [
                "Customer Feedback",
                "Internal Proposal",
                "Market Research",
                "Competitive Analysis",
                "User Testing",
                "Support Tickets",
                "Stakeholder Request",
              ].map((opt) => ({
                text: { type: "plain_text" as const, text: opt },
                value: opt,
              })),
            },
          },
          {
            type: "input",
            block_id: "customer",
            label: { type: "plain_text", text: "Customer" },
            element: {
              type: "plain_text_input",
              action_id: "value",
              placeholder: {
                type: "plain_text",
                text: "Customer name",
              },
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "assigned_to",
            label: { type: "plain_text", text: "Assigned To" },
            element: {
              type: "users_select",
              action_id: "value",
              placeholder: {
                type: "plain_text",
                text: "Select a user",
              },
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "due_date",
            label: { type: "plain_text", text: "Due Date" },
            element: {
              type: "datepicker",
              action_id: "value",
              placeholder: {
                type: "plain_text",
                text: "Select a date",
              },
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "tags",
            label: { type: "plain_text", text: "Tags" },
            element: {
              type: "multi_static_select",
              action_id: "value",
              options: [
                "Urgent",
                "Key Customer",
                "Technical Debt",
                "Quick Win",
                "Strategic",
                "Compliance",
                "Performance",
                "Security",
                "UX",
                "Integration",
              ].map((opt) => ({
                text: { type: "plain_text" as const, text: opt },
                value: opt,
              })),
            },
            optional: true,
          },
        ],
      },
    });
  } catch (error) {
    logger.error("New feedback shortcut handler failed:", error);
  }
};

export default newFeedbackCallback;
