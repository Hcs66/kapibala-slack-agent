import type {
  AllMiddlewareArgs,
  BlockAction,
  ButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";

export const CANDIDATE_RESUME_UPLOAD_VIEW_CALLBACK_ID =
  "candidate_resume_upload_view";

interface CandidateResumeUploadValue {
  pageId: string;
  pageUrl: string;
  candidateName: string;
}

export const candidateResumeUploadCallback = async ({
  ack,
  action,
  body,
  client,
  logger,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();

  const buttonAction = action as ButtonAction;
  const value: CandidateResumeUploadValue = JSON.parse(buttonAction.value);

  const triggerId = body.trigger_id;
  if (!triggerId) return;

  try {
    await client.views.open({
      trigger_id: triggerId,
      view: {
        type: "modal",
        callback_id: CANDIDATE_RESUME_UPLOAD_VIEW_CALLBACK_ID,
        private_metadata: JSON.stringify({
          pageId: value.pageId,
          pageUrl: value.pageUrl,
          candidateName: value.candidateName,
          channelId: body.channel?.id,
          messageTs: body.message?.ts,
        }),
        title: {
          type: "plain_text",
          text: "Upload Resume",
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
              text: `Upload resume for *${value.candidateName}*`,
            },
          },
          {
            type: "input",
            block_id: "resume",
            label: { type: "plain_text", text: "Resume File" },
            element: {
              type: "file_input",
              action_id: "value",
              max_files: 1,
            },
          },
        ],
      },
    });
  } catch (error) {
    logger.error("Failed to open resume upload modal:", error);
  }
};
