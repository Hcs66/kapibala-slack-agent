import { tool } from "ai";
import { z } from "zod";
import type { SlackAgentContextInput } from "~/lib/ai/context";
import { formatDecisionList } from "~/lib/skills/shared/formatters";
import {
  resolveNotionUserId,
  resolveSlackUserByMention,
} from "~/lib/slack/user-resolver";

const recordDecision = tool({
  description:
    "Record an organizational decision to the Notion Decisions database. You MUST extract structured fields and present them for confirmation BEFORE calling this tool. Only call after the user confirms. If follow-up actions are provided, tasks will be automatically created and linked.",
  inputSchema: z.object({
    title: z.string().describe("Short title summarizing the decision"),
    content: z.string().describe("The decision itself — what was decided"),
    reason: z
      .string()
      .describe("Why this decision was made (rationale, tradeoffs)"),
    category: z
      .enum(["Strategic", "Operational", "Technical", "Financial", "HR"])
      .describe("Decision category"),
    priority: z
      .enum(["Low", "Medium", "High", "Critical"])
      .describe("Decision priority based on impact"),
    impactScope: z
      .array(z.enum(["Team", "Organization", "External"]))
      .describe("Who is affected by this decision"),
    decisionMaker: z
      .string()
      .optional()
      .describe(
        "Who made the decision. Pass raw Slack mention '<@U...>', name, or email. Defaults to current user.",
      ),
    date: z
      .string()
      .optional()
      .describe("Decision date in ISO 8601 format. Defaults to today."),
    followUpActions: z
      .array(
        z.object({
          taskName: z.string().describe("Follow-up task name"),
          description: z.string().describe("Task description"),
          assignee: z
            .string()
            .optional()
            .describe("Assignee — Slack mention, name, or email"),
          priority: z
            .enum(["High", "Medium", "Low"])
            .default("Medium")
            .describe("Task priority"),
          dueDate: z
            .string()
            .optional()
            .describe("Due date in ISO 8601 format"),
        }),
      )
      .optional()
      .describe("Follow-up tasks to create and link to this decision"),
  }),
  execute: async (
    {
      title,
      content,
      reason,
      category,
      priority,
      impactScope,
      decisionMaker,
      date,
      followUpActions,
    },
    { experimental_context },
  ) => {
    "use step";

    const { createDecision } = await import("~/lib/notion/decisions");
    const { WebClient } = await import("@slack/web-api");

    const ctx = experimental_context as SlackAgentContextInput;

    try {
      let decisionMakerNotionUserId: string | null = null;

      if (decisionMaker) {
        const resolved = await resolveSlackUserByMention(
          ctx.token,
          decisionMaker,
        );
        decisionMakerNotionUserId = resolved.notionUserId;
      } else {
        decisionMakerNotionUserId = await resolveNotionUserId(
          ctx.token,
          ctx.user_id,
        );
      }

      const decisionDate = date ?? new Date().toISOString().split("T")[0];

      const createdTaskIds: string[] = [];
      if (followUpActions && followUpActions.length > 0) {
        const { createTask } = await import("~/lib/notion/tasks");

        for (const action of followUpActions) {
          let assigneeNotionUserId: string | null = null;
          let assigneeSlackUserId: string | null = null;

          if (action.assignee) {
            const resolved = await resolveSlackUserByMention(
              ctx.token,
              action.assignee,
            );
            assigneeNotionUserId = resolved.notionUserId;
            assigneeSlackUserId = resolved.slackUserId;
          }

          const taskPage = await createTask({
            name: action.taskName,
            taskNum: "",
            description: action.description,
            summary: `Follow-up from decision: ${title}`,
            priority: action.priority,
            assigneeNotionUserId,
            dueDate: action.dueDate ?? null,
          });

          createdTaskIds.push(taskPage.id);

          if (assigneeSlackUserId) {
            const client = new WebClient(ctx.token);
            try {
              await client.chat.postMessage({
                channel: assigneeSlackUserId,
                text: `New follow-up task from decision: ${action.taskName}`,
                blocks: [
                  {
                    type: "header",
                    text: {
                      type: "plain_text",
                      text: "📋 New Follow-up Task",
                    },
                  },
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: [
                        `*Task:* ${action.taskName}`,
                        `*From Decision:* ${title}`,
                        `*Priority:* ${action.priority}`,
                        `*Assigned by:* <@${ctx.user_id}>`,
                        action.dueDate ? `*Due:* ${action.dueDate}` : "",
                      ]
                        .filter(Boolean)
                        .join("\n"),
                    },
                  },
                ],
              });
            } catch (dmError) {
              console.warn("Failed to send follow-up task DM:", dmError);
            }
          }
        }
      }

      const page = await createDecision({
        title,
        content,
        reason,
        decisionMakerNotionUserId,
        impactScope,
        priority,
        category,
        date: decisionDate,
        followUpTaskIds: createdTaskIds.length > 0 ? createdTaskIds : undefined,
      });

      const pageUrl = (page as { url: string }).url;

      return {
        success: true,
        message: `Decision "${title}" has been recorded in Notion.`,
        pageUrl,
        followUpTasksCreated: createdTaskIds.length,
      };
    } catch (error) {
      console.error("Failed to record decision:", error);
      return {
        success: false,
        message: "Failed to record decision in Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const queryDecisionHistory = tool({
  description:
    "Query historical decisions from the Notion Decisions database. Use this when the user asks about past decisions, what was decided, or who made a decision.",
  inputSchema: z.object({
    keyword: z
      .string()
      .optional()
      .describe("Search keyword to match in decision titles"),
    category: z
      .enum(["Strategic", "Operational", "Technical", "Financial", "HR"])
      .optional()
      .describe("Filter by decision category"),
    status: z
      .enum(["Proposed", "Confirmed", "Superseded"])
      .optional()
      .describe("Filter by decision status"),
    afterDate: z
      .string()
      .optional()
      .describe(
        "Only return decisions after this date (ISO 8601). Use for time-based queries like 'last week'.",
      ),
  }),
  execute: async (
    { keyword, category, status, afterDate },
    { experimental_context: _ctx },
  ) => {
    "use step";

    const { queryDecisions } = await import("~/lib/notion/query");

    try {
      const items = await queryDecisions({
        keyword: keyword || undefined,
        category: category || undefined,
        status: status || undefined,
        afterDate: afterDate || undefined,
      });

      return {
        success: true,
        count: items.length,
        message:
          items.length > 0
            ? `Found ${items.length} decision(s).`
            : "No decisions found matching your criteria.",
        formatted: formatDecisionList(items),
        items,
      };
    } catch (error) {
      console.error("Failed to query decisions:", error);
      return {
        success: false,
        message: "Failed to query decisions from Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const linkDecisionToDoc = tool({
  description:
    "Update a decision's status in Notion. Use this to confirm a proposed decision or mark it as superseded.",
  inputSchema: z.object({
    decisionTitle: z
      .string()
      .describe("Title of the decision to find and update"),
    newStatus: z
      .enum(["Proposed", "Confirmed", "Superseded"])
      .describe("New status for the decision"),
  }),
  execute: async (
    { decisionTitle, newStatus },
    { experimental_context: _ctx },
  ) => {
    "use step";

    const { queryDecisions } = await import("~/lib/notion/query");
    const { updateDecisionStatus } = await import("~/lib/notion/decisions");

    try {
      const decisions = await queryDecisions({ keyword: decisionTitle });
      if (decisions.length === 0) {
        return {
          success: false,
          message: `No decision found matching "${decisionTitle}".`,
        };
      }

      const decision = decisions[0];
      await updateDecisionStatus(decision.id, newStatus);

      return {
        success: true,
        message: `Decision "${decision.title}" status updated to ${newStatus}.`,
        pageUrl: decision.url,
      };
    } catch (error) {
      console.error("Failed to update decision:", error);
      return {
        success: false,
        message: "Failed to update decision in Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const decisionTools = {
  recordDecision,
  queryDecisionHistory,
  linkDecisionToDoc,
};
