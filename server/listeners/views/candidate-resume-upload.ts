import type { AllMiddlewareArgs, SlackViewMiddlewareArgs } from "@slack/bolt";
import { uploadFileToNotion } from "~/lib/notion/file-upload";
import type { RecruitmentAttachment } from "~/lib/notion/recruitment";
import { updateCandidateResume } from "~/lib/notion/recruitment";
import { downloadSlackFile, getSlackFileInfo } from "~/lib/slack/files";

interface ResumeUploadMetadata {
  pageId: string;
  pageUrl: string;
  candidateName: string;
  channelId?: string;
  messageTs?: string;
}

const candidateResumeUploadViewCallback = async ({
  ack,
  view,
  body,
  client,
  logger,
}: AllMiddlewareArgs & SlackViewMiddlewareArgs) => {
  try {
    await ack();

    const metadata: ResumeUploadMetadata = JSON.parse(view.private_metadata);
    const { pageId, pageUrl, candidateName, channelId, messageTs } = metadata;

    const slackFiles =
      (
        view.state.values.resume?.value as unknown as {
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

    const attachments: RecruitmentAttachment[] = [];
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

    await updateCandidateResume(pageId, attachments);

    if (channelId && messageTs) {
      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `✅ 候选人 *${candidateName}* 的简历已上传至 Notion。\n<${pageUrl}|在 Notion 中查看>`,
            },
          },
        ],
        text: `Resume uploaded for ${candidateName}`,
      });
    }

    await client.chat.postMessage({
      channel: body.user.id,
      text: `✅ 简历已成功上传至候选人 *${candidateName}* 的 Notion 页面。\n<${pageUrl}|在 Notion 中查看>`,
    });
  } catch (error) {
    logger.error("Resume upload view submission failed:", error);
    try {
      await client.chat.postMessage({
        channel: body.user.id,
        text: "Sorry, something went wrong uploading the resume. Please try again.",
      });
    } catch (notifyError) {
      logger.error("Also failed to notify user of error:", notifyError);
    }
  }
};

export default candidateResumeUploadViewCallback;
