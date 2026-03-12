import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";
import { notion } from "./client";

export interface FeedbackData {
  name: string;
  type: string;
  description: string;
  summary: string;
  priority: string;
  source: string;
  customer: string;
  assignedToNotionUserId: string | null;
  createdByNotionUserId: string | null;
  dueDate: string | null;
  tags: string[];
}

export async function createFeedback(data: FeedbackData) {
  const databaseId = process.env.NOTION_FEEDBACK_DATABASE_ID;
  if (!databaseId) {
    throw new Error("NOTION_FEEDBACK_DATABASE_ID is not configured");
  }

  const properties: CreatePageParameters["properties"] = {
    Name: {
      title: [{ text: { content: data.name } }],
    },
    Type: {
      select: { name: data.type },
    },
    Description: {
      rich_text: [{ text: { content: data.description } }],
    },
    Summary: {
      rich_text: [{ text: { content: data.summary } }],
    },
    Priority: {
      select: { name: data.priority },
    },
    Source: {
      select: { name: data.source },
    },
    Customer: {
      rich_text: [{ text: { content: data.customer } }],
    },
    "Created Date": {
      date: { start: new Date().toISOString().split("T")[0] },
    },
  };

  if (data.assignedToNotionUserId) {
    properties["Assigned To"] = {
      people: [{ id: data.assignedToNotionUserId }],
    };
  }

  if (data.createdByNotionUserId) {
    properties["Created By"] = {
      people: [{ id: data.createdByNotionUserId }],
    };
  }

  if (data.dueDate) {
    properties["Due Date"] = {
      date: { start: data.dueDate },
    };
  }

  if (data.tags.length > 0) {
    properties.Tags = {
      multi_select: data.tags.map((tag) => ({ name: tag })),
    };
  }

  const page = await notion.pages.create({
    parent: {
      database_id: databaseId,
    },
    properties,
  });

  return page;
}
