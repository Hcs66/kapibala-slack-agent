import type { AllMiddlewareArgs, SlackViewMiddlewareArgs } from "@slack/bolt";
import type { FeedbackAttachment } from "~/lib/notion/feedback";
import { createFeedback } from "~/lib/notion/feedback";
import { uploadFileToNotion } from "~/lib/notion/file-upload";
import { findNotionUser } from "~/lib/notion/user-map";
import { downloadSlackFile, getSlackFileInfo } from "~/lib/slack/files";

async function resolveNotionUserId(
  client: AllMiddlewareArgs["client"],
  slackUserId: string,
): Promise<string | null> {
  try {
    const userInfo = await client.users.info({ user: slackUserId });
    const email = userInfo.user?.profile?.email;
    if (!email) return null;
    return await findNotionUser(email);
  } catch (error) {
    console.warn("Failed to resolve Notion user for", slackUserId, error);
    return null;
  }
}

const feedbackFormCallback = async ({
  ack,
  view,
  body,
  client,
  logger,
}: AllMiddlewareArgs & SlackViewMiddlewareArgs) => {
  try {
    await ack();

    const values = view.state.values;
    const name = values.name.value.value ?? "";
    const type = values.type.value.selected_option?.value ?? "";
    const description = values.description.value.value ?? "";
    const summary = "";
    const priority =  "";
    const source = values.source.value.selected_option?.value ?? "";
    const customer = values.customer.value.value ?? "";
    const assignedToSlackId = "";
    const dueDate = "";
    const tags =
      values.tags.value.selected_options?.map(
        (opt: { value: string }) => opt.value,
      ) ?? [];

    // Handle file attachments: Slack → download → Notion upload
    const attachments: FeedbackAttachment[] = [];
    const slackFiles =
      (values.attachments?.value as unknown as { files?: { id: string }[] })
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
        attachments.push({
          fileUploadId: result.fileUploadId,
          filename: result.filename,
        });
      }
    }

    const createdByNotionUserId = await resolveNotionUserId(
      client,
      body.user.id,
    );

    let assignedToNotionUserId: string | null = null;
    if (assignedToSlackId) {
      assignedToNotionUserId = await resolveNotionUserId(
        client,
        assignedToSlackId,
      );
    }

    const page = await createFeedback({
      name,
      type,
      description,
      summary,
      priority,
      source,
      customer,
      assignedToNotionUserId,
      createdByNotionUserId,
      dueDate: dueDate ?? null,
      tags,
      attachments,
    });

    await client.chat.postMessage({
      channel: body.user.id,
      text: `Feedback saved: ${(page as { url: string }).url}`,
    });
  } catch (error) {
    logger.error("Feedback form submission failed:", error);
    try {
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: "Sorry, something went wrong saving your feedback.",
      });
    } catch (notifyError) {
      logger.error("Also failed to notify user of error:", notifyError);
    }
  }
};

export default feedbackFormCallback;
