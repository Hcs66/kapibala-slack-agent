import { tool } from "ai";
import { z } from "zod";
import type { SlackAgentContextInput } from "~/lib/ai/context";

const submitFeedback = tool({
  description:
    "Submit a feedback entry (bug report, feature request, or general feedback) to Notion. Use this when the user describes a bug, requests a feature, or provides feedback. You MUST extract structured fields from the user's natural language and present them for confirmation BEFORE calling this tool. Only call this tool after the user confirms the extracted information.",
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
    const { findNotionUser } = await import("~/lib/notion/user-map");
    const { WebClient } = await import("@slack/web-api");

    const ctx = experimental_context as SlackAgentContextInput;

    try {
      let createdByNotionUserId: string | null = null;
      try {
        const client = new WebClient(ctx.token);
        const userInfo = await client.users.info({ user: ctx.user_id });
        const email = userInfo.user?.profile?.email;
        if (email) {
          createdByNotionUserId = await findNotionUser(email);
        }
      } catch (userError) {
        console.warn("Failed to resolve Notion user:", userError);
      }

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

      const notificationChannel = process.env.FEEDBACK_CHANNEL_ID;
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

export const notionTools = {
  submitFeedback,
};
