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
    const currentStatus =
      values.current_status.value.selected_option?.value ?? "";
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
      currentStatus,
      resumeSource,
      phone,
      email,
      interviewTime: interviewTime ?? null,
      zoomMeetingLink,
      resumeLink,
      resumeAttachments,
    });

    await client.chat.postMessage({
      channel: body.user.id,
      text: `Candidate saved: ${(page as { url: string }).url}`,
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
