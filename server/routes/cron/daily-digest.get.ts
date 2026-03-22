import type { KnownBlock } from "@slack/web-api";
import type { DailyDigest } from "~/lib/notion/aggregation";
import { getDailyDigest } from "~/lib/notion/aggregation";

function buildExpenseSection(
  title: string,
  emoji: string,
  expenses: DailyDigest["pendingExpenses"],
): KnownBlock[] {
  if (expenses.length === 0) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *${title}*\n_None_`,
        },
      },
    ];
  }

  const lines = expenses.map((e) => {
    const amount =
      e.amount !== null ? `${e.amount} ${e.currency ?? ""}`.trim() : "N/A";
    const submitter =
      e.submittedBy.length > 0
        ? (e.submittedBy[0].name ?? "Unknown")
        : "Unknown";
    return `• <${e.url}|${e.claimTitle}> — ${amount} (${submitter})`;
  });

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *${title}* (${expenses.length})\n${lines.join("\n")}`,
      },
    },
  ];
}

function buildRecruitmentSection(digest: DailyDigest): KnownBlock[] {
  if (digest.pendingRecruitment.length === 0) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "👤 *Pending Recruitment*\n_None_",
        },
      },
    ];
  }

  const lines = digest.pendingRecruitment.map((r) => {
    const position = r.positionApplied ?? "N/A";
    return `• <${r.url}|${r.candidateName}> — ${position}`;
  });

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `👤 *Pending Recruitment* (${digest.pendingRecruitment.length})\n${lines.join("\n")}`,
      },
    },
  ];
}

function buildFeedbackSection(digest: DailyDigest): KnownBlock[] {
  if (digest.pendingFeedback.length === 0) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "💬 *Pending Feedback*\n_None_",
        },
      },
    ];
  }

  const lines = digest.pendingFeedback.map((f) => {
    const type = f.type ?? "General";
    return `• <${f.url}|${f.name}> — ${type}${f.customer ? ` (${f.customer})` : ""}`;
  });

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `💬 *Pending Feedback* (${digest.pendingFeedback.length})\n${lines.join("\n")}`,
      },
    },
  ];
}

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

    const digest = await getDailyDigest();

    const totalItems =
      digest.pendingExpenses.length +
      digest.approvedExpenses.length +
      digest.pendingRecruitment.length +
      digest.pendingFeedback.length;

    const blocks: KnownBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📋 Daily Digest",
          emoji: true,
        },
      },
      ...buildExpenseSection("Pending Approval", "🔴", digest.pendingExpenses),
      ...buildExpenseSection("Awaiting Payment", "🟡", digest.approvedExpenses),
      ...buildRecruitmentSection(digest),
      ...buildFeedbackSection(digest),
      { type: "divider" },
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
      text: `Daily Digest: ${totalItems} items need attention`,
    });

    return { success: true, totalItems };
  } catch (error) {
    console.error("Daily digest failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
