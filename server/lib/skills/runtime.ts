import { DurableAgent } from "@workflow/ai/agent";

import type { SlackAgentContextInput } from "~/lib/ai/context";
import { slackTools } from "~/lib/ai/tools";
import type { Skill } from "./types";

const BASE_RULES = `
## Core Rules
- Use multiple tool calls at once whenever possible.
- Never mention technical details like API parameters or IDs to the user.
- Respond in the same language the user uses. If they write in Chinese, respond in Chinese.
- Slack markdown doesn't support language tags in code blocks.
- Tag users with <@user_id> syntax, never just show the ID.
- Suggest next steps if needed; avoid unnecessary clarifying questions.
`;

export function buildSkillSystemPrompt(
  skill: Skill,
  context: SlackAgentContextInput,
): string {
  const { channel_id, dm_channel, thread_ts, is_dm, team_id } = context;

  const channelContextSection = channel_id
    ? `- The user is currently viewing channel: ${channel_id}. When the user says "this channel", they mean ${channel_id}.`
    : "- The user does not currently have a channel in view.";

  const joinChannelsSection = channel_id
    ? `- When the user asks to "join this channel", use joinChannel with channel_id="${channel_id}".`
    : `- When the user asks to join a channel, ask which channel. Use searchChannels to help find it.`;

  return `You are kTeam Agent, a friendly and professional assistant for the team's Slack workspace.
You are currently operating in "${skill.name}" mode: ${skill.description}

## Current Context
- You are ${is_dm ? "in a direct message" : "in a channel conversation"} with the user.
- Thread: ${thread_ts} in DM channel: ${dm_channel}
${channelContextSection}

## Fetching Context & Joining Channels
- If context is needed, always read the thread first → getThreadMessages.
- If thread messages don't answer the question → getChannelMessages.
${joinChannelsSection}
- Searching channels: use searchChannels with team_id="${team_id}".
${BASE_RULES}
${skill.systemPrompt}
`;
}

export function createSkillAgent(
  skill: Skill,
  context: SlackAgentContextInput,
): DurableAgent {
  return new DurableAgent({
    model: "minimax/minimax-m2.7-highspeed",
    system: buildSkillSystemPrompt(skill, context),
    tools: { ...slackTools, ...skill.tools },
  });
}
