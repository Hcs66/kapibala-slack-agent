import type { Skill } from "~/lib/skills/types";
import { expensePrompt } from "./prompt";
import { expenseTools } from "./tools";

export const expenseSkill: Skill = {
  name: "expense",
  description: "Submit and query expense claims, approvals, and payouts",
  triggerPatterns: [
    "expense",
    "reimbursement",
    "报销",
    "审批",
    "付款",
    "待审批",
    "待付款",
    "submit.*expense",
    "submit.*reimbursement",
    "expense claim",
    "pending approvals",
    "pending.*expense",
    "awaiting payment",
    "project status",
    "费用",
  ],
  systemPrompt: expensePrompt,
  tools: expenseTools,
  resources: [
    {
      type: "notion_database",
      name: "Expense Claims",
      envKey: "NOTION_EXPENSE_CLAIMS_DATASOURCE_ID",
    },
    {
      type: "slack_channel",
      name: "Approvals",
      envKey: "SLACK_APPROVALS_CHANNEL_ID",
    },
  ],
};
