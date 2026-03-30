import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";

export interface DocData {
  docName: string;
  summary: string;
  category: string[];
  authorNotionUserId: string | null;
  content: string;
}

export async function createDoc(data: DocData) {
  const databaseId = process.env.NOTION_DOCS_DATABASE_ID;
  if (!databaseId) {
    throw new Error("NOTION_DOCS_DATABASE_ID is not configured");
  }

  const properties: CreatePageParameters["properties"] = {
    "Doc name": {
      title: [{ text: { content: data.docName } }],
    },
    Summary: {
      rich_text: [{ text: { content: data.summary } }],
    },
  };

  if (data.category.length > 0) {
    properties.Category = {
      multi_select: data.category.map((c) => ({ name: c })),
    };
  }

  if (data.authorNotionUserId) {
    properties.Author = {
      people: [{ id: data.authorNotionUserId }],
    };
  }

  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();

  // Split content into chunks of max 2000 characters for Notion blocks
  const contentChunks: string[] = [];
  let remaining = data.content;
  while (remaining.length > 0) {
    contentChunks.push(remaining.slice(0, 2000));
    remaining = remaining.slice(2000);
  }

  const children = contentChunks.map((chunk) => ({
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [{ type: "text" as const, text: { content: chunk } }],
    },
  }));

  const page = await notion.pages.create({
    parent: {
      database_id: databaseId,
    },
    properties,
    children,
  });

  return page;
}
