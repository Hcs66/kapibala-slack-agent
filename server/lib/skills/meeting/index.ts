import type { Skill } from "~/lib/skills/types";
import { meetingPrompt } from "./prompt";
import { meetingTools } from "./tools";

export const meetingSkill: Skill = {
  name: "meeting",
  description:
    "Summarize discussions, create meeting notes, extract action items as tasks, and save documents to Notion",
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
    "action items",
    "待办.*提取",
    "extract.*tasks",
    "保存.*文档",
    "save.*doc",
    "创建.*任务.*会议",
    "create.*tasks.*meeting",
  ],
  systemPrompt: meetingPrompt,
  tools: meetingTools,
  resources: [
    {
      type: "notion_database",
      name: "Docs",
      envKey: "NOTION_DOCS_DATASOURCE_ID",
    },
    {
      type: "notion_database",
      name: "Tasks",
      envKey: "NOTION_TASKS_DATASOURCE_ID",
    },
  ],
};
