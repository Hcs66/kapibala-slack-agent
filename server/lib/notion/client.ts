import { Client } from "@notionhq/client";

let _notion: Client | null = null;

export function getNotionClient(): Client {
  if (!_notion) {
    _notion = new Client({
      auth: process.env.NOTION_KEY,
    });
  }
  return _notion;
}
