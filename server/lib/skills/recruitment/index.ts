import type { Skill } from "~/lib/skills/types";
import { recruitmentPrompt } from "./prompt";
import { recruitmentTools } from "./tools";

export const recruitmentSkill: Skill = {
  name: "recruitment",
  description:
    "Submit and query candidates, recruitment pipeline, and pending reviews",
  triggerPatterns: [
    "candidate",
    "recruitment",
    "候选人",
    "招聘",
    "面试",
    "referral",
    "submit.*candidate",
    "new candidate",
    "hiring",
    "招聘进度",
    "recruitment pipeline",
    "pending candidates",
    "未处理.*候选人",
    "待面试",
    "interview",
  ],
  systemPrompt: recruitmentPrompt,
  tools: recruitmentTools,
  resources: [
    {
      type: "notion_database",
      name: "Recruitment",
      envKey: "NOTION_RECRUITMENT_DATASOURCE_ID",
    },
    {
      type: "slack_channel",
      name: "Recruitment",
      envKey: "SLACK_RECRUITMENT_CHANNEL_ID",
    },
  ],
};
