import { tool } from "ai";
import { z } from "zod";
import type { SlackAgentContextInput } from "~/lib/ai/context";
import { formatTaskList } from "~/lib/skills/shared/formatters";
import {
  resolveNotionUserId,
  resolveSlackUserByMention,
} from "~/lib/slack/user-resolver";

const createTaskTool = tool({
  description:
    "Create a new task in the Notion Tasks database. You MUST call this tool immediately when the user confirms the task details. Do NOT respond with text only — invoke this tool. After creation, the assignee receives a DM notification.",
  inputSchema: z.object({
    name: z.string().describe("Task name/title"),
    taskNum: z.string().describe("Task number identifier, e.g. B1, C3, A2"),
    description: z
      .string()
      .describe("Task description with details and acceptance criteria"),
    priority: z.enum(["High", "Medium", "Low"]).describe("Task priority level"),
    assignee: z
      .string()
      .optional()
      .describe(
        "Person to assign. Pass raw Slack mention '<@U...>', name string, or email.",
      ),
    dueDate: z.string().optional().describe("Due date in ISO 8601 format"),
  }),
  execute: async (
    { name, taskNum, description, priority, assignee, dueDate },
    { experimental_context },
  ) => {
    "use step";

    const { createTask } = await import("~/lib/notion/tasks");
    const { WebClient } = await import("@slack/web-api");

    const ctx = experimental_context as SlackAgentContextInput;

    try {
      let assigneeNotionUserId: string | null = null;
      let assigneeSlackUserId: string | null = null;

      if (assignee) {
        const resolved = await resolveSlackUserByMention(ctx.token, assignee);
        assigneeNotionUserId = resolved.notionUserId;
        assigneeSlackUserId = resolved.slackUserId;
      }

      const page = await createTask({
        name,
        taskNum,
        description,
        summary: "",
        priority,
        assigneeNotionUserId,
        dueDate: dueDate ?? null,
      });

      const pageUrl = (page as { url: string }).url;

      if (assigneeSlackUserId) {
        const client = new WebClient(ctx.token);
        const fields = [
          `*Task:* ${taskNum} - ${name}`,
          `*Priority:* ${priority}`,
          `*Assigned by:* <@${ctx.user_id}>`,
          `*Notion:* <${pageUrl}|View in Notion>`,
        ];
        if (dueDate) fields.push(`*Due:* ${dueDate}`);
        if (description) fields.push(`*Description:* ${description}`);

        try {
          await client.chat.postMessage({
            channel: assigneeSlackUserId,
            text: `New task assigned: ${taskNum} - ${name}`,
            blocks: [
              {
                type: "header",
                text: {
                  type: "plain_text",
                  text: `📋 New Task Assigned: ${taskNum}`,
                },
              },
              {
                type: "section",
                text: { type: "mrkdwn", text: fields.join("\n") },
              },
            ],
          });
        } catch (dmError) {
          console.warn("Failed to send task assignment DM:", dmError);
        }
      }

      return {
        success: true,
        message: `Task "${taskNum} - ${name}" has been created in Notion.`,
        pageUrl,
      };
    } catch (error) {
      console.error("Failed to create task:", error);
      return {
        success: false,
        message: "Failed to create task in Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const updateTaskTool = tool({
  description:
    'Update an existing task in Notion. The task is identified by its Task Num (e.g. B1, C3). If the user says "done"/"完成"/"100%", set status to Done; otherwise In Progress.',
  inputSchema: z.object({
    taskNum: z.string().describe("Task number to update, e.g. B1, C3"),
    progress: z
      .string()
      .optional()
      .describe("Progress update text to append to the task Log field"),
    status: z
      .enum(["To Do", "In Progress", "Done"])
      .optional()
      .describe("New task status"),
    priority: z
      .enum(["High", "Medium", "Low"])
      .optional()
      .describe("Updated priority if mentioned"),
    assignee: z
      .string()
      .optional()
      .describe("New assignee if reassignment is requested"),
    dueDate: z
      .string()
      .optional()
      .describe("Updated due date in ISO 8601 format"),
  }),
  execute: async (
    { taskNum, progress, status, priority, assignee, dueDate },
    { experimental_context },
  ) => {
    "use step";

    const { findTaskByNum } = await import("~/lib/notion/query");
    const { updateTaskProperties } = await import("~/lib/notion/tasks");

    const ctx = experimental_context as SlackAgentContextInput;

    try {
      const task = await findTaskByNum(taskNum);
      if (!task) {
        return {
          success: false,
          message: `Task "${taskNum}" not found in Notion. Please check the task number.`,
        };
      }

      let assigneeNotionUserId: string | undefined;
      if (assignee) {
        const resolved = await resolveSlackUserByMention(ctx.token, assignee);
        assigneeNotionUserId = resolved.notionUserId ?? undefined;
      }

      await updateTaskProperties(task.id, {
        status: status ?? (progress ? "In Progress" : undefined),
        log: progress ? { existing: task.log, newEntry: progress } : undefined,
        priority,
        assigneeNotionUserId,
        dueDate,
      });

      return {
        success: true,
        message: `Task "${taskNum} - ${task.name}" has been updated.`,
        pageUrl: task.url,
        updatedFields: {
          status: status ?? (progress ? "In Progress" : undefined),
          progress: progress ?? undefined,
          priority,
          dueDate,
        },
      };
    } catch (error) {
      console.error("Failed to update task:", error);
      return {
        success: false,
        message: "Failed to update task in Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const generateTaskProgress = tool({
  description:
    "Generate a task progress report from Notion Tasks and save it to Notion Docs. Supports filtering by time range.",
  inputSchema: z.object({
    timeRange: z
      .enum(["today", "this_week", "this_month", "all"])
      .describe("Time range filter"),
    skipSync: z
      .boolean()
      .optional()
      .describe(
        "Set to true ONLY if the user explicitly says they do NOT want to save to Notion.",
      ),
  }),
  execute: async ({ timeRange, skipSync }, { experimental_context }) => {
    "use step";

    const { queryTasks } = await import("~/lib/notion/query");

    const ctx = experimental_context as SlackAgentContextInput;

    try {
      let updatedAfter: string | undefined;
      const now = new Date();

      if (timeRange === "today") {
        const todayStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        updatedAfter = todayStart.toISOString();
      } else if (timeRange === "this_week") {
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + mondayOffset,
        );
        updatedAfter = weekStart.toISOString();
      } else if (timeRange === "this_month") {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        updatedAfter = monthStart.toISOString();
      }

      const tasks = await queryTasks({ updatedAfter });

      if (tasks.length === 0) {
        return {
          success: true,
          message: "No tasks found for the specified time range.",
          formatted: "No tasks found.",
          markdown: "",
        };
      }

      const dateStr = now.toISOString().split("T")[0];
      const rangeLabel =
        timeRange === "today"
          ? dateStr
          : timeRange === "this_week"
            ? `Week of ${dateStr}`
            : timeRange === "this_month"
              ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
              : "All";

      const statusEmoji: Record<string, string> = {
        Done: "✅ 完成",
        "In Progress": "🔵 进行中",
        "To Do": "⬜ 未开始",
      };

      const tableRows = tasks.map((t) => {
        const date = t.updatedAt ? t.updatedAt.split("T")[0].slice(5) : "-";
        const statusText = statusEmoji[t.status ?? ""] ?? (t.status || "-");
        const latestLog = t.log
          ? (t.log
              .split("\n")
              .pop()
              ?.replace(/^\[[\d-]+\]\s*/, "") ?? "-")
          : "-";
        return `| ${date} | ${t.taskNum} | ${t.name} | ${statusText} | ${latestLog} |`;
      });

      const markdown = [
        `## 任务进度表 - ${rangeLabel}`,
        "",
        "| 日期  | #  | 任务 | 状态 | 今日进展 |",
        "|-------|----|------|------|----------|",
        ...tableRows,
        "",
        `**总进度：${tasks.filter((t) => t.status === "Done").length}/${tasks.length} 完成（${Math.round((tasks.filter((t) => t.status === "Done").length / tasks.length) * 100)}%）**`,
      ].join("\n");

      let notionPageUrl: string | undefined;
      let syncError: string | undefined;

      if (!skipSync) {
        try {
          const { createDoc } = await import("~/lib/notion/docs");

          const authorNotionUserId = await resolveNotionUserId(
            ctx.token,
            ctx.user_id,
          );

          const page = await createDoc({
            docName: `任务进度表 ${rangeLabel}`,
            summary: `${tasks.length} tasks, ${tasks.filter((t) => t.status === "Done").length} completed`,
            category: [],
            authorNotionUserId,
            content: markdown,
          });

          notionPageUrl = (page as { url: string }).url;
        } catch (docError) {
          console.error("Failed to sync progress to Notion:", docError);
          syncError =
            docError instanceof Error ? docError.message : "Unknown error";
        }
      }

      return {
        success: true,
        message: notionPageUrl
          ? `Generated progress report for ${rangeLabel}: ${tasks.length} task(s). Saved to Notion.`
          : syncError
            ? `Generated progress report for ${rangeLabel}: ${tasks.length} task(s). Failed to save to Notion: ${syncError}`
            : `Generated progress report for ${rangeLabel}: ${tasks.length} task(s).`,
        formatted: formatTaskList(tasks),
        markdown,
        notionPageUrl,
        syncError,
        taskCount: tasks.length,
        completedCount: tasks.filter((t) => t.status === "Done").length,
      };
    } catch (error) {
      console.error("Failed to generate task progress:", error);
      return {
        success: false,
        message: "Failed to generate task progress report",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const taskTools = {
  createTaskTool,
  updateTaskTool,
  generateTaskProgress,
};
