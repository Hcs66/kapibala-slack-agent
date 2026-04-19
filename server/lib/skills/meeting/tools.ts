import { tool } from "ai";
import { z } from "zod";
import type { SlackAgentContextInput } from "~/lib/ai/context";
import {
  meetingActionItemsApprovalHook,
  saveDocApprovalHook,
} from "~/lib/ai/workflows/hooks";
import type { MeetingActionItem } from "~/lib/slack/blocks";
import {
  resolveNotionUserId,
  resolveSlackUserByMention,
} from "~/lib/slack/user-resolver";

async function sendSaveDocApprovalRequest(
  ctx: SlackAgentContextInput,
  toolCallId: string,
  docName: string,
  summary: string,
): Promise<{ success: boolean }> {
  "use step";
  const { WebClient } = await import("@slack/web-api");
  const { saveDocApprovalBlocks } = await import("~/lib/slack/blocks");

  const client = new WebClient(ctx.token);
  await client.chat.postMessage({
    channel: ctx.dm_channel,
    thread_ts: ctx.thread_ts,
    blocks: saveDocApprovalBlocks({ toolCallId, docName, summary }),
    text: `Save "${docName}" to Notion?`,
  });

  return { success: true };
}

async function performSaveDoc(
  ctx: SlackAgentContextInput,
  docName: string,
  summary: string,
  category: string[],
  content: string,
): Promise<{
  success: boolean;
  message: string;
  pageUrl?: string;
  error?: string;
}> {
  "use step";
  const { createDoc } = await import("~/lib/notion/docs");

  try {
    const authorNotionUserId = await resolveNotionUserId(
      ctx.token,
      ctx.user_id,
    );

    const page = await createDoc({
      docName,
      summary,
      category,
      authorNotionUserId,
      content,
    });

    const pageUrl = (page as { url: string }).url;

    return {
      success: true,
      message: `Document "${docName}" has been saved to Notion.`,
      pageUrl,
    };
  } catch (error) {
    console.error("Failed to save doc to Notion:", error);
    return {
      success: false,
      message: "Failed to save document to Notion",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

const getThreadMessagesForSummary = tool({
  description:
    "Fetch messages from a Slack channel or thread for summarization. Supports time range filtering and user filtering.",
  inputSchema: z.object({
    channel_id: z
      .string()
      .describe("The Slack channel ID to fetch messages from"),
    thread_ts: z
      .string()
      .optional()
      .describe("Thread timestamp to fetch replies from a specific thread"),
    oldest: z
      .string()
      .optional()
      .describe("Only messages after this timestamp (Unix or ISO 8601)"),
    latest: z
      .string()
      .optional()
      .describe("Only messages before this timestamp"),
    filter_user_id: z
      .string()
      .optional()
      .describe("Only include messages from this Slack user ID"),
  }),
  execute: async (
    { channel_id, thread_ts, oldest, latest, filter_user_id },
    { experimental_context },
  ) => {
    "use step";
    const { WebClient } = await import("@slack/web-api");

    const ctx = experimental_context as SlackAgentContextInput;
    const client = new WebClient(ctx.token);

    try {
      const toUnixTs = (val: string): string => {
        if (/^\d+(\.\d+)?$/.test(val)) return val;
        const ms = Date.parse(val);
        if (Number.isNaN(ms)) return val;
        return String(ms / 1000);
      };

      const oldestTs = oldest ? toUnixTs(oldest) : undefined;
      const latestTs = latest ? toUnixTs(latest) : undefined;

      let rawMessages: Array<{
        user?: string;
        bot_id?: string;
        text?: string;
        ts?: string;
      }> = [];

      if (thread_ts) {
        const result = await client.conversations.replies({
          channel: channel_id,
          ts: thread_ts,
          oldest: oldestTs,
          latest: latestTs,
          limit: 200,
        });
        rawMessages = result.messages ?? [];
      } else {
        const result = await client.conversations.history({
          channel: channel_id,
          oldest: oldestTs,
          latest: latestTs,
          limit: 200,
        });
        rawMessages = result.messages ?? [];
        rawMessages.reverse();
      }

      if (filter_user_id) {
        rawMessages = rawMessages.filter((m) => m.user === filter_user_id);
      }

      const userIds = [
        ...new Set(rawMessages.map((m) => m.user).filter(Boolean)),
      ] as string[];
      const userNameMap: Record<string, string> = {};
      for (const uid of userIds) {
        try {
          const info = await client.users.info({ user: uid });
          userNameMap[uid] = info.user?.real_name || info.user?.name || uid;
        } catch {
          userNameMap[uid] = uid;
        }
      }

      const formatted = rawMessages
        .filter((m) => m.text)
        .map((m) => {
          const name = m.user ? (userNameMap[m.user] ?? m.user) : "bot";
          const time = m.ts
            ? new Date(Number(m.ts) * 1000).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";
          return `[${time}] ${name}: ${m.text}`;
        });

      return {
        success: true,
        messageCount: formatted.length,
        messages: formatted.join("\n"),
        participants: Object.values(userNameMap),
      };
    } catch (error) {
      console.error("Failed to fetch messages for summary:", error);
      return {
        success: false,
        message: "Failed to fetch messages",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const saveDocToNotion = tool({
  description:
    "Save a structured document (discussion summary, meeting notes, decision record) to the Notion Docs database. A confirmation button will be shown to the user.",
  inputSchema: z.object({
    docName: z.string().describe("Title of the document"),
    summary: z.string().describe("A one-line summary"),
    category: z
      .array(
        z.enum(["Tech Spec", "PRD", "Guide", "Best Practices", "Architecture"]),
      )
      .describe("Document categories"),
    content: z.string().describe("The full document content"),
  }),
  execute: async (
    { docName, summary, category, content },
    { toolCallId, experimental_context },
  ) => {
    const ctx = experimental_context as SlackAgentContextInput;

    try {
      await sendSaveDocApprovalRequest(ctx, toolCallId, docName, summary);

      const hook = saveDocApprovalHook.create({ token: toolCallId });
      const { approved } = await hook;

      if (!approved) {
        return {
          success: false,
          message: "User cancelled saving the document.",
          rejected: true,
        };
      }

      return await performSaveDoc(ctx, docName, summary, category, content);
    } catch (error) {
      console.error("Failed to save doc to Notion:", error);
      return {
        success: false,
        message: "Failed to save document to Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

async function sendActionItemsApprovalRequest(
  ctx: SlackAgentContextInput,
  toolCallId: string,
  meetingTitle: string,
  actionItems: MeetingActionItem[],
): Promise<{ success: boolean }> {
  "use step";
  const { WebClient } = await import("@slack/web-api");
  const { meetingActionItemsApprovalBlocks } = await import(
    "~/lib/slack/blocks"
  );

  const client = new WebClient(ctx.token);
  await client.chat.postMessage({
    channel: ctx.dm_channel,
    thread_ts: ctx.thread_ts,
    blocks: meetingActionItemsApprovalBlocks({
      toolCallId,
      meetingTitle,
      actionItems,
    }),
    text: `Create ${actionItems.length} task(s) from "${meetingTitle}"?`,
  });

  return { success: true };
}

async function performCreateTasks(
  ctx: SlackAgentContextInput,
  meetingTitle: string,
  actionItems: MeetingActionItem[],
): Promise<{
  success: boolean;
  message: string;
  createdTasks: Array<{ name: string; pageUrl: string }>;
  error?: string;
}> {
  "use step";

  const { createTask } = await import("~/lib/notion/tasks");
  const { WebClient } = await import("@slack/web-api");

  const createdTasks: Array<{ name: string; pageUrl: string }> = [];

  for (const item of actionItems) {
    let assigneeNotionUserId: string | null = null;
    let assigneeSlackUserId: string | null = null;

    if (item.assignee) {
      const resolved = await resolveSlackUserByMention(
        ctx.token,
        item.assignee,
      );
      assigneeNotionUserId = resolved.notionUserId;
      assigneeSlackUserId = resolved.slackUserId;
    }

    const taskPage = await createTask({
      name: item.taskName,
      taskNum: "",
      description: item.description,
      summary: `Action item from meeting: ${meetingTitle}`,
      priority: item.priority,
      assigneeNotionUserId,
      dueDate: item.dueDate ?? null,
    });

    const pageUrl = (taskPage as { url: string }).url;
    createdTasks.push({ name: item.taskName, pageUrl });

    if (assigneeSlackUserId) {
      const client = new WebClient(ctx.token);
      try {
        await client.chat.postMessage({
          channel: assigneeSlackUserId,
          text: `New task from meeting: ${item.taskName}`,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "📋 New Task from Meeting",
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: [
                  `*Task:* ${item.taskName}`,
                  `*From Meeting:* ${meetingTitle}`,
                  `*Priority:* ${item.priority}`,
                  `*Assigned by:* <@${ctx.user_id}>`,
                  item.dueDate ? `*Due:* ${item.dueDate}` : "",
                  `*Notion:* <${pageUrl}|View in Notion>`,
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
            },
          ],
        });
      } catch (dmError) {
        console.warn("Failed to send meeting task DM:", dmError);
      }
    }
  }

  return {
    success: true,
    message: `Created ${createdTasks.length} task(s) from meeting "${meetingTitle}".`,
    createdTasks,
  };
}

const createTasksFromMeeting = tool({
  description:
    "Create tasks in Notion from meeting action items. Shows a confirmation button to the user before creating. Call this AFTER generating the summary when action items have been identified.",
  inputSchema: z.object({
    meetingTitle: z
      .string()
      .describe("Title of the meeting or discussion thread"),
    actionItems: z
      .array(
        z.object({
          taskName: z.string().describe("Short task title"),
          description: z
            .string()
            .describe("Task description with context from the discussion"),
          assignee: z
            .string()
            .optional()
            .describe(
              "Person to assign. Pass raw Slack mention '<@U...>', name string, or email.",
            ),
          priority: z
            .enum(["High", "Medium", "Low"])
            .default("Medium")
            .describe("Task priority — infer from discussion urgency"),
          dueDate: z
            .string()
            .optional()
            .describe("Due date in ISO 8601 format if mentioned"),
        }),
      )
      .describe("Action items extracted from the meeting discussion"),
  }),
  execute: async (
    { meetingTitle, actionItems },
    { toolCallId, experimental_context },
  ) => {
    const ctx = experimental_context as SlackAgentContextInput;

    try {
      await sendActionItemsApprovalRequest(
        ctx,
        toolCallId,
        meetingTitle,
        actionItems,
      );

      const hook = meetingActionItemsApprovalHook.create({
        token: toolCallId,
      });
      const { approved } = await hook;

      if (!approved) {
        return {
          success: false,
          message: "User skipped task creation from meeting.",
          skipped: true,
        };
      }

      return await performCreateTasks(ctx, meetingTitle, actionItems);
    } catch (error) {
      console.error("Failed to create tasks from meeting:", error);
      return {
        success: false,
        message: "Failed to create tasks from meeting",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const meetingTools = {
  getThreadMessagesForSummary,
  saveDocToNotion,
  createTasksFromMeeting,
};
