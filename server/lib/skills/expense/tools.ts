import { tool } from "ai";
import { z } from "zod";
import type { SlackAgentContextInput } from "~/lib/ai/context";
import { formatExpenseClaimList } from "~/lib/skills/shared/formatters";
import { resolveNotionUserId } from "~/lib/slack/user-resolver";

export const queryPendingApprovals = tool({
  description:
    "Query pending expense claim approvals from Notion. Use this when the user asks about pending approvals, unprocessed reimbursements, or expense claims waiting for review. Examples: 'any pending approvals', 'how many expense claims need review', 'show me unapproved reimbursements'.",
  inputSchema: z.object({}),
  execute: async (_input) => {
    "use step";

    const { queryExpenseClaims } = await import("~/lib/notion/query");

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

export const submitExpenseClaim = tool({
  description:
    "Submit an expense claim to Notion and send it for approval. You MUST call this tool immediately when the user confirms the expense details. Do NOT respond with text only — invoke this tool. After submission, the claim goes to the approvals channel, the user gets an invoice upload button, and will be notified of approval/rejection via DM. All amounts are in USD.",
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
            currency: "USD",
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
          currency: "USD",
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

export const queryPendingItems = tool({
  description:
    'Query pending expense items from Notion databases. Use this when the user asks about expense claims waiting for approval or awaiting payment. Examples: "报销待审批", "报销待付款", "pending expense approvals", "expenses awaiting payment".',
  inputSchema: z.object({
    category: z
      .enum(["pending_expense_approval", "pending_expense_payment"])
      .describe(
        "Which pending items to query: pending_expense_approval (expense claims with Approval Status = Pending), pending_expense_payment (expense claims with Approval Status = Approved, awaiting payment)",
      ),
  }),
  execute: async ({ category }) => {
    "use step";

    const { queryExpenseClaims } = await import("~/lib/notion/query");

    try {
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
    "Query project status from the expense claims Notion database. Use this when the user asks about reimbursement progress, expense claim status, or overall expense approval status.",
  inputSchema: z.object({
    filters: z
      .object({
        status: z.string().optional().describe("Status/approval status filter"),
      })
      .optional()
      .describe("Optional filters to narrow results"),
  }),
  execute: async ({ filters }) => {
    "use step";

    const { queryExpenseClaims } = await import("~/lib/notion/query");

    try {
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

export const expenseTools = {
  submitExpenseClaim,
  queryPendingApprovals,
  queryPendingItems,
  queryProjectStatus,
};
