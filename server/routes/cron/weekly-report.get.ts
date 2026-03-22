import type { KnownBlock } from "@slack/web-api";
import { getWeeklyStats } from "~/lib/notion/aggregation";

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, "authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    setResponseStatus(event, 401);
    return { error: "Unauthorized" };
  }

  try {
    const { WebClient } = await import("@slack/web-api");
    const client = new WebClient(process.env.SLACK_BOT_TOKEN);
    const channelId = process.env.SLACK_DASHBOARD_CHANNEL_ID;

    if (!channelId) {
      throw new Error("SLACK_DASHBOARD_CHANNEL_ID is not configured");
    }

    const stats = await getWeeklyStats();

    const blocks: KnownBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📊 Weekly Report",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*This Week's Summary*\n\n• *Feedback:* ${stats.feedbackCount} new items\n• *Expense Claims:* ${stats.expenseCount} submitted\n• *Recruitment:* ${stats.recruitmentCount} candidates`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Generated on ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
          },
        ],
      },
    ];

    await client.chat.postMessage({
      channel: channelId,
      blocks,
      text: `Weekly Report: ${stats.feedbackCount} feedback, ${stats.expenseCount} expenses, ${stats.recruitmentCount} candidates`,
    });

    return { success: true, stats };
  } catch (error) {
    console.error("Weekly report failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
