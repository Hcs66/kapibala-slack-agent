import { tool } from "ai";
import { z } from "zod";
import type { SlackAgentContextInput } from "~/lib/ai/context";
import { formatRecruitmentList } from "~/lib/skills/shared/formatters";

export const submitCandidate = tool({
  description:
    "Submit a candidate entry to the recruitment database in Notion. Use this when the user mentions a candidate, referral, or someone applying for a position. You MUST extract structured fields from the user's natural language and present them for confirmation BEFORE calling this tool. Only call this tool after the user confirms the extracted information.",
  inputSchema: z.object({
    candidateName: z.string().describe("Full name of the candidate"),
    positionApplied: z
      .enum([
        "AI Post-Training Engineer",
        "AI Product Engineer / Full-Stack",
        "International Business Development",
        "Software Engineer",
        "Product Manager",
        "UX Designer",
        "HR Specialist",
      ])
      .describe("Position the candidate is applying for"),
    resumeSource: z
      .enum(["LinkedIn", "Xiaohongshu", "Email", "Liepin", "Other"])
      .describe("Where the candidate's resume was sourced from"),
    phone: z.string().optional().describe("Candidate's phone number"),
    email: z.string().optional().describe("Candidate's email address"),
    interviewTime: z
      .string()
      .optional()
      .describe("Interview date/time in ISO 8601 format (e.g. 2026-03-25)"),
    zoomMeetingLink: z
      .string()
      .optional()
      .describe("Zoom meeting link for the interview"),
    resumeLink: z
      .string()
      .optional()
      .describe("URL link to the candidate's resume"),
  }),
  execute: async (
    {
      candidateName,
      positionApplied,
      resumeSource,
      phone,
      email,
      interviewTime,
      zoomMeetingLink,
      resumeLink,
    },
    { experimental_context },
  ) => {
    "use step";

    const { createCandidate } = await import("~/lib/notion/recruitment");
    const { WebClient } = await import("@slack/web-api");
    const { candidateResumeUploadBlocks } = await import("~/lib/slack/blocks");

    const ctx = experimental_context as SlackAgentContextInput;

    try {
      const page = await createCandidate({
        candidateName,
        positionApplied,
        status: "",
        resumeSource,
        phone: phone ?? "",
        email: email ?? "",
        interviewTime: interviewTime ?? null,
        zoomMeetingLink: zoomMeetingLink ?? "",
        resumeLink: resumeLink ?? "",
        resumeAttachments: [],
      });

      const pageId = (page as { id: string }).id;
      const pageUrl = (page as { url: string }).url;
      const client = new WebClient(ctx.token);

      const notificationChannel = process.env.SLACK_RECRUITMENT_CHANNEL_ID;
      if (notificationChannel) {
        const fields = [
          `*Candidate Name:* ${candidateName}`,
          `*Position:* ${positionApplied}`,
          `*Source:* ${resumeSource}`,
          `*Submitted By:* <@${ctx.user_id}>`,
          `*Notion:* <${pageUrl}|View in Notion>`,
        ];
        if (phone) fields.push(`*Phone:* ${phone}`);
        if (email) fields.push(`*Email:* ${email}`);
        if (interviewTime) fields.push(`*Interview Time:* ${interviewTime}`);
        if (zoomMeetingLink)
          fields.push(`*Zoom:* <${zoomMeetingLink}|Join Meeting>`);
        if (resumeLink) fields.push(`*Resume:* <${resumeLink}|View Resume>`);

        await client.chat.postMessage({
          channel: notificationChannel,
          text: `New candidate: ${candidateName}`,
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "New Candidate" },
            },
            {
              type: "section",
              text: { type: "mrkdwn", text: fields.join("\n") },
            },
          ],
        });
      }

      const interviewerEmail = process.env.RECRUITMENT_INTERVIEWER_EMAIL;
      if (interviewerEmail) {
        try {
          const lookupResult = await client.users.lookupByEmail({
            email: interviewerEmail,
          });
          const interviewerSlackId = lookupResult.user?.id;
          if (interviewerSlackId) {
            const interviewerFields = [
              `*Candidate Name:* ${candidateName}`,
              `*Position:* ${positionApplied}`,
              `*Source:* ${resumeSource}`,
              `*Submitted By:* <@${ctx.user_id}>`,
              `*Notion:* <${pageUrl}|View in Notion>`,
            ];
            if (phone) interviewerFields.push(`*Phone:* ${phone}`);
            if (email) interviewerFields.push(`*Email:* ${email}`);
            if (interviewTime)
              interviewerFields.push(`*Interview Time:* ${interviewTime}`);
            if (zoomMeetingLink)
              interviewerFields.push(
                `*Zoom:* <${zoomMeetingLink}|Join Meeting>`,
              );
            if (resumeLink)
              interviewerFields.push(`*Resume:* <${resumeLink}|View Resume>`);

            await client.chat.postMessage({
              channel: interviewerSlackId,
              text: `New candidate for interview: ${candidateName}`,
              blocks: [
                {
                  type: "header",
                  text: {
                    type: "plain_text",
                    text: "New Candidate for Interview",
                  },
                },
                {
                  type: "section",
                  text: { type: "mrkdwn", text: interviewerFields.join("\n") },
                },
              ],
            });
          }
        } catch (error) {
          console.warn(
            "Failed to lookup interviewer by email:",
            interviewerEmail,
            error,
          );
        }
      }

      await client.chat.postMessage({
        channel: ctx.dm_channel,
        thread_ts: ctx.thread_ts,
        text: `候选人 ${candidateName} 已录入，点击上传简历附件`,
        blocks: candidateResumeUploadBlocks({
          pageId,
          pageUrl,
          candidateName,
        }),
      });

      return {
        success: true,
        message: `Candidate "${candidateName}" for ${positionApplied} has been saved to Notion.`,
        pageUrl,
      };
    } catch (error) {
      console.error("Failed to create candidate:", error);
      return {
        success: false,
        message: "Failed to save candidate to Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const queryPendingItems = tool({
  description:
    'Query pending recruitment candidates from Notion. Use this when the user asks about unprocessed recruitment candidates. Examples: "有哪些招聘未处理", "pending candidates", "未处理的候选人".',
  inputSchema: z.object({}),
  execute: async (_input, { experimental_context: _ctx }) => {
    "use step";

    const { queryRecruitment } = await import("~/lib/notion/query");

    try {
      const items = await queryRecruitment({
        status: "Pending Review",
      });
      return {
        success: true,
        category: "pending_recruitment",
        count: items.length,
        message:
          items.length > 0
            ? `Found ${items.length} candidate(s) pending review.`
            : "No candidates pending review.",
        formatted: formatRecruitmentList(items),
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

export const queryProjectStatus = tool({
  description:
    "Query project status from the recruitment Notion database. Use this when the user asks about recruitment pipeline, candidate status, or overall hiring progress.",
  inputSchema: z.object({
    filters: z
      .object({
        status: z.string().optional().describe("Status/approval status filter"),
        position: z
          .string()
          .optional()
          .describe("Position filter (recruitment)"),
      })
      .optional()
      .describe("Optional filters to narrow results"),
  }),
  execute: async ({ filters }, { experimental_context: _ctx }) => {
    "use step";

    const { queryRecruitment } = await import("~/lib/notion/query");

    try {
      const items = await queryRecruitment({
        positionApplied: filters?.position || undefined,
        status: filters?.status || undefined,
      });
      return {
        success: true,
        database: "recruitment",
        count: items.length,
        formatted: formatRecruitmentList(items),
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

export const recruitmentTools = {
  submitCandidate,
  queryPendingItems,
  queryProjectStatus,
};
