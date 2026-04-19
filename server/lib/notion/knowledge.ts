import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export interface PageContent {
  id: string;
  url: string;
  title: string;
  content: string;
}

function extractBlockText(block: BlockObjectResponse): string {
  const type = block.type;
  const data = block[type as keyof typeof block];
  if (
    data &&
    typeof data === "object" &&
    "rich_text" in data &&
    Array.isArray(data.rich_text)
  ) {
    return data.rich_text
      .map((t: { plain_text: string }) => t.plain_text)
      .join("");
  }
  return "";
}

export async function getPageContent(pageId: string): Promise<PageContent> {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();

  const page = await notion.pages.retrieve({ page_id: pageId });

  let title = "Untitled";
  let url = "";
  if ("properties" in page) {
    url = page.url;
    const titleProp = Object.values(page.properties).find(
      (p) => p.type === "title",
    );
    if (titleProp && titleProp.type === "title") {
      title = titleProp.title.map((t) => t.plain_text).join("");
    }
  }

  const blocks = await notion.blocks.children.list({
    block_id: pageId,
    page_size: 100,
  });

  const textParts: string[] = [];
  for (const block of blocks.results) {
    if ("type" in block) {
      const text = extractBlockText(block as BlockObjectResponse);
      if (text) textParts.push(text);
    }
  }

  return {
    id: pageId,
    url,
    title,
    content: textParts.join("\n"),
  };
}
