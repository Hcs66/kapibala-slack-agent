import type { Skill } from "~/lib/skills/types";
import { taskPrompt } from "./prompt";
import { taskTools } from "./tools";

export const taskSkill: Skill = {
  name: "task",
  description: "Create, update, and track tasks with progress reports",
  triggerPatterns: [
    "创建.*任务",
    "create.*task",
    "assign.*task",
    "更新.*任务",
    "update.*task",
    "任务.*进度",
    "生成.*进度",
    "progress.*report",
    "task.*progress",
    "任务",
    "task",
  ],
  systemPrompt: taskPrompt,
  tools: taskTools,
  resources: [
    {
      type: "notion_database",
      name: "Tasks",
      envKey: "NOTION_TASKS_DATASOURCE_ID",
    },
  ],
};
