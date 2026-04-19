import type { Tool } from "ai";

export interface SkillResource {
  type: "notion_database" | "slack_channel" | "env_var";
  name: string;
  envKey: string;
}

export interface Skill {
  name: string;
  description: string;
  triggerPatterns: string[];
  systemPrompt: string;
  tools: Record<string, Tool>;
  resources?: SkillResource[];
}
