import { tool } from "ai";
import { z } from "zod";
import type { SlackAgentContextInput } from "~/lib/ai/context";
import { formatFeedbackList } from "~/lib/skills/shared/formatters";
import { resolveNotionUserId } from "~/lib/slack/user-resolver";

export const submitFeedback = tool({
  description:
    "Submit a feedback entry (bug report, feature request, or general feedback) to Notion. You MUST call this tool immediately when the user confirms the feedback details. Do NOT respond with text only — invoke this tool. After submission, the feedback is sent to #feedback channel and the user gets a Notion link.",
  inputSchema: z.object({
    name: z.string().describe("Short title summarizing the feedback"),
    type: z
      .enum(["Bug", "Feature Request", "Improvement", "Question", "Other"])
      .describe("Feedback type inferred from the user's description"),
    description: z
      .string()
      .describe("Detailed description of the feedback, in the user's words"),
    priority: z
      .enum(["P0", "P1", "P2", "P3"])
      .describe(
        "Priority level: P0=critical/blocker, P1=urgent/customer-reported, P2=normal, P3=low/nice-to-have",
      ),
    source: z
      .enum(["Internal", "Customer", "Partner"])
      .describe("Where the feedback originated"),
    customer: z
      .string()
      .optional()
      .describe("Customer name if feedback is from a customer"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Relevant tags for categorization"),
  }),
  execute: async (
    { name, type, description, priority, source, customer, tags },
    { experimental_context },
  ) => {
    "use step";

    const { createFeedback } = await import("~/lib/notion/feedback");
    const { WebClient } = await import("@slack/web-api");

    const ctx = experimental_context as SlackAgentContextInput;

    try {
      const createdByNotionUserId = await resolveNotionUserId(
        ctx.token,
        ctx.user_id,
      );

      const page = await createFeedback({
        name,
        type,
        description,
        summary: "",
        priority,
        source,
        customer: customer ?? "",
        assignedToNotionUserId: null,
        createdByNotionUserId,
        dueDate: null,
        tags: tags ?? [],
        attachments: [],
      });

      const pageUrl = (page as { url: string }).url;

      const notificationChannel = process.env.SLACK_FEEDBACK_CHANNEL_ID;
      if (notificationChannel) {
        const client = new WebClient(ctx.token);
        const fields = [
          `*Name:* ${name}`,
          `*Type:* ${type}`,
          `*Priority:* ${priority}`,
          `*Source:* ${source}`,
          `*Submitted By:* <@${ctx.user_id}>`,
          `*Notion:* <${pageUrl}|View in Notion>`,
        ];
        if (customer) fields.push(`*Customer:* ${customer}`);
        if (description) fields.push(`*Description:* ${description}`);
        if (tags && tags.length > 0) fields.push(`*Tags:* ${tags.join(", ")}`);

        await client.chat.postMessage({
          channel: notificationChannel,
          text: `New feedback: ${name}`,
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "New Feedback" },
            },
            {
              type: "section",
              text: { type: "mrkdwn", text: fields.join("\n") },
            },
          ],
        });
      }

      return {
        success: true,
        message: `Feedback "${name}" has been saved to Notion.`,
        pageUrl,
      };
    } catch (error) {
      console.error("Failed to create feedback:", error);
      return {
        success: false,
        message: "Failed to save feedback to Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const queryMyTasks = tool({
  description:
    "Query the current user's assigned feedback items (bugs, feature requests, tasks) from Notion. Use this when the user asks about their tasks, assignments, or work items. Examples: 'what are my tasks', 'show my assignments', 'what's on my plate'.",
  inputSchema: z.object({
    type: z
      .string()
      .optional()
      .describe("Filter by feedback type, e.g. Bug, Feature Request"),
    priority: z
      .string()
      .optional()
      .describe("Filter by priority, e.g. P0, P1, P2, P3"),
  }),
  execute: async ({ type, priority }, { experimental_context }) => {
    "use step";

    const { queryFeedback } = await import("~/lib/notion/query");
    const ctx = experimental_context as SlackAgentContextInput;

    try {
      const notionUserId = await resolveNotionUserId(ctx.token, ctx.user_id);
      if (!notionUserId) {
        return {
          success: false,
          message:
            "Could not find your Notion account. Make sure your Slack email matches your Notion email.",
        };
      }

      const items = await queryFeedback({
        assigneeNotionUserId: notionUserId,
        type: type || undefined,
        priority: priority || undefined,
      });

      return {
        success: true,
        count: items.length,
        message:
          items.length > 0
            ? `Found ${items.length} task(s) assigned to you.`
            : "You have no tasks assigned.",
        formatted: formatFeedbackList(items),
        items,
      };
    } catch (error) {
      console.error("Failed to query tasks:", error);
      return {
        success: false,
        message: "Failed to query tasks from Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const queryProjectStatus = tool({
  description:
    "Query project status from the feedback Notion database. Use this when the user asks about project progress, feedback stats, or overall feedback status. Examples: 'how is project X going', 'show me all P0 bugs', 'how many open bugs do we have'.",
  inputSchema: z.object({
    filters: z
      .object({
        type: z.string().optional().describe("Feedback type filter"),
        priority: z.string().optional().describe("Priority filter"),
        source: z.string().optional().describe("Source filter"),
      })
      .optional()
      .describe("Optional filters to narrow results"),
  }),
  execute: async ({ filters }, { experimental_context: _ctx }) => {
    "use step";

    const { queryFeedback } = await import("~/lib/notion/query");

    try {
      const items = await queryFeedback({
        type: filters?.type || undefined,
        priority: filters?.priority || undefined,
        source: filters?.source || undefined,
      });
      return {
        success: true,
        database: "feedback",
        count: items.length,
        formatted: formatFeedbackList(items),
        items,
      };
    } catch (error) {
      console.error("Failed to query project status:", error);
      return {
        success: false,
        message: "Failed to query project status from Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const queryPendingItems = tool({
  description:
    'Query pending/unprocessed feedback items from Notion. Use this when the user asks about unprocessed feedback. Examples: "反馈未处理", "pending feedback", "unprocessed feedback".',
  inputSchema: z.object({}),
  execute: async (_input, { experimental_context: _ctx }) => {
    "use step";

    const { queryFeedback } = await import("~/lib/notion/query");

    try {
      const items = await queryFeedback({ status: "Pending" });
      return {
        success: true,
        category: "pending_feedback",
        count: items.length,
        message:
          items.length > 0
            ? `Found ${items.length} feedback item(s) pending processing.`
            : "No feedback items pending processing.",
        formatted: formatFeedbackList(items),
        items,
      };
    } catch (error) {
      console.error("Failed to query pending items:", error);
      return {
        success: false,
        message: "Failed to query pending items from Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const feedbackTools = {
  submitFeedback,
  queryMyTasks,
  queryProjectStatus,
  queryPendingItems,
};
