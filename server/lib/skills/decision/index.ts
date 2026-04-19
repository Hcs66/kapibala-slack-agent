import type { Skill } from "~/lib/skills/types";
import { decisionPrompt } from "./prompt";
import { decisionTools } from "./tools";

export const decisionSkill: Skill = {
  name: "decision",
  description:
    "Record organizational decisions, query decision history, and create follow-up tasks",
  triggerPatterns: [
    "决策",
    "决定",
    "decision",
    "decide",
    "记录.*决策",
    "record.*decision",
    "我们决定",
    "we decided",
    "结论",
    "conclusion",
    "定了",
    "敲定",
    "拍板",
    "历史决策",
    "past.*decision",
    "what.*decide",
    "谁决定",
    "who.*decided",
  ],
  systemPrompt: decisionPrompt,
  tools: decisionTools,
  resources: [
    {
      type: "notion_database",
      name: "Decisions",
      envKey: "NOTION_DECISIONS_DATASOURCE_ID",
    },
  ],
};
