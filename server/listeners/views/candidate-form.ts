import type { AllMiddlewareArgs, SlackViewMiddlewareArgs } from "@slack/bolt";
import { uploadFileToNotion } from "~/lib/notion/file-upload";
import type { RecruitmentAttachment } from "~/lib/notion/recruitment";
import { createCandidate } from "~/lib/notion/recruitment";
import { downloadSlackFile, getSlackFileInfo } from "~/lib/slack/files";

const candidateFormCallback = async ({
  ack,
  view,
  body,
  client,
  logger,
}: AllMiddlewareArgs & SlackViewMiddlewareArgs) => {
  try {
    await ack();

    const values = view.state.values;

    const candidateName = values.candidate_name.value.value ?? "";
    const positionApplied =
      values.position_applied.value.selected_option?.value ?? "";
    const status = "";
    const resumeSource =
      values.resume_source.value.selected_option?.value ?? "";
    const phone = values.phone.value.value ?? "";
    const email = values.email.value.value ?? "";
    const interviewTime = values.interview_time.value.selected_date;
    const zoomMeetingLink = values.zoom_meeting_link.value.value ?? "";
    const resumeLink = values.resume_link.value.value ?? "";

    const resumeAttachments: RecruitmentAttachment[] = [];
    const slackFiles =
      (values.resume?.value as unknown as { files?: { id: string }[] })
        ?.files ?? [];
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
        resumeAttachments.push({
          fileUploadId: result.fileUploadId,
          filename: result.filename,
        });
      }
    }

    const page = await createCandidate({
      candidateName,
      positionApplied,
      status,
      resumeSource,
      phone,
      email,
      interviewTime: interviewTime ?? null,
      zoomMeetingLink,
      resumeLink,
      resumeAttachments,
    });

    const pageUrl = (page as { url: string }).url;
    const submitterId = body.user.id;

    const fields = [
      `*Candidate Name:* ${candidateName}`,
      `*Position Applied:* ${positionApplied}`,
      `*Resume Source:* ${resumeSource}`,
      `*Submitted By:* <@${submitterId}>`,
    ];
    if (phone) fields.push(`*Phone:* ${phone}`);
    if (email) fields.push(`*Email:* ${email}`);
    if (interviewTime) fields.push(`*Interview Time:* ${interviewTime}`);
    if (zoomMeetingLink) fields.push(`*Zoom Meeting Link:* ${zoomMeetingLink}`);
    if (resumeLink) fields.push(`*Resume Link:* <${resumeLink}|View Resume>`);
    fields.push(`*Notion:* <${pageUrl}|View in Notion>`);

    const notificationChannel = process.env.SLACK_RECRUITMENT_CHANNEL_ID;
    if (notificationChannel) {
      await client.chat.postMessage({
        channel: notificationChannel,
        text: `New candidate: ${candidateName}`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "New Candidate",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: fields.join("\n"),
            },
          },
        ],
      });
    }

    await client.chat.postMessage({
      channel: submitterId,
      text: `Candidate saved: ${pageUrl}`,
    });
  } catch (error) {
    logger.error("Candidate form submission failed:", error);
    try {
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: "Sorry, something went wrong saving the candidate.",
      });
    } catch (notifyError) {
      logger.error("Also failed to notify user of error:", notifyError);
    }
  }
};

export default candidateFormCallback;
