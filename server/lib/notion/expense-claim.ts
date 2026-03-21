import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";

export interface ExpenseClaimAttachment {
  fileUploadId: string;
  filename: string;
}

export interface ExpenseClaimData {
  claimTitle: string;
  claimDescription: string;
  amount: number;
  currency: string;
  expenseType: string;
  paymentMethod: string;
  approverNotionUserId: string | null;
  payerNotionUserId: string | null;
  submittedByNotionUserId: string | null;
  notes: string;
  invoiceAttachments: ExpenseClaimAttachment[];
}

export async function createExpenseClaim(data: ExpenseClaimData) {
  const databaseId = process.env.NOTION_EXPENSE_CLAIM_DATABASE_ID;
  if (!databaseId) {
    throw new Error("NOTION_EXPENSE_CLAIM_DATABASE_ID is not configured");
  }

  const properties: CreatePageParameters["properties"] = {
    "Claim Title": {
      title: [{ text: { content: data.claimTitle } }],
    },
    "Claim Description": {
      rich_text: [{ text: { content: data.claimDescription } }],
    },
    Amount: {
      number: data.amount,
    },
    Currency: {
      select: { name: data.currency },
    },
    "Expense Type": {
      select: { name: data.expenseType },
    },
    "Submission Date": {
      date: { start: new Date().toISOString().split("T")[0] },
    },
  };

  if (data.submittedByNotionUserId) {
    properties["Submitted By"] = {
      people: [{ id: data.submittedByNotionUserId }],
    };
  }

  if (data.invoiceAttachments.length > 0) {
    properties.Attachments = {
      files: data.invoiceAttachments.map((att) => ({
        type: "file_upload" as const,
        file_upload: { id: att.fileUploadId },
        name: att.filename,
      })),
    };
  }

  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const page = await notion.pages.create({
    parent: {
      database_id: databaseId,
    },
    properties,
  });

  return page;
}

export async function updateExpenseClaimStatus(
  pageId: string,
  status: "Approved" | "Rejected",
) {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  await notion.pages.update({
    page_id: pageId,
    properties: {
      "Approval Status": {
        status: { name: status },
      },
    },
  });
}

export async function updateExpenseClaimAttachments(
  pageId: string,
  attachments: ExpenseClaimAttachment[],
) {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Attachments: {
        files: attachments.map((att) => ({
          type: "file_upload" as const,
          file_upload: { id: att.fileUploadId },
          name: att.filename,
        })),
      },
    },
  });
}
