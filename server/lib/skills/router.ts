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

export function routeToSkill(
  userMessage: string,
  skills: Skill[],
): RouteResult {
  if (skills.length === 0) {
    throw new Error("No skills registered");
  }

  const keywordResult = routeByKeyword(userMessage, skills);
  if (keywordResult && keywordResult.confidence >= 0.1) {
    return keywordResult;
  }

  const descriptionResult = routeByDescription(userMessage, skills);
  if (descriptionResult) {
    return descriptionResult;
  }

  return { skill: skills[0], confidence: 0.1 };
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
