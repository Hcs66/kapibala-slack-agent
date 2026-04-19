import { DurableAgent } from "@workflow/ai/agent";
import { getAllSkills } from "~/lib/skills/registry";
import { routeToSkill } from "~/lib/skills/router";
import { buildSkillSystemPrompt } from "~/lib/skills/runtime";
import type { SlackAgentContextInput } from "./context";
import { slackTools } from "./tools";

const GENERAL_PROMPT = `You are kTeam Agent, a friendly and professional assistant for the team's Slack workspace.
You help with general questions and can guide users to the right capabilities.

If the user's request doesn't match a specific skill, respond helpfully with general knowledge.
If you think the user might need a specific capability (feedback, expense, recruitment, task, meeting, budget, alert), suggest it.
`;

export function createGeneralAgent(
  context: SlackAgentContextInput,
): DurableAgent {
  const { channel_id, dm_channel, thread_ts, is_dm, team_id } = context;

  const channelContextSection = channel_id
    ? `- The user is currently viewing channel: ${channel_id}. When the user says "this channel", they mean ${channel_id}.`
    : "- The user does not currently have a channel in view.";

  const joinChannelsSection = channel_id
    ? `- When the user asks to "join this channel", use joinChannel with channel_id="${channel_id}".`
    : `- When the user asks to join a channel, ask which channel. Use searchChannels to help find it.`;

  return new DurableAgent({
    model: "minimax/minimax-m2.7-highspeed",
    system: `${GENERAL_PROMPT}

## Current Context
- You are ${is_dm ? "in a direct message" : "in a channel conversation"} with the user.
- Thread: ${thread_ts} in DM channel: ${dm_channel}
${channelContextSection}

## Fetching Context & Joining Channels
- If context is needed, always read the thread first → getThreadMessages.
- If thread messages don't answer the question → getChannelMessages.
${joinChannelsSection}
- Searching channels: use searchChannels with team_id="${team_id}".

## Core Rules
- Use multiple tool calls at once whenever possible.
- Never mention technical details like API parameters or IDs to the user.
- Respond in the same language the user uses. If they write in Chinese, respond in Chinese.
- Slack markdown doesn't support language tags in code blocks.
- Tag users with <@user_id> syntax, never just show the ID.
- Suggest next steps if needed; avoid unnecessary clarifying questions.
`,
    tools: { ...slackTools },
  });
}

export function createSkillAgent(
  skillName: string,
  context: SlackAgentContextInput,
): DurableAgent {
  const skills = getAllSkills();
  const skill = skills.find((s) => s.name === skillName);

  if (!skill) {
    return createGeneralAgent(context);
  }

  return new DurableAgent({
    model: "minimax/minimax-m2.7-highspeed",
    system: buildSkillSystemPrompt(skill, context),
    tools: { ...slackTools, ...skill.tools },
  });
}

export async function routeAndCreateAgent(
  userMessage: string,
  context: SlackAgentContextInput,
  allUserMessages?: string[],
): Promise<{ agent: DurableAgent; skillName: string }> {
  const skills = getAllSkills();

  if (skills.length === 0) {
    return { agent: createGeneralAgent(context), skillName: "general" };
  }

  try {
    const { skill, confidence } = await routeToSkill(userMessage, skills);
    const isDefaultFallback = confidence === 0;

    if (!isDefaultFallback) {
      return {
        agent: createSkillAgent(skill.name, context),
        skillName: skill.name,
      };
    }

    // Latest message didn't match any skill (e.g. "确认", "好的", "ok") —
    // check earlier messages in the thread for skill context
    if (allUserMessages && allUserMessages.length > 1) {
      for (let i = allUserMessages.length - 2; i >= 0; i--) {
        const historyResult = await routeToSkill(allUserMessages[i], skills);
        if (historyResult.confidence > 0) {
          return {
            agent: createSkillAgent(historyResult.skill.name, context),
            skillName: historyResult.skill.name,
          };
        }
      }
    }

    return {
      agent: createSkillAgent(skill.name, context),
      skillName: skill.name,
    };
  } catch (error) {
    console.warn("Skill routing failed, falling back to general agent:", error);
    return { agent: createGeneralAgent(context), skillName: "general" };
  }
}
