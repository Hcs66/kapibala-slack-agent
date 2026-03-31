import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

function isFullPage(page: unknown): page is PageObjectResponse {
  return (
    typeof page === "object" &&
    page !== null &&
    "properties" in page &&
    "url" in page
  );
}

export async function findMonthByName(
  monthName: string,
): Promise<{ id: string; month: string } | null> {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();
  const dataSourceId = process.env.NOTION_MONTH_DATASOURCE_ID;
  if (!dataSourceId) {
    throw new Error("NOTION_MONTH_DATASOURCE_ID is not configured");
  }

  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: {
      property: "Month",
      title: { equals: monthName },
    } as Parameters<typeof notion.dataSources.query>[0]["filter"],
    page_size: 1,
  });

  const pages = response.results.filter(isFullPage);
  if (pages.length === 0) return null;

  const page = pages[0];
  const monthProp = page.properties.Month;
  const title =
    monthProp.type === "title"
      ? monthProp.title.map((t) => t.plain_text).join("")
      : "";

  return { id: page.id, month: title };
}

export function getCurrentMonthName(): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();
  return `${month} ${year}`;
}
