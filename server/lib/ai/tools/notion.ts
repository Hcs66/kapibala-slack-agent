import { tool } from "ai";
import { z } from "zod";
import type { SlackAgentContextInput } from "~/lib/ai/context";
import { saveDocApprovalHook } from "~/lib/ai/workflows/hooks";
import type {
  ExpenseClaimRecord,
  ExpenseRecord,
  FeedbackRecord,
  RecruitmentRecord,
  TaskRecord,
} from "~/lib/notion/query";

async function resolveNotionUserId(
  token: string,
  slackUserId: string,
): Promise<string | null> {
  try {
    const { WebClient } = await import("@slack/web-api");
    const { findNotionUser } = await import("~/lib/notion/user-map");
    const client = new WebClient(token);
    const userInfo = await client.users.info({ user: slackUserId });
    const email = userInfo.user?.profile?.email;
    if (email) {
      return await findNotionUser(email);
    }
  } catch (error) {
    console.warn("Failed to resolve Notion user:", error);
  }
  return null;
}

function formatFeedbackList(items: FeedbackRecord[]): string {
  if (items.length === 0) return "No feedback items found.";
  return items
    .map((f, i) => {
      const parts = [`${i + 1}. *${f.name}*`];
      if (f.type) parts.push(`Type: ${f.type}`);
      if (f.status) parts.push(`Status: ${f.status}`);
      if (f.priority) parts.push(`Priority: ${f.priority}`);
      if (f.source) parts.push(`Source: ${f.source}`);
      if (f.dueDate) parts.push(`Due: ${f.dueDate}`);
      if (f.tags.length > 0) parts.push(`Tags: ${f.tags.join(", ")}`);
      parts.push(`<${f.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}

function formatExpenseClaimList(items: ExpenseClaimRecord[]): string {
  if (items.length === 0) return "No expense claims found.";
  return items
    .map((e, i) => {
      const parts = [`${i + 1}. *${e.claimTitle}*`];
      if (e.amount != null) parts.push(`$${e.amount}`);
      if (e.expenseType) parts.push(`Type: ${e.expenseType}`);
      if (e.status) parts.push(`Status: ${e.status}`);
      if (e.submissionDate) parts.push(`Submitted: ${e.submissionDate}`);
      parts.push(`<${e.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}

function formatRecruitmentList(items: RecruitmentRecord[]): string {
  if (items.length === 0) return "No candidates found.";
  return items
    .map((r, i) => {
      const parts = [`${i + 1}. *${r.candidateName}*`];
      if (r.positionApplied) parts.push(`Position: ${r.positionApplied}`);
      if (r.status) parts.push(`Status: ${r.status}`);
      if (r.interviewTime) parts.push(`Interview: ${r.interviewTime}`);
      parts.push(`<${r.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}

function formatTaskList(items: TaskRecord[]): string {
  if (items.length === 0) return "No tasks found.";
  return items
    .map((t, i) => {
      const parts = [`${i + 1}. *${t.taskNum}* ${t.name}`];
      if (t.status) parts.push(`Status: ${t.status}`);
      if (t.priority) parts.push(`Priority: ${t.priority}`);
      if (t.dueDate) parts.push(`Due: ${t.dueDate}`);
      if (t.assignee.length > 0) {
        const names = t.assignee.map((a) => a.name ?? "Unknown").join(", ");
        parts.push(`Assignee: ${names}`);
      }
      parts.push(`<${t.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}

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

const queryMyTasks = tool({
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

const queryProjectStatus = tool({
  description:
    "Query project status from Notion databases. Use this when the user asks about project progress, feedback stats, recruitment pipeline, or overall status. Examples: 'how is project X going', 'show me all P0 bugs', 'recruitment pipeline status', 'how many open bugs do we have'.",
  inputSchema: z.object({
    database: z
      .enum(["feedback", "expense_claims", "recruitment"])
      .describe(
        "Which database to query: feedback (bugs/features/tasks), expense_claims (reimbursements), recruitment (candidates)",
      ),
    filters: z
      .object({
        type: z.string().optional().describe("Feedback type filter"),
        priority: z.string().optional().describe("Priority filter"),
        source: z.string().optional().describe("Source filter"),
        status: z.string().optional().describe("Status/approval status filter"),
        position: z
          .string()
          .optional()
          .describe("Position filter (recruitment)"),
      })
      .optional()
      .describe("Optional filters to narrow results"),
  }),
  execute: async ({ database, filters }, { experimental_context: _ctx }) => {
    "use step";

    const { queryFeedback, queryExpenseClaims, queryRecruitment } =
      await import("~/lib/notion/query");

    try {
      if (database === "feedback") {
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
      }

      if (database === "expense_claims") {
        const items = await queryExpenseClaims({
          status: filters?.status || undefined,
        });
        return {
          success: true,
          database: "expense_claims",
          count: items.length,
          formatted: formatExpenseClaimList(items),
          items,
        };
      }

      if (database === "recruitment") {
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
      }

      return { success: false, message: `Unknown database: ${database}` };
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

const queryPendingApprovals = tool({
  description:
    "Query pending expense claim approvals from Notion. Use this when the user asks about pending approvals, unprocessed reimbursements, or expense claims waiting for review. Examples: 'any pending approvals', 'how many expense claims need review', 'show me unapproved reimbursements'.",
  inputSchema: z.object({}),
  execute: async (_input, { experimental_context }) => {
    "use step";

    const { queryExpenseClaims } = await import("~/lib/notion/query");
    const _ctx = experimental_context as SlackAgentContextInput;

    try {
      const allClaims = await queryExpenseClaims({});
      const pending = allClaims.filter(
        (c) => !c.status || c.status === "Pending",
      );
      const approved = allClaims.filter((c) => c.status === "Approved");
      const rejected = allClaims.filter((c) => c.status === "Rejected");

      return {
        success: true,
        summary: {
          total: allClaims.length,
          pending: pending.length,
          approved: approved.length,
          rejected: rejected.length,
        },
        message:
          pending.length > 0
            ? `${pending.length} expense claim(s) pending approval.`
            : "No pending expense claims.",
        formatted: formatExpenseClaimList(pending),
        pendingItems: pending,
      };
    } catch (error) {
      console.error("Failed to query pending approvals:", error);
      return {
        success: false,
        message: "Failed to query pending approvals from Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const submitExpenseClaim = tool({
  description:
    "Submit an expense claim (reimbursement request) to Notion and send it for approval. Use this when the user wants to submit an expense or reimbursement. You MUST extract structured fields from the user's natural language and present them for confirmation BEFORE calling this tool. Only call this tool after the user confirms. After submission, the claim is sent to the approvals channel — the user will be notified via DM when it's approved or rejected. All amounts are in USD.",
  inputSchema: z.object({
    claimTitle: z
      .string()
      .describe("Short title for the expense, e.g. 'Airport taxi 03/15'"),
    claimDescription: z
      .string()
      .describe("Detailed description of the expense"),
    amount: z.number().describe("Expense amount in USD"),
    expenseType: z
      .enum([
        "Travel",
        "Office Supplies",
        "Entertainment",
        "Training",
        "Meals",
        "Equipment",
        "Other",
      ])
      .describe("Category of the expense"),
  }),
  execute: async (
    { claimTitle, claimDescription, amount, expenseType },
    { experimental_context },
  ) => {
    "use step";

    const { createExpenseClaim } = await import("~/lib/notion/expense-claim");
    const { WebClient } = await import("@slack/web-api");
    const { expenseClaimApprovalBlocks, expenseInvoiceUploadBlocks } =
      await import("~/lib/slack/blocks");

    const ctx = experimental_context as SlackAgentContextInput;

    try {
      const submittedByNotionUserId = await resolveNotionUserId(
        ctx.token,
        ctx.user_id,
      );

      const page = await createExpenseClaim({
        claimTitle,
        claimDescription,
        amount,
        expenseType,
        paymentMethod: "",
        approverNotionUserId: null,
        payerNotionUserId: null,
        submittedByNotionUserId,
        notes: "",
        invoiceAttachments: [],
      });

      const pageId = (page as { id: string }).id;
      const pageUrl = (page as { url: string }).url;
      const client = new WebClient(ctx.token);

      const approvalsChannel = process.env.SLACK_APPROVALS_CHANNEL_ID;
      if (approvalsChannel) {
        await client.chat.postMessage({
          channel: approvalsChannel,
          text: `Expense claim approval request: ${claimTitle}`,
          blocks: expenseClaimApprovalBlocks({
            pageId,
            pageUrl,
            claimTitle,
            amount,
            expenseType,
            submitterId: ctx.user_id,
          }),
        });
      }

      await client.chat.postMessage({
        channel: ctx.dm_channel,
        thread_ts: ctx.thread_ts,
        text: `报销 ${claimTitle} 已提交，点击上传发票/收据附件`,
        blocks: expenseInvoiceUploadBlocks({
          pageId,
          pageUrl,
          claimTitle,
          amount,
        }),
      });

      return {
        success: true,
        message: approvalsChannel
          ? `Expense claim "${claimTitle}" ($${amount}) has been saved to Notion and sent for approval.`
          : `Expense claim "${claimTitle}" ($${amount}) has been saved to Notion. Note: no approvals channel is configured.`,
        pageUrl,
      };
    } catch (error) {
      console.error("Failed to submit expense claim:", error);
      return {
        success: false,
        message: "Failed to submit expense claim",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const submitCandidate = tool({
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

const queryPendingItems = tool({
  description:
    'Query pending/unprocessed items from Notion databases. Use this when the user asks about unprocessed recruitment candidates, pending expense approvals, expenses awaiting payment, or unprocessed feedback. Examples: "有哪些招聘未处理", "报销待审批", "报销待付款", "反馈未处理", "pending candidates", "unprocessed feedback".',
  inputSchema: z.object({
    category: z
      .enum([
        "pending_recruitment",
        "pending_expense_approval",
        "pending_expense_payment",
        "pending_feedback",
      ])
      .describe(
        "Which pending items to query: pending_recruitment (candidates with Current Status = Pending Review), pending_expense_approval (expense claims with Approval Status = Pending), pending_expense_payment (expense claims with Approval Status = Approved, awaiting payment), pending_feedback (feedback with Status = Pending)",
      ),
  }),
  execute: async ({ category }, { experimental_context: _ctx }) => {
    "use step";

    const { queryFeedback, queryExpenseClaims, queryRecruitment } =
      await import("~/lib/notion/query");

    try {
      if (category === "pending_recruitment") {
        const items = await queryRecruitment({
          status: "Pending Review",
        });
        return {
          success: true,
          category,
          count: items.length,
          message:
            items.length > 0
              ? `Found ${items.length} candidate(s) pending review.`
              : "No candidates pending review.",
          formatted: formatRecruitmentList(items),
          items,
        };
      }

      if (category === "pending_expense_approval") {
        const items = await queryExpenseClaims({
          status: "Pending",
        });
        return {
          success: true,
          category,
          count: items.length,
          message:
            items.length > 0
              ? `Found ${items.length} expense claim(s) pending approval.`
              : "No expense claims pending approval.",
          formatted: formatExpenseClaimList(items),
          items,
        };
      }

      if (category === "pending_expense_payment") {
        const items = await queryExpenseClaims({
          status: "Approved",
        });
        return {
          success: true,
          category,
          count: items.length,
          message:
            items.length > 0
              ? `Found ${items.length} expense claim(s) awaiting payment.`
              : "No expense claims awaiting payment.",
          formatted: formatExpenseClaimList(items),
          items,
        };
      }

      if (category === "pending_feedback") {
        const items = await queryFeedback({ status: "Pending" });
        return {
          success: true,
          category,
          count: items.length,
          message:
            items.length > 0
              ? `Found ${items.length} feedback item(s) pending processing.`
              : "No feedback items pending processing.",
          formatted: formatFeedbackList(items),
          items,
        };
      }

      return { success: false, message: `Unknown category: ${category}` };
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

const getThreadMessagesForSummary = tool({
  description:
    'Fetch messages from a Slack thread or channel for summarization. Use this when the user asks to summarize a discussion, create meeting notes, or capture decisions. Supports filtering by time range, specific user, and returns messages ready for summarization. Examples: "总结今天的讨论", "summarize today\'s discussion about agent", "总结@username的发言".',
  inputSchema: z.object({
    channel_id: z
      .string()
      .describe("The Slack channel ID where the discussion happened"),
    thread_ts: z
      .string()
      .optional()
      .describe(
        "Thread timestamp to fetch replies from. If omitted, fetches channel-level messages.",
      ),
    oldest: z
      .string()
      .optional()
      .describe(
        "Only messages after this Unix timestamp (e.g. for 'today' use start of today). ISO 8601 date strings like '2026-03-28' are also accepted and will be converted.",
      ),
    latest: z
      .string()
      .optional()
      .describe("Only messages before this Unix timestamp"),
    filter_user_id: z
      .string()
      .optional()
      .describe(
        "Only include messages from this Slack user ID (for filtering by speaker)",
      ),
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

const saveDocToNotion = tool({
  description:
    "Save a structured document (discussion summary, meeting notes, decision record) to the Notion Docs database. Call this AFTER generating a summary. A confirmation button will be shown to the user — the workflow pauses until they click Save or Cancel.",
  inputSchema: z.object({
    docName: z
      .string()
      .describe(
        "Title of the document, e.g. 'Agent Architecture Discussion Summary 2026-03-28'",
      ),
    summary: z
      .string()
      .describe("A one-line summary of the document for the Notion property"),
    category: z
      .array(
        z.enum(["Tech Spec", "PRD", "Guide", "Best Practices", "Architecture"]),
      )
      .describe("Document categories from the Notion schema"),
    content: z
      .string()
      .describe(
        "The full document content (structured summary, decisions, action items, etc.)",
      ),
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

async function resolveSlackUserByMention(
  token: string,
  mentionText: string,
): Promise<{ notionUserId: string | null; slackUserId: string | null }> {
  try {
    const { WebClient } = await import("@slack/web-api");
    const { findNotionUser } = await import("~/lib/notion/user-map");
    const client = new WebClient(token);

    if (mentionText.includes("@") && mentionText.includes(".")) {
      const notionUserId = await findNotionUser(mentionText);
      try {
        const lookup = await client.users.lookupByEmail({
          email: mentionText,
        });
        return {
          notionUserId,
          slackUserId: lookup.user?.id ?? null,
        };
      } catch {
        return { notionUserId, slackUserId: null };
      }
    }

    const slackIdMatch = mentionText.match(/<@(U[A-Za-z0-9]+)>/);
    const rawIdMatch = !slackIdMatch
      ? mentionText.match(/^(U[A-Za-z0-9]+)$/)
      : null;
    const extractedUserId = slackIdMatch?.[1] ?? rawIdMatch?.[1];

    if (extractedUserId) {
      const profileResult = await client.users.profile.get({
        user: extractedUserId,
      });
      const email = profileResult.profile?.email;
      if (email) {
        const notionUserId = await findNotionUser(email);
        return { notionUserId, slackUserId: extractedUserId };
      }
      return { notionUserId: null, slackUserId: extractedUserId };
    }

    const usersResult = await client.users.list({});
    const members = usersResult.members ?? [];
    const normalizedMention = mentionText.toLowerCase().trim();

    const matched = members.find((m) => {
      const name = (m.name ?? "").toLowerCase();
      const realName = (m.real_name ?? "").toLowerCase();
      const displayName = (m.profile?.display_name ?? "").toLowerCase();
      return (
        name.includes(normalizedMention) ||
        realName.includes(normalizedMention) ||
        displayName.includes(normalizedMention)
      );
    });

    if (matched?.id) {
      const profileResult = await client.users.profile.get({
        user: matched.id,
      });
      const email = profileResult.profile?.email;
      const notionUserId = email ? await findNotionUser(email) : null;
      return { notionUserId, slackUserId: matched.id };
    }

    return { notionUserId: null, slackUserId: null };
  } catch (error) {
    console.warn("Failed to resolve user by mention:", error);
    return { notionUserId: null, slackUserId: null };
  }
}

const createTaskTool = tool({
  description:
    'Create a new task in the Notion Tasks database. Use this when the user wants to create/assign a task. You MUST extract structured fields from the user\'s natural language and present them for confirmation BEFORE calling this tool. Only call this tool after the user confirms. Examples: "创建一个任务：B1,名称：PG schema 设计", "create task C1: design API schema, assign to @hcs, due April 1, high priority".',
  inputSchema: z.object({
    name: z.string().describe("Task name/title"),
    taskNum: z
      .string()
      .describe(
        "Task number identifier, usually letter+number like B1, C3, A2",
      ),
    description: z
      .string()
      .describe("Task description with details and acceptance criteria"),
    priority: z.enum(["High", "Medium", "Low"]).describe("Task priority level"),
    assignee: z
      .string()
      .optional()
      .describe(
        "Person to assign. MUST pass the raw Slack mention format from the message, e.g. '<@U0AL2SG6GR0>'. If the user says a name like 'hcs' or 'Chu', pass the name string directly. If an email is given, pass the email. Leave empty if not specified.",
      ),
    dueDate: z
      .string()
      .optional()
      .describe("Due date in ISO 8601 format (e.g. 2026-04-01)"),
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
    'Update an existing task in the Notion Tasks database. Use this when the user wants to update task progress, status, or other fields. The task is identified by its Task Num (e.g. B1, C3). Progress updates are appended to the Log field. If the user says "done", "完成", "100%" etc., set status to Done; otherwise set to In Progress. Examples: "更新任务B1，进度：wa-bridge.ts 落库完成", "update task C1: schema design done".',
  inputSchema: z.object({
    taskNum: z
      .string()
      .describe(
        "Task number to update, e.g. B1, C3. Extracted from user message.",
      ),
    progress: z
      .string()
      .optional()
      .describe("Progress update text to append to the task Log field"),
    status: z
      .enum(["To Do", "In Progress", "Done"])
      .optional()
      .describe(
        "New task status. Set to Done if user indicates completion (done/完成/100%), otherwise In Progress.",
      ),
    priority: z
      .enum(["High", "Medium", "Low"])
      .optional()
      .describe("Updated priority if mentioned"),
    assignee: z
      .string()
      .optional()
      .describe(
        "New assignee if reassignment is requested. Pass the raw Slack mention format '<@U...>' from the message, or a name/email string.",
      ),
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
    'Generate a task progress report from the Notion Tasks database and save it to Notion Docs. Use this when the user asks for a task progress table/report. Supports filtering by time range (today, this week, this month) based on the Updated at field. The report is formatted as a markdown table and automatically saved to the Notion Docs database. After generation, always share the Notion link with the user. Examples: "生成今天的任务进度表", "generate this week\'s task progress", "@agent 生成任务进度表".',
  inputSchema: z.object({
    timeRange: z
      .enum(["today", "this_week", "this_month", "all"])
      .describe(
        "Time range filter based on task Updated at field: today, this_week, this_month, or all",
      ),
    skipSync: z
      .boolean()
      .optional()
      .describe(
        "Set to true ONLY if the user explicitly says they do NOT want to save to Notion. Default is false (always sync).",
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

      const tasks = await queryTasks({
        updatedAfter,
      });

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

interface BudgetStatusItem {
  category: string;
  monthlyBudget: number | null;
  spent: number;
  utilization: number | null;
  url: string;
}

function formatBudgetStatusList(items: BudgetStatusItem[]): string {
  if (items.length === 0) return "No budget items found.";
  return items
    .map((b, i) => {
      const parts = [`${i + 1}. *${b.category}*`];
      if (b.monthlyBudget != null) parts.push(`Budget: $${b.monthlyBudget}`);
      parts.push(`Spent: $${b.spent}`);
      if (b.utilization != null)
        parts.push(`Utilization: ${Math.round(b.utilization * 100)}%`);
      parts.push(`<${b.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}

function formatExpenseList(items: ExpenseRecord[]): string {
  if (items.length === 0) return "No expenses found.";
  return items
    .map((e, i) => {
      const parts = [`${i + 1}. *${e.expense}*`];
      if (e.amount != null) parts.push(`$${e.amount}`);
      if (e.date) parts.push(`Date: ${e.date}`);
      parts.push(`<${e.url}|View in Notion>`);
      return parts.join(" | ");
    })
    .join("\n");
}

const updateBudget = tool({
  description:
    'Update the monthly budget amount for a specific budget category in Notion. Use this when the user wants to set or change a budget amount. Examples: "更新预算，人力资源，1000", "set rent budget to 5000", "update Equipment Purchases budget to 2000".',
  inputSchema: z.object({
    category: z
      .string()
      .describe(
        "Budget category name in English. Available categories: Human Resources, Rent, Living Expenses, Visa Costs, Materials, Equipment Purchases, Miscellaneous, Transportation & Travel, Client Entertainment. The tool will fuzzy-match if not exact.",
      ),
    monthlyBudget: z.number().describe("The new monthly budget amount in USD"),
  }),
  execute: async (
    { category, monthlyBudget },
    { experimental_context: _ctx },
  ) => {
    "use step";

    const { findBudgetByCategory } = await import("~/lib/notion/query");
    const { updateBudgetAmount } = await import("~/lib/notion/budget");

    try {
      const budget = await findBudgetByCategory(category);
      if (!budget) {
        return {
          success: false,
          message: `Budget category "${category}" not found. Please check the category name.`,
        };
      }

      await updateBudgetAmount(budget.id, monthlyBudget);

      return {
        success: true,
        message: `Budget for "${category}" has been updated to $${monthlyBudget}.`,
        pageUrl: budget.url,
      };
    } catch (error) {
      console.error("Failed to update budget:", error);
      return {
        success: false,
        message: "Failed to update budget in Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const addExpense = tool({
  description:
    'Add a new expense entry to the Notion expenses database. The agent should infer the budget category from the expense description and automatically resolve the current month. Use this when the user wants to record a spending. Examples: "添加支出，macbook，200", "add expense: team lunch 50", "记录支出：办公椅 300".',
  inputSchema: z.object({
    expenseName: z
      .string()
      .describe(
        "Name/description of the expense, e.g. MacBook Pro, Team Lunch",
      ),
    amount: z.number().describe("Expense amount in USD"),
    category: z
      .string()
      .describe(
        "Budget category inferred from the expense description. Available categories: Human Resources (人力资源), Rent (房租), Living Expenses (生活费), Visa Costs (签证成本), Materials (物料), Equipment Purchases (设备购买), Miscellaneous (杂费), Transportation & Travel (交通差旅), Client Entertainment (客请费用). Use the English name. The tool will fuzzy-match if not exact.",
      ),
    date: z
      .string()
      .optional()
      .describe(
        "Expense date in ISO 8601 format (e.g. 2026-03-31). Defaults to today if not specified.",
      ),
  }),
  execute: async (
    { expenseName, amount, category, date },
    { experimental_context: _ctx },
  ) => {
    "use step";

    const { findBudgetByCategory } = await import("~/lib/notion/query");
    const { createExpense } = await import("~/lib/notion/expenses");
    const { findMonthByName, getCurrentMonthName } = await import(
      "~/lib/notion/month"
    );

    try {
      const budget = await findBudgetByCategory(category);
      if (!budget) {
        return {
          success: false,
          message: `Budget category "${category}" not found. Please check the category name.`,
        };
      }

      const monthName = getCurrentMonthName();
      const month = await findMonthByName(monthName);
      if (!month) {
        return {
          success: false,
          message: `Month "${monthName}" not found in the Month Classification database.`,
        };
      }

      const expenseDate = date || new Date().toISOString().split("T")[0];

      const page = await createExpense({
        expenseName,
        amount,
        date: expenseDate,
        claimPageId: null,
        budgetPageId: budget.id,
        monthPageId: month.id,
      });

      const pageUrl = (page as { url: string }).url;

      return {
        success: true,
        message: `Expense "${expenseName}" ($${amount}) has been added under "${category}" for ${monthName}.`,
        pageUrl,
      };
    } catch (error) {
      console.error("Failed to add expense:", error);
      return {
        success: false,
        message: "Failed to add expense to Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

const queryBudgetStatus = tool({
  description:
    'Query budget status from Notion. Shows monthly budget, current spending, and utilization for one or all categories. Use this when the user asks about budget, spending, or utilization. Examples: "查看本月人力资源预算", "本月总支出", "查看本月设备支出", "budget status", "how much have we spent this month".',
  inputSchema: z.object({
    category: z
      .string()
      .optional()
      .describe(
        "Specific budget category to query (English). If omitted, returns all categories.",
      ),
    includeExpenses: z
      .boolean()
      .optional()
      .describe(
        "If true, also return individual expense line items for the category. Default false.",
      ),
  }),
  execute: async (
    { category, includeExpenses },
    { experimental_context: _ctx },
  ) => {
    "use step";

    const { queryBudgets, queryExpenses, findBudgetByCategory } = await import(
      "~/lib/notion/query"
    );
    const { findMonthByName, getCurrentMonthName } = await import(
      "~/lib/notion/month"
    );

    try {
      const monthName = getCurrentMonthName();
      const month = await findMonthByName(monthName);

      if (!month) {
        return {
          success: false,
          message: `Month "${monthName}" not found in the Month Classification database.`,
        };
      }

      if (category) {
        const budget = await findBudgetByCategory(category);
        if (!budget) {
          return {
            success: false,
            message: `Budget category "${category}" not found.`,
          };
        }

        const expenses = await queryExpenses({
          budgetPageId: budget.id,
          monthPageId: month.id,
        });

        const spent = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);
        const utilization =
          budget.monthlyBudget && budget.monthlyBudget > 0
            ? spent / budget.monthlyBudget
            : null;

        const statusItem: BudgetStatusItem = {
          category: budget.category,
          monthlyBudget: budget.monthlyBudget,
          spent,
          utilization,
          url: budget.url,
        };

        return {
          success: true,
          month: monthName,
          category: budget.category,
          monthlyBudget: budget.monthlyBudget,
          spent,
          utilization:
            utilization != null ? Math.round(utilization * 100) : null,
          formatted: formatBudgetStatusList([statusItem]),
          expenses: includeExpenses ? formatExpenseList(expenses) : undefined,
          expenseItems: includeExpenses ? expenses : undefined,
        };
      }

      const budgets = await queryBudgets();

      const statusItems: BudgetStatusItem[] = await Promise.all(
        budgets.map(async (b) => {
          const expenses = await queryExpenses({
            budgetPageId: b.id,
            monthPageId: month.id,
          });
          const spent = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);
          const utilization =
            b.monthlyBudget && b.monthlyBudget > 0
              ? spent / b.monthlyBudget
              : null;
          return {
            category: b.category,
            monthlyBudget: b.monthlyBudget,
            spent,
            utilization,
            url: b.url,
          };
        }),
      );

      const totalBudget = statusItems.reduce(
        (sum, b) => sum + (b.monthlyBudget ?? 0),
        0,
      );
      const totalSpent = statusItems.reduce((sum, b) => sum + b.spent, 0);
      const overallUtilization = totalBudget > 0 ? totalSpent / totalBudget : 0;

      return {
        success: true,
        month: monthName,
        summary: {
          totalBudget,
          totalSpent,
          overallUtilization: Math.round(overallUtilization * 100),
          categoryCount: statusItems.length,
        },
        formatted: formatBudgetStatusList(statusItems),
        budgets: statusItems,
      };
    } catch (error) {
      console.error("Failed to query budget status:", error);
      return {
        success: false,
        message: "Failed to query budget status from Notion",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const notionTools = {
  submitFeedback,
  submitExpenseClaim,
  submitCandidate,
  queryMyTasks,
  queryProjectStatus,
  queryPendingApprovals,
  queryPendingItems,
  getThreadMessagesForSummary,
  saveDocToNotion,
  createTaskTool,
  updateTaskTool,
  generateTaskProgress,
  updateBudget,
  addExpense,
  queryBudgetStatus,
};
