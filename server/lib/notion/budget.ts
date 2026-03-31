import type { UpdatePageParameters } from "@notionhq/client/build/src/api-endpoints";

export async function updateBudgetAmount(
  pageId: string,
  monthlyBudget: number,
) {
  const { getNotionClient } = await import("~/lib/notion/client");
  const notion = getNotionClient();

  const properties: UpdatePageParameters["properties"] = {
    "Monthly Budget": {
      number: monthlyBudget,
    },
  };

  await notion.pages.update({
    page_id: pageId,
    properties,
  });
}
