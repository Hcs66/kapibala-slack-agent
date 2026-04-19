import type { KnownBlock } from "@slack/web-api";
import type {
  AlertDigest,
  OverdueExpense,
  OverdueFeedback,
  OverdueRecruitment,
} from "~/lib/notion/alerts";
import { getAlertDigest } from "~/lib/notion/alerts";

function buildExpenseAlertSection(expenses: OverdueExpense[]): KnownBlock[] {
  if (expenses.length === 0) return [];

  const pending = expenses.filter((e) => e.alertReason === "pending_approval");
  const payment = expenses.filter((e) => e.alertReason === "pending_payment");
  const sections: KnownBlock[] = [];

  if (pending.length > 0) {
    const lines = pending.map((e) => {
      const amount = e.amount !== null ? `${e.amount}` : "N/A";
      const submitter =
        e.submittedBy.length > 0
          ? (e.submittedBy[0].name ?? "Unknown")
          : "Unknown";
      return `• <${e.url}|${e.claimTitle}> — ${amount} (${submitter}) — *${e.daysOverdue} days*`;
    });
    sections.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🔴 *Expense: Pending Approval >3 Days* (${pending.length})\n${lines.join("\n")}`,
      },
    });
  }

  if (payment.length > 0) {
    const lines = payment.map((e) => {
      const amount = e.amount !== null ? `${e.amount}` : "N/A";
      const submitter =
        e.submittedBy.length > 0
          ? (e.submittedBy[0].name ?? "Unknown")
          : "Unknown";
      return `• <${e.url}|${e.claimTitle}> — ${amount} (${submitter}) — *${e.daysOverdue} days*`;
    });
    sections.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🟡 *Expense: Awaiting Payment >3 Days* (${payment.length})\n${lines.join("\n")}`,
      },
    });
  }

  return sections;
}

function buildRecruitmentAlertSection(
  candidates: OverdueRecruitment[],
): KnownBlock[] {
  if (candidates.length === 0) return [];

  const lines = candidates.map((r) => {
    const position = r.positionApplied ?? "N/A";
    return `• <${r.url}|${r.candidateName}> — ${position} — *${r.daysOverdue} days*`;
  });

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `👤 *Recruitment: Pending Review >3 Days* (${candidates.length})\n${lines.join("\n")}`,
      },
    },
  ];
}

function buildFeedbackAlertSection(feedback: OverdueFeedback[]): KnownBlock[] {
  if (feedback.length === 0) return [];

  const lines = feedback.map((f) => {
    const type = f.type ?? "General";
    return `• <${f.url}|${f.name}> — ${type}${f.customer ? ` (${f.customer})` : ""} — *${f.daysOverdue} days*`;
  });

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `💬 *Feedback: Pending >3 Days* (${feedback.length})\n${lines.join("\n")}`,
      },
    },
  ];
}

export function buildAlertBlocks(digest: AlertDigest): KnownBlock[] {
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "⚠️ Overdue Alerts",
        emoji: true,
      },
    },
    ...buildExpenseAlertSection(digest.overdueExpenses),
    ...buildRecruitmentAlertSection(digest.overdueRecruitment),
    ...buildFeedbackAlertSection(digest.overdueFeedback),
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

    const digest = await getAlertDigest();

    if (digest.totalAlerts === 0) {
      return { success: true, totalAlerts: 0, message: "No overdue items" };
    }

    const blocks = buildAlertBlocks(digest);

    await client.chat.postMessage({
      channel: channelId,
      blocks,
      text: `⚠️ Overdue Alerts: ${digest.totalAlerts} items need attention`,
    });

    return { success: true, totalAlerts: digest.totalAlerts };
  } catch (error) {
    console.error("Alerts cron failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
