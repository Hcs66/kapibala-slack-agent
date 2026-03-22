import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

type PropertyValue = PageObjectResponse["properties"][string];

export function extractTitle(prop: PropertyValue): string {
  if (prop.type === "title") {
    return prop.title.map((t) => t.plain_text).join("");
  }
  return "";
}

export function extractRichText(prop: PropertyValue): string {
  if (prop.type === "rich_text") {
    return prop.rich_text.map((t) => t.plain_text).join("");
  }
  return "";
}

export function extractSelect(prop: PropertyValue): string | null {
  if (prop.type === "select") {
    return prop.select?.name ?? null;
  }
  return null;
}

export function extractStatus(prop: PropertyValue): string | null {
  if (prop.type === "status") {
    return prop.status?.name ?? null;
  }
  return null;
}

export function extractNumber(prop: PropertyValue): number | null {
  if (prop.type === "number") {
    return prop.number;
  }
  return null;
}

export function extractDate(prop: PropertyValue): string | null {
  if (prop.type === "date") {
    return prop.date?.start ?? null;
  }
  return null;
}

export function extractPeople(
  prop: PropertyValue,
): Array<{ id: string; name: string | null }> {
  if (prop.type === "people") {
    return prop.people.map((p) => ({
      id: p.id,
      name: "name" in p ? (p.name ?? null) : null,
    }));
  }
  return [];
}

export function extractMultiSelect(prop: PropertyValue): string[] {
  if (prop.type === "multi_select") {
    return prop.multi_select.map((s) => s.name);
  }
  return [];
}

export function extractUrl(prop: PropertyValue): string | null {
  if (prop.type === "url") {
    return prop.url;
  }
  return null;
}

export function extractEmail(prop: PropertyValue): string | null {
  if (prop.type === "email") {
    return prop.email;
  }
  return null;
}

export function extractPhone(prop: PropertyValue): string | null {
  if (prop.type === "phone_number") {
    return prop.phone_number;
  }
  return null;
}

export interface FeedbackRecord {
  id: string;
  url: string;
  name: string;
  type: string | null;
  status: string | null;
  description: string;
  priority: string | null;
  source: string | null;
  customer: string;
  assignedTo: Array<{ id: string; name: string | null }>;
  createdBy: Array<{ id: string; name: string | null }>;
  createdDate: string | null;
  dueDate: string | null;
  tags: string[];
}

export interface ExpenseClaimRecord {
  id: string;
  url: string;
  claimTitle: string;
  claimDescription: string;
  amount: number | null;
  currency: string | null;
  expenseType: string | null;
  submissionDate: string | null;
  status: string | null;
  submittedBy: Array<{ id: string; name: string | null }>;
}

export interface RecruitmentRecord {
  id: string;
  url: string;
  candidateName: string;
  positionApplied: string | null;
  status: string | null;
  resumeSource: string | null;
  email: string | null;
  phone: string | null;
  interviewTime: string | null;
}

export function parseFeedbackPage(page: PageObjectResponse): FeedbackRecord {
  const p = page.properties;
  return {
    id: page.id,
    url: page.url,
    name: extractTitle(p.Name),
    type: extractSelect(p.Type),
    status: extractStatus(p.Status) ?? extractSelect(p.Status) ?? null,
    description: extractRichText(p.Description),
    priority: extractSelect(p.Priority) ?? extractStatus(p.Priority) ?? null,
    source: extractSelect(p.Source),
    customer: extractRichText(p.Customer),
    assignedTo: extractPeople(p["Assigned To"]),
    createdBy: extractPeople(p["Created By"]),
    createdDate: extractDate(p["Created Date"]),
    dueDate: extractDate(p["Due Date"]),
    tags: extractMultiSelect(p.Tags),
  };
}

export function parseExpenseClaimPage(
  page: PageObjectResponse,
): ExpenseClaimRecord {
  const p = page.properties;
  return {
    id: page.id,
    url: page.url,
    claimTitle: extractTitle(p["Claim Title"]),
    claimDescription: extractRichText(p["Claim Description"]),
    amount: extractNumber(p.Amount),
    currency: extractSelect(p.Currency),
    expenseType: extractSelect(p["Expense Type"]),
    submissionDate: extractDate(p["Submission Date"]),
    status: extractStatus(p["Status"]),
    submittedBy: extractPeople(p["Submitted By"]),
  };
}

export function parseRecruitmentPage(
  page: PageObjectResponse,
): RecruitmentRecord {
  const p = page.properties;
  return {
    id: page.id,
    url: page.url,
    candidateName: extractTitle(p["Candidate Name"]),
    positionApplied: extractSelect(p["Position Applied"]),
    status:
      extractStatus(p["Status"]) ??
      extractSelect(p["Status"]) ??
      null,
    resumeSource: extractSelect(p["Resume Source"]),
    email: extractEmail(p.Email),
    phone: extractPhone(p.Phone),
    interviewTime: extractDate(p["Interview Time"]),
  };
}

function isFullPage(page: unknown): page is PageObjectResponse {
  return (
    typeof page === "object" &&
    page !== null &&
    "properties" in page &&
    "url" in page
  );
}

export async function queryFeedback(filters?: {
  assigneeNotionUserId?: string;
  type?: string;
  priority?: string;
  source?: string;
  status?: string;
}): Promise<FeedbackRecord[]> {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const dataSourceId = process.env.NOTION_FEEDBACK_DATASOURCE_ID;
  if (!dataSourceId) {
    throw new Error("NOTION_FEEDBACK_DATASOURCE_ID is not configured");
  }

  const conditions: Array<Record<string, unknown>> = [];

  if (filters?.assigneeNotionUserId) {
    conditions.push({
      property: "Assigned To",
      people: { contains: filters.assigneeNotionUserId },
    });
  }
  if (filters?.type) {
    conditions.push({
      property: "Type",
      select: { equals: filters.type },
    });
  }
  if (filters?.priority) {
    conditions.push({
      property: "Priority",
      select: { equals: filters.priority },
    });
  }
  if (filters?.source) {
    conditions.push({
      property: "Source",
      select: { equals: filters.source },
    });
  }
  if (filters?.status) {
    conditions.push({
      property: "Status",
      status: { equals: filters.status },
    });
  }

  const filter =
    conditions.length > 1
      ? { and: conditions }
      : conditions.length === 1
        ? conditions[0]
        : undefined;

  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: filter as Parameters<typeof notion.dataSources.query>[0]["filter"],
    sorts: [{ property: "Created Date", direction: "descending" }],
    filter_properties: [
      "Name",
      "Type",
      "Status",
      "Description",
      "Priority",
      "Source",
      "Customer",
      "Assigned To",
      "Created By",
      "Created Date",
      "Due Date",
      "Tags",
    ],
    page_size: 20,
  });

  return response.results.filter(isFullPage).map(parseFeedbackPage);
}

export async function queryExpenseClaims(filters?: {
  submitterNotionUserId?: string;
  status?: string;
}): Promise<ExpenseClaimRecord[]> {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const dataSourceId = process.env.NOTION_EXPENSE_CLAIM_DATASOURCE_ID;
  if (!dataSourceId) {
    throw new Error("NOTION_EXPENSE_CLAIM_DATASOURCE_ID is not configured");
  }

  const conditions: Array<Record<string, unknown>> = [];

  if (filters?.submitterNotionUserId) {
    conditions.push({
      property: "Submitted By",
      people: { contains: filters.submitterNotionUserId },
    });
  }
  if (filters?.status) {
    conditions.push({
      property: "Status",
      status: { equals: filters.status },
    });
  }

  const filter =
    conditions.length > 1
      ? { and: conditions }
      : conditions.length === 1
        ? conditions[0]
        : undefined;

  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: filter as Parameters<typeof notion.dataSources.query>[0]["filter"],
    sorts: [{ property: "Submission Date", direction: "descending" }],
    filter_properties: [
      "Claim Title",
      "Claim Description",
      "Amount",
      "Currency",
      "Expense Type",
      "Submission Date",
      "Status",
      "Submitted By",
    ],
    page_size: 20,
  });

  return response.results.filter(isFullPage).map(parseExpenseClaimPage);
}

export async function queryRecruitment(filters?: {
  positionApplied?: string;
  status?: string;
}): Promise<RecruitmentRecord[]> {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const dataSourceId = process.env.NOTION_RECRUITMENT_DATASOURCE_ID;
  if (!dataSourceId) {
    throw new Error("NOTION_RECRUITMENT_DATASOURCE_ID is not configured");
  }

  const conditions: Array<Record<string, unknown>> = [];

  if (filters?.positionApplied) {
    conditions.push({
      property: "Position Applied",
      select: { equals: filters.positionApplied },
    });
  }
  if (filters?.status) {
    conditions.push({
      property: "Status",
      status: { equals: filters.status },
    });
  }

  const filter =
    conditions.length > 1
      ? { and: conditions }
      : conditions.length === 1
        ? conditions[0]
        : undefined;

  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: filter as Parameters<typeof notion.dataSources.query>[0]["filter"],
    sorts: [{ timestamp: "created_time", direction: "descending" }],
    filter_properties: [
      "Candidate Name",
      "Position Applied",
      "Status",
      "Resume Source",
      "Email",
      "Phone",
      "Interview Time",
    ],
    page_size: 20,
  });

  return response.results.filter(isFullPage).map(parseRecruitmentPage);
}
