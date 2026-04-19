import { tool } from "ai";
import { z } from "zod";
import type { SlackAgentContextInput } from "~/lib/ai/context";
import { formatPendingEntityList } from "~/lib/skills/shared/formatters";
import { resolveNotionUserId } from "~/lib/slack/user-resolver";

const CATEGORY_LABELS: Record<string, string> = {
  expense_approval: "Expense (Pending Approval)",
  expense_payment: "Expense (Awaiting Payment)",
  recruitment: "Recruitment",
  feedback: "Feedback",
  task: "Task",
};

export const getMyPendingItems = tool({
  description:
    "Get all pending items for the current user across all modules (expenses, recruitment, feedback, tasks). Use this when the user asks what they need to do, what's pending, or what's on their plate.",
  inputSchema: z.object({
    includeCategories: z
      .array(
        z.enum([
          "expense_approval",
          "expense_payment",
          "recruitment",
          "feedback",
          "task",
        ]),
      )
      .optional()
      .describe(
        "Filter to specific categories. Omit to return all pending items.",
      ),
  }),
  execute: async ({ includeCategories }, { experimental_context }) => {
    "use step";

    const { getUserPendingItems } = await import("~/lib/notion/aggregation");
    const ctx = experimental_context as SlackAgentContextInput;

    try {
      const notionUserId = await resolveNotionUserId(ctx.token, ctx.user_id);

      const result = await getUserPendingItems(
        notionUserId,
        includeCategories ?? undefined,
      );

      const summaryParts: string[] = [];
      for (const [cat, count] of Object.entries(result.countByCategory)) {
        if (count > 0) {
          const label = CATEGORY_LABELS[cat] ?? cat;
          summaryParts.push(`${label}: ${count}`);
        }
      }

      return {
        success: true,
        total: result.total,
        message:
          result.total > 0
            ? `You have ${result.total} pending item(s).`
            : "You have no pending items. All clear!",
        summary: summaryParts.join(", "),
        formatted: formatPendingEntityList(result.items),
        countByCategory: result.countByCategory,
        items: result.items,
      };
    } catch (error) {
      console.error("Failed to query pending items:", error);
      return {
        success: false,
        message: "Failed to query pending items",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const pendingCenterTools = {
  getMyPendingItems,
};
