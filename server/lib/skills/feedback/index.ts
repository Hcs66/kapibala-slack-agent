import type { Skill } from "~/lib/skills/types";
import { feedbackPrompt } from "./prompt";
import { feedbackTools } from "./tools";

export const feedbackSkill: Skill = {
  name: "feedback",
  description: "Submit and query feedback, bug reports, feature requests",
  triggerPatterns: [
    "bug",
    "反馈",
    "feedback",
    "feature request",
    "改进",
    "问题",
    "提交.*bug",
    "提交.*反馈",
    "submit.*feedback",
    "report.*bug",
    "我的任务",
    "my tasks",
    "what are my tasks",
    "项目进度",
    "project status",
    "P0",
    "P1",
    "未处理.*反馈",
    "pending.*feedback",
    "unprocessed.*feedback",
  ],
  systemPrompt: feedbackPrompt,
  tools: feedbackTools,
  resources: [
    {
      type: "notion_database",
      name: "Feedback",
      envKey: "NOTION_FEEDBACK_DATASOURCE_ID",
    },
  ],
};
