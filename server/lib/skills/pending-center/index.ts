import type { Skill } from "~/lib/skills/types";
import { pendingCenterPrompt } from "./prompt";
import { pendingCenterTools } from "./tools";

export const pendingCenterSkill: Skill = {
  name: "pending-center",
  description:
    "View all pending items across modules: expenses, recruitment, feedback, and tasks",
  triggerPatterns: [
    "pending",
    "待处理",
    "待办",
    "what.*do.*today",
    "what.*on.*plate",
    "what.*need.*do",
    "我.*要做什么",
    "今天.*做什么",
    "有什么.*要处理",
    "to.?do",
    "action items",
    "my items",
    "my pending",
    "overview",
    "dashboard",
    "总览",
  ],
  systemPrompt: pendingCenterPrompt,
  tools: pendingCenterTools,
};
