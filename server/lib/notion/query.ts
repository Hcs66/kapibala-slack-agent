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

export interface TaskRecord {
  id: string;
  url: string;
  name: string;
  taskNum: string;
  status: string | null;
  priority: string | null;
  description: string;
  summary: string;
  log: string;
  assignee: Array<{ id: string; name: string | null }>;
  dueDate: string | null;
  updatedAt: string | null;
}

export interface DecisionRecord {
  id: string;
  url: string;
  title: string;
  content: string;
  reason: string;
  decisionMaker: Array<{ id: string; name: string | null }>;
  impactScope: string[];
  priority: string | null;
  status: string | null;
  category: string | null;
  date: string | null;
  createdAt: string | null;
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
    status: extractStatus(p["Status"]) ?? extractSelect(p["Status"]) ?? null,
    resumeSource: extractSelect(p["Resume Source"]),
    email: extractEmail(p.Email),
    phone: extractPhone(p.Phone),
    interviewTime: extractDate(p["Interview Time"]),
  };
}

export function parseTaskPage(page: PageObjectResponse): TaskRecord {
  const p = page.properties;
  return {
    id: page.id,
    url: page.url,
    name: extractTitle(p.Name),
    taskNum: extractRichText(p["Task Num"]),
    status: extractStatus(p.Status) ?? extractSelect(p.Status) ?? null,
    priority: extractSelect(p.Priority),
    description: extractRichText(p.Description),
    summary: extractRichText(p.Summary),
    log: extractRichText(p.Log),
    assignee: extractPeople(p.Assignee),
    dueDate: extractDate(p["Due date"]),
    updatedAt: page.last_edited_time,
  };
}

export function parseDecisionPage(page: PageObjectResponse): DecisionRecord {
  const p = page.properties;
  return {
    id: page.id,
    url: page.url,
    title: extractTitle(p["Decision Title"]),
    content: extractRichText(p["Decision Content"]),
    reason: extractRichText(p.Reason),
    decisionMaker: extractPeople(p["Decision Maker"]),
    impactScope: extractMultiSelect(p["Impact Scope"]),
    priority: extractSelect(p.Priority),
    status: extractStatus(p.Status) ?? extractSelect(p.Status) ?? null,
    category: extractSelect(p.Category),
    date: extractDate(p.Date),
    createdAt: page.created_time,
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

export async function queryTasks(filters?: {
  assigneeNotionUserId?: string;
  status?: string;
  priority?: string;
  updatedAfter?: string;
}): Promise<TaskRecord[]> {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const dataSourceId = process.env.NOTION_TASKS_DATASOURCE_ID;
  if (!dataSourceId) {
    throw new Error("NOTION_TASKS_DATASOURCE_ID is not configured");
  }

  const conditions: Array<Record<string, unknown>> = [];

  if (filters?.assigneeNotionUserId) {
    conditions.push({
      property: "Assignee",
      people: { contains: filters.assigneeNotionUserId },
    });
  }
  if (filters?.status) {
    conditions.push({
      property: "Status",
      status: { equals: filters.status },
    });
  }
  if (filters?.priority) {
    conditions.push({
      property: "Priority",
      select: { equals: filters.priority },
    });
  }
  if (filters?.updatedAfter) {
    conditions.push({
      timestamp: "last_edited_time",
      last_edited_time: { on_or_after: filters.updatedAfter },
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
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    filter_properties: [
      "Name",
      "Task Num",
      "Status",
      "Priority",
      "Description",
      "Summary",
      "Log",
      "Assignee",
      "Due date",
    ],
    page_size: 50,
  });

  return response.results.filter(isFullPage).map(parseTaskPage);
}

export async function findTaskByNum(
  taskNum: string,
): Promise<TaskRecord | null> {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const dataSourceId = process.env.NOTION_TASKS_DATASOURCE_ID;
  if (!dataSourceId) {
    throw new Error("NOTION_TASKS_DATASOURCE_ID is not configured");
  }

  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: {
      property: "Task Num",
      rich_text: { equals: taskNum },
    } as Parameters<typeof notion.dataSources.query>[0]["filter"],
    filter_properties: [
      "Name",
      "Task Num",
      "Status",
      "Priority",
      "Description",
      "Summary",
      "Log",
      "Assignee",
      "Due date",
    ],
    page_size: 1,
  });

  const pages = response.results.filter(isFullPage);
  return pages.length > 0 ? parseTaskPage(pages[0]) : null;
}

export interface BudgetRecord {
  id: string;
  url: string;
  category: string;
  monthlyBudget: number | null;
}

export function parseBudgetPage(page: PageObjectResponse): BudgetRecord {
  const p = page.properties;
  return {
    id: page.id,
    url: page.url,
    category: extractTitle(p.Categories),
    monthlyBudget: extractNumber(p["Monthly Budget"]),
  };
}

export async function queryBudgets(filters?: {
  category?: string;
}): Promise<BudgetRecord[]> {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const dataSourceId = process.env.NOTION_BUDGET_DATASOURCE_ID;
  if (!dataSourceId) {
    throw new Error("NOTION_BUDGET_DATASOURCE_ID is not configured");
  }

  const conditions: Array<Record<string, unknown>> = [];

  if (filters?.category) {
    conditions.push({
      property: "Categories",
      title: { equals: filters.category },
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
    filter_properties: ["Categories", "Monthly Budget"],
    page_size: 50,
  });

  return response.results.filter(isFullPage).map(parseBudgetPage);
}

export async function findBudgetByCategory(
  category: string,
): Promise<BudgetRecord | null> {
  // Try exact match first
  const exactMatch = await queryBudgets({ category });
  if (exactMatch.length > 0) return exactMatch[0];

  // Fuzzy match: query all budgets and find best match
  const allBudgets = await queryBudgets();
  const needle = category.toLowerCase();

  // 1. Category contains the search term (e.g. "Equipment Purchases" contains "Equipment")
  const containsMatch = allBudgets.find((b) =>
    b.category.toLowerCase().includes(needle),
  );
  if (containsMatch) return containsMatch;

  // 2. Search term contains the category (e.g. "Equipment and Supplies" contains "Equipment")
  const reverseMatch = allBudgets.find((b) =>
    needle.includes(b.category.toLowerCase()),
  );
  if (reverseMatch) return reverseMatch;

  // 3. Any word overlap
  const needleWords = needle.split(/\s+/);
  const wordMatch = allBudgets.find((b) => {
    const catWords = b.category.toLowerCase().split(/\s+/);
    return needleWords.some((w) =>
      catWords.some((cw) => cw.includes(w) || w.includes(cw)),
    );
  });
  if (wordMatch) return wordMatch;

  return null;
}

export interface ExpenseRecord {
  id: string;
  url: string;
  expense: string;
  amount: number | null;
  date: string | null;
}

export function parseExpensePage(page: PageObjectResponse): ExpenseRecord {
  const p = page.properties;
  return {
    id: page.id,
    url: page.url,
    expense: extractTitle(p.Expense),
    amount: extractNumber(p.Amount),
    date: extractDate(p.Date),
  };
}

export async function queryExpenses(filters?: {
  budgetPageId?: string;
  monthPageId?: string;
}): Promise<ExpenseRecord[]> {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const dataSourceId = process.env.NOTION_EXPENSES_DATASOURCE_ID;
  if (!dataSourceId) {
    throw new Error("NOTION_EXPENSES_DATASOURCE_ID is not configured");
  }

  const conditions: Array<Record<string, unknown>> = [];

  if (filters?.budgetPageId) {
    conditions.push({
      property: "Budget",
      relation: { contains: filters.budgetPageId },
    });
  }
  if (filters?.monthPageId) {
    conditions.push({
      property: "Month Classification",
      relation: { contains: filters.monthPageId },
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
    sorts: [{ property: "Date", direction: "descending" }],
    filter_properties: ["Expense", "Amount", "Date"],
    page_size: 100,
  });

  return response.results.filter(isFullPage).map(parseExpensePage);
}

export async function queryDecisions(filters?: {
  category?: string;
  status?: string;
  decisionMakerNotionUserId?: string;
  keyword?: string;
  afterDate?: string;
}): Promise<DecisionRecord[]> {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const dataSourceId = process.env.NOTION_DECISIONS_DATASOURCE_ID;
  if (!dataSourceId) {
    throw new Error("NOTION_DECISIONS_DATASOURCE_ID is not configured");
  }

  const conditions: Array<Record<string, unknown>> = [];

  if (filters?.category) {
    conditions.push({
      property: "Category",
      select: { equals: filters.category },
    });
  }
  if (filters?.status) {
    conditions.push({
      property: "Status",
      status: { equals: filters.status },
    });
  }
  if (filters?.decisionMakerNotionUserId) {
    conditions.push({
      property: "Decision Maker",
      people: { contains: filters.decisionMakerNotionUserId },
    });
  }
  if (filters?.keyword) {
    conditions.push({
      property: "Decision Title",
      title: { contains: filters.keyword },
    });
  }
  if (filters?.afterDate) {
    conditions.push({
      property: "Date",
      date: { on_or_after: filters.afterDate },
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
    sorts: [{ property: "Date", direction: "descending" }],
    filter_properties: [
      "Decision Title",
      "Decision Content",
      "Reason",
      "Decision Maker",
      "Impact Scope",
      "Priority",
      "Status",
      "Category",
      "Date",
    ],
    page_size: 20,
  });

  return response.results.filter(isFullPage).map(parseDecisionPage);
}
