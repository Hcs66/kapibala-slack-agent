import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import type { KnownBlock } from "@slack/web-api";
import type {
  PendingCategory,
  UserPendingResult,
} from "~/lib/notion/aggregation";
import type { WorkflowEntity } from "~/lib/workflow-engine/types";

const CATEGORY_EMOJI: Record<PendingCategory, string> = {
  expense_approval: "🔴",
  expense_payment: "🟡",
  recruitment: "👤",
  feedback: "💬",
  task: "📋",
};

const CATEGORY_LABEL: Record<PendingCategory, string> = {
  expense_approval: "Pending Approval",
  expense_payment: "Awaiting Payment",
  recruitment: "Pending Recruitment",
  feedback: "Pending Feedback",
  task: "Tasks",
};

const STATUS_EMOJI: Record<string, string> = {
  pending: "🟡",
  in_progress: "🔵",
  approved: "✅",
};

function buildItemLine(item: WorkflowEntity): string {
  const emoji = STATUS_EMOJI[item.status] ?? "⬜";
  const parts = [`${emoji} <${item.notionPageUrl}|${item.title}>`];
  if (item.priority) parts.push(`_${item.priority}_`);
  if (item.dueDate) {
    const isOverdue = item.dueDate < new Date().toISOString().split("T")[0];
    parts.push(isOverdue ? `⚠️ Due: ${item.dueDate}` : `Due: ${item.dueDate}`);
  }
  if (item.type === "expense_claim" && item.metadata.amount != null) {
    parts.push(`$${item.metadata.amount}`);
  }
  return parts.join("  ·  ");
}

function buildCategorySection(
  category: PendingCategory,
  items: WorkflowEntity[],
): KnownBlock[] {
  const emoji = CATEGORY_EMOJI[category];
  const label = CATEGORY_LABEL[category];

  if (items.length === 0) return [];

  const lines = items.slice(0, 10).map(buildItemLine);
  const overflow =
    items.length > 10 ? `\n_...and ${items.length - 10} more_` : "\n";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *${label}* (${items.length})\n${lines.join("\n")}${overflow}`,
      },
    },
  ];
}

function groupByCategory(
  result: UserPendingResult,
): Record<PendingCategory, WorkflowEntity[]> {
  const groups: Record<PendingCategory, WorkflowEntity[]> = {
    expense_approval: [],
    expense_payment: [],
    recruitment: [],
    feedback: [],
    task: [],
  };

  for (const item of result.items) {
    if (item.type === "expense_claim") {
      if (item.status === "pending") {
        groups.expense_approval.push(item);
      } else if (item.status === "approved") {
        groups.expense_payment.push(item);
      }
    } else if (item.type === "recruitment") {
      groups.recruitment.push(item);
    } else if (item.type === "feedback") {
      groups.feedback.push(item);
    } else if (item.type === "task") {
      groups.task.push(item);
    }
  }

  return groups;
}

function buildHomeBlocks(
  userId: string,
  result: UserPendingResult,
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📋 Pending Center",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          result.total > 0
            ? `Hey <@${userId}>, you have *${result.total}* pending item(s).`
            : `Hey <@${userId}>, you're all clear! No pending items. 🎉`,
      },
    },
  ];

  if (result.total === 0) return blocks;

  blocks.push({ type: "divider" });

  const groups = groupByCategory(result);
  const categoryOrder: PendingCategory[] = [
    "expense_approval",
    "expense_payment",
    "recruitment",
    "feedback",
    "task",
  ];

  for (const cat of categoryOrder) {
    blocks.push(...buildCategorySection(cat, groups[cat]));
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Last updated: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" })}`,
      },
    ],
  });

  return blocks;
}

const appHomeOpenedCallback = async ({
  client,
  event,
  logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_home_opened">) => {
  if (event.tab !== "home") return;

  try {
    const { getUserPendingItems } = await import("~/lib/notion/aggregation");
    const { resolveNotionUserId } = await import("~/lib/slack/user-resolver");

    const token = process.env.SLACK_BOT_TOKEN ?? "";
    const notionUserId = await resolveNotionUserId(token, event.user);
    const result = await getUserPendingItems(notionUserId);

    await client.views.publish({
      user_id: event.user,
      view: {
        type: "home",
        blocks: buildHomeBlocks(event.user, result),
      },
    });
  } catch (error) {
    logger.error("app_home_opened handler failed:", error);

    await client.views.publish({
      user_id: event.user,
      view: {
        type: "home",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Welcome home, <@${event.user}> :house:*\n\n_Failed to load pending items. Please try again later._`,
            },
          },
        ],
      },
    });
  }
};

export default appHomeOpenedCallback;
