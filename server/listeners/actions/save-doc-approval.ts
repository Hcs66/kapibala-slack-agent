import type {
  AllMiddlewareArgs,
  BlockAction,
  ButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { saveDocApprovalHook } from "~/lib/ai/workflows/hooks";

interface SaveDocApprovalValue {
  toolCallId: string;
  approved: boolean;
}

export const saveDocApprovalCallback = async ({
  ack,
  action,
  body,
  client,
  logger,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockAction>) => {
  await ack();

  const buttonAction = action as ButtonAction;
  const value: SaveDocApprovalValue = JSON.parse(buttonAction.value);
  const { toolCallId, approved } = value;

  logger.info(
    `Save doc ${approved ? "approved" : "cancelled"} (toolCallId: ${toolCallId})`,
  );

  await saveDocApprovalHook.resume(toolCallId, { approved });

  const statusEmoji = approved ? "✅" : "❌";
  const statusText = approved ? "Saving to Notion..." : "Cancelled";

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
