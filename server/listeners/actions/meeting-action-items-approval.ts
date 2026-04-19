import type {
  AllMiddlewareArgs,
  BlockAction,
  ButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { meetingActionItemsApprovalHook } from "~/lib/ai/workflows/hooks";

interface MeetingActionItemsApprovalValue {
  toolCallId: string;
  approved: boolean;
}

export const meetingActionItemsApprovalCallback = async ({
  ack,
  action,
  body,
  client,
  logger,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();

  const buttonAction = action as ButtonAction;
  const value: MeetingActionItemsApprovalValue = JSON.parse(buttonAction.value);
  const { toolCallId, approved } = value;

  logger.info(
    `Meeting action items ${approved ? "approved" : "skipped"} (toolCallId: ${toolCallId})`,
  );

  await meetingActionItemsApprovalHook.resume(toolCallId, { approved });

  const statusEmoji = approved ? "✅" : "⏭️";
  const statusText = approved ? "Creating tasks..." : "Skipped task creation";

  if (body.message?.ts && body.channel?.id) {
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${statusEmoji} *${statusText}*`,
          },
        },
      ],
      text: statusText,
    });
  }
};
