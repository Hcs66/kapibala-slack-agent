import { tool } from "ai";
import { z } from "zod";
import type { SlackAgentContextInput } from "~/lib/ai/context";
import type {
  ExpenseClaimRecord,
  FeedbackRecord,
  RecruitmentRecord,
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
      if (e.amount != null && e.currency)
        parts.push(`${e.amount} ${e.currency}`);
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
    "Submit an expense claim (reimbursement request) to Notion and send it for approval. Use this when the user wants to submit an expense or reimbursement. You MUST extract structured fields from the user's natural language and present them for confirmation BEFORE calling this tool. Only call this tool after the user confirms. After submission, the claim is sent to the approvals channel — the user will be notified via DM when it's approved or rejected.",
  inputSchema: z.object({
    claimTitle: z
      .string()
      .describe("Short title for the expense, e.g. 'Airport taxi 03/15'"),
    claimDescription: z
      .string()
      .describe("Detailed description of the expense"),
    amount: z.number().describe("Expense amount as a number"),
    currency: z
      .enum(["CNY", "USD", "AED"])
      .describe("Currency code: CNY, USD, or AED"),
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
    { claimTitle, claimDescription, amount, currency, expenseType },
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
        currency,
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
            currency,
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
          currency,
        }),
      });

      return {
        success: true,
        message: approvalsChannel
          ? `Expense claim "${claimTitle}" (${amount} ${currency}) has been saved to Notion and sent for approval.`
          : `Expense claim "${claimTitle}" (${amount} ${currency}) has been saved to Notion. Note: no approvals channel is configured.`,
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

export const notionTools = {
  submitFeedback,
  submitExpenseClaim,
  submitCandidate,
  queryMyTasks,
  queryProjectStatus,
  queryPendingApprovals,
  queryPendingItems,
};
