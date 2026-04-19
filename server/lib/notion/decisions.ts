import type {
  CreatePageParameters,
  UpdatePageParameters,
} from "@notionhq/client/build/src/api-endpoints";

export interface DecisionData {
  title: string;
  content: string;
  reason: string;
  decisionMakerNotionUserId: string | null;
  impactScope: string[];
  priority: string;
  category: string;
  date: string;
  followUpTaskIds?: string[];
}

export async function createDecision(data: DecisionData) {
  const databaseId = process.env.NOTION_DECISIONS_DATABASE_ID;
  if (!databaseId) {
    throw new Error("NOTION_DECISIONS_DATABASE_ID is not configured");
  }

  const properties: CreatePageParameters["properties"] = {
    "Decision Title": {
      title: [{ text: { content: data.title } }],
    },
    "Decision Content": {
      rich_text: [{ text: { content: data.content } }],
    },
    Reason: {
      rich_text: [{ text: { content: data.reason } }],
    },
    Priority: {
      select: { name: data.priority },
    },
    Category: {
      select: { name: data.category },
    },
    Date: {
      date: { start: data.date },
    },
  };

  if (data.decisionMakerNotionUserId) {
    properties["Decision Maker"] = {
      people: [{ id: data.decisionMakerNotionUserId }],
    };
  }

  if (data.impactScope.length > 0) {
    properties["Impact Scope"] = {
      multi_select: data.impactScope.map((s) => ({ name: s })),
    };
  }

  if (data.followUpTaskIds && data.followUpTaskIds.length > 0) {
    properties["Follow-up Actions"] = {
      relation: data.followUpTaskIds.map((id) => ({ id })),
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

export async function updateDecisionStatus(
  pageId: string,
  status: "Proposed" | "Confirmed" | "Superseded",
) {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();

  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: {
        status: { name: status },
      },
    },
  });
}

export async function linkDecisionToTasks(
  pageId: string,
  taskPageIds: string[],
) {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();

  const properties: UpdatePageParameters["properties"] = {
    "Follow-up Actions": {
      relation: taskPageIds.map((id) => ({ id })),
    },
  };

  await notion.pages.update({
    page_id: pageId,
    properties,
  });
}
