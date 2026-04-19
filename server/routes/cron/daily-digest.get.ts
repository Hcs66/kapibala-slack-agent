import type { KnownBlock } from "@slack/web-api";
import type { DailyDigest, PendingCategory } from "~/lib/notion/aggregation";
import { getDailyDigest, getUserPendingItems } from "~/lib/notion/aggregation";
import type { WorkflowEntity } from "~/lib/workflow-engine/types";

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

const CATEGORY_LABEL: Record<PendingCategory, string> = {
  expense_approval: "🔴 Pending Approval",
  expense_payment: "🟡 Awaiting Payment",
  recruitment: "👤 Recruitment",
  feedback: "💬 Feedback",
  task: "📋 Tasks",
};

function buildPersonalPendingBlocks(
  items: WorkflowEntity[],
  countByCategory: Record<PendingCategory, number>,
): KnownBlock[] {
  if (items.length === 0) return [];

  const summaryParts: string[] = [];
  for (const [cat, count] of Object.entries(countByCategory)) {
    if (count > 0) {
      const label = CATEGORY_LABEL[cat as PendingCategory] ?? cat;
      summaryParts.push(`${label}: ${count}`);
    }
  }

  const itemLines = items.slice(0, 15).map((item) => {
    const parts = [`• <${item.notionPageUrl}|${item.title}>`];
    if (item.priority) parts.push(`_${item.priority}_`);
    if (item.dueDate) {
      const isOverdue = item.dueDate < new Date().toISOString().split("T")[0];
      parts.push(isOverdue ? `⚠️ Due: ${item.dueDate}` : `Due: ${item.dueDate}`);
    }
    return parts.join("  ·  ");
  });

  const overflow =
    items.length > 15 ? `\n_...and ${items.length - 15} more_` : "";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Your pending items (${items.length}):*\n${summaryParts.join("\n")}\n\n${itemLines.join("\n")}${overflow}`,
      },
    },
  ];
}

async function sendPersonalDigests(
  client: import("@slack/web-api").WebClient,
): Promise<number> {
  const { getAllNotionPersonUsers } = await import("~/lib/notion/user-map");

  const notionUsers = await getAllNotionPersonUsers();
  let dmsSent = 0;

  for (const { notionUserId, email } of notionUsers) {
    try {
      const result = await getUserPendingItems(notionUserId);
      if (result.total === 0) continue;

      const slackUser = await client.users.lookupByEmail({ email });
      const slackUserId = slackUser.user?.id;
      if (!slackUserId) continue;

      const blocks: KnownBlock[] = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📋 Your Daily Pending Summary",
            emoji: true,
          },
        },
        ...buildPersonalPendingBlocks(result.items, result.countByCategory),
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
        channel: slackUserId,
        blocks,
        text: `You have ${result.total} pending item(s) today.`,
      });
      dmsSent++;
    } catch (error) {
      console.warn(
        `Failed to send personal digest to ${email}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return dmsSent;
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

    const dmsSent = await sendPersonalDigests(client);

    return { success: true, totalItems, dmsSent };
  } catch (error) {
    console.error("Daily digest failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
