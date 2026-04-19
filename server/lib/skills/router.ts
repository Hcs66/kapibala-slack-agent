import { generateText } from "ai";
import type { Skill } from "./types";

export interface RouteResult {
  skill: Skill;
  confidence: number;
}

export function routeByKeyword(
  userMessage: string,
  skills: Skill[],
): RouteResult | null {
  const normalized = userMessage.toLowerCase();

  let bestMatch: RouteResult | null = null;

  for (const skill of skills) {
    for (const pattern of skill.triggerPatterns) {
      const regex = new RegExp(pattern, "i");
      if (regex.test(normalized)) {
        const confidence = pattern.length / normalized.length;
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { skill, confidence: Math.min(confidence, 1) };
        }
      }
    }
  }

  return bestMatch;
}

export function buildClassificationPrompt(
  userMessage: string,
  skills: Skill[],
): string {
  const skillDescriptions = skills
    .map((s) => `- "${s.name}": ${s.description}`)
    .join("\n");

  return `You are a skill router. Given the user message, determine which skill should handle it.

Available skills:
${skillDescriptions}
- "general": General conversation, greetings, or questions that don't match any specific skill.

User message: "${userMessage}"

Respond with ONLY the skill name (e.g. "feedback", "expense", "general"). Nothing else.`;
}

export function parseClassificationResponse(
  response: string,
  skills: Skill[],
): Skill | null {
  const cleaned = response.trim().toLowerCase().replace(/['"]/g, "");
  return skills.find((s) => s.name === cleaned) ?? null;
}

export async function routeByLLM(
  userMessage: string,
  skills: Skill[],
): Promise<RouteResult | null> {
  try {
    const prompt = buildClassificationPrompt(userMessage, skills);

    const result = await generateText({
      model: "minimax/minimax-m2.7-highspeed",
      prompt,
      maxOutputTokens: 20,
      temperature: 0,
    });

    const skillName = result.text.trim().toLowerCase().replace(/['"]/g, "");
    const skill = skills.find((s) => s.name === skillName);

    if (skill) {
      return { skill, confidence: 0.8 };
    }

    return null;
  } catch (error) {
    console.error("LLM routing failed:", error);
    return null;
  }
}

export async function routeToSkill(
  userMessage: string,
  skills: Skill[],
): Promise<RouteResult> {
  if (skills.length === 0) {
    throw new Error("No skills registered");
  }

  // Fast path: any keyword match → use it directly (no LLM call needed)
  const keywordResult = routeByKeyword(userMessage, skills);
  if (keywordResult) {
    return keywordResult;
  }

  // No keyword matched → ask LLM to classify
  const llmResult = await routeByLLM(userMessage, skills);
  if (llmResult) {
    return llmResult;
  }

  // LLM failed → try description matching
  const descriptionResult = routeByDescription(userMessage, skills);
  if (descriptionResult) {
    return descriptionResult;
  }

  return { skill: skills[0], confidence: 0 };
}

function routeByDescription(
  userMessage: string,
  skills: Skill[],
): RouteResult | null {
  const normalized = userMessage.toLowerCase();
  let bestMatch: RouteResult | null = null;

  for (const skill of skills) {
    const descWords = skill.description.toLowerCase().split(/\s+/);
    const matchCount = descWords.filter(
      (w) => w.length > 3 && normalized.includes(w),
    ).length;
    if (matchCount > 0) {
      const confidence = matchCount / descWords.length;
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { skill, confidence: Math.min(confidence, 0.7) };
      }
    }
  }

  return bestMatch;
}
