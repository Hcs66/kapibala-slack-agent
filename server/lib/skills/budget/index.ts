import type { Skill } from "~/lib/skills/types";
import { budgetPrompt } from "./prompt";
import { budgetTools } from "./tools";

export const budgetSkill: Skill = {
  name: "budget",
  description: "Manage budgets, add expenses, and query budget status",
  triggerPatterns: [
    "预算",
    "budget",
    "支出",
    "expense",
    "花费",
    "spending",
    "utilization",
    "更新.*预算",
    "update.*budget",
    "添加.*支出",
    "add.*expense",
    "查看.*预算",
    "query.*budget",
    "本月.*支出",
    "monthly.*spending",
  ],
  systemPrompt: budgetPrompt,
  tools: budgetTools,
  resources: [
    {
      type: "notion_database",
      name: "Budget",
      envKey: "NOTION_BUDGET_DATASOURCE_ID",
    },
    {
      type: "notion_database",
      name: "Expenses",
      envKey: "NOTION_EXPENSES_DATASOURCE_ID",
    },
  ],
};
