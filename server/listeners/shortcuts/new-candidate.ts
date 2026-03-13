import type {
  AllMiddlewareArgs,
  SlackShortcutMiddlewareArgs,
} from "@slack/bolt";

export const CANDIDATE_FORM_CALLBACK_ID = "candidate_form";

const newCandidateCallback = async ({
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
        callback_id: CANDIDATE_FORM_CALLBACK_ID,
        title: {
          type: "plain_text",
          text: "New Candidate",
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
            block_id: "candidate_name",
            label: { type: "plain_text", text: "Candidate Name" },
            element: {
              type: "plain_text_input",
              action_id: "value",
              placeholder: {
                type: "plain_text",
                text: "Full name of the candidate",
              },
            },
          },
          {
            type: "input",
            block_id: "position_applied",
            label: { type: "plain_text", text: "Position Applied" },
            element: {
              type: "static_select",
              action_id: "value",
              options: [
                "AI Post-Training Engineer",
                "AI Product Engineer / Full-Stack",
                "International Business Development",
                "Software Engineer",
                "Product Manager",
                "UX Designer",
                "HR Specialist",
              ].map((opt) => ({
                text: { type: "plain_text" as const, text: opt },
                value: opt,
              })),
            },
          },
          {
            type: "input",
            block_id: "resume_link",
            label: { type: "plain_text", text: "Resume Link" },
            element: {
              type: "url_text_input",
              action_id: "value",
              placeholder: {
                type: "plain_text",
                text: "https://.../resume.pdf",
              },
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "resume",
            label: { type: "plain_text", text: "Resume" },
            element: {
              type: "file_input",
              action_id: "value",
              max_files: 1,
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "resume_source",
            label: { type: "plain_text", text: "Resume Source" },
            element: {
              type: "static_select",
              action_id: "value",
              options: [
                "LinkedIn",
                "Xiaohongshu",
                "Email",
                "Liepin",
                "Other",
              ].map((opt) => ({
                text: { type: "plain_text" as const, text: opt },
                value: opt,
              })),
            },
          },
          {
            type: "input",
            block_id: "phone",
            label: { type: "plain_text", text: "Phone" },
            element: {
              type: "plain_text_input",
              action_id: "value",
              placeholder: {
                type: "plain_text",
                text: "Phone number",
              },
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "email",
            label: { type: "plain_text", text: "Email" },
            element: {
              type: "email_text_input",
              action_id: "value",
              placeholder: {
                type: "plain_text",
                text: "email@example.com",
              },
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "interview_time",
            label: { type: "plain_text", text: "Interview Time" },
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
            block_id: "zoom_meeting_link",
            label: { type: "plain_text", text: "Zoom Meeting Link" },
            element: {
              type: "url_text_input",
              action_id: "value",
              placeholder: {
                type: "plain_text",
                text: "https://zoom.us/j/...",
              },
            },
            optional: true,
          },
        ],
      },
    });
  } catch (error) {
    logger.error("New candidate shortcut handler failed:", error);
  }
};

export default newCandidateCallback;
