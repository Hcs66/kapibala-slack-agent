import type { Skill } from "~/lib/skills/types";
import { meetingPrompt } from "./prompt";
import { meetingTools } from "./tools";

export const meetingSkill: Skill = {
  name: "meeting",
  description:
    "Summarize discussions, create meeting notes, and save documents to Notion",
  triggerPatterns: [
    "总结",
    "summarize",
    "summary",
    "meeting",
    "讨论",
    "discussion",
    "纪要",
    "notes",
    "会议",
    "决策",
    "decisions",
    "action items",
    "保存.*文档",
    "save.*doc",
  ],
  systemPrompt: meetingPrompt,
  tools: meetingTools,
  resources: [
    {
      type: "notion_database",
      name: "Docs",
      envKey: "NOTION_DOCS_DATASOURCE_ID",
    },
  ],
};
