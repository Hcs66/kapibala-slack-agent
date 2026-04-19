import type { Skill } from "~/lib/skills/types";
import { alertPrompt } from "./prompt";
import { alertTools } from "./tools";

export const alertSkill: Skill = {
  name: "alert",
  description: "Check overdue items and SLA violations across all modules",
  triggerPatterns: [
    "告警",
    "alert",
    "overdue",
    "超期",
    "SLA",
    "需要关注",
    "needs attention",
    "逾期",
    "过期",
    "待处理.*多久",
    "what needs attention",
    "什么.*超期",
  ],
  systemPrompt: alertPrompt,
  tools: alertTools,
};
