import { describe, expect, it } from "vitest";

import {
  buildClassificationPrompt,
  parseClassificationResponse,
  routeByKeyword,
} from "./router";
import type { Skill } from "./types";

function makeSkill(overrides: Partial<Skill>): Skill {
  return {
    name: "test",
    description: "test skill",
    triggerPatterns: [],
    systemPrompt: "",
    tools: {},
    ...overrides,
  };
}

describe("routeByKeyword", () => {
  const feedbackSkill = makeSkill({
    name: "feedback",
    triggerPatterns: ["bug", "反馈", "feedback", "feature request"],
  });
  const expenseSkill = makeSkill({
    name: "expense",
    triggerPatterns: ["报销", "expense", "reimbursement", "报销.*审批"],
  });
  const taskSkill = makeSkill({
    name: "task",
    triggerPatterns: ["创建.*任务", "create.*task", "任务"],
  });
  const skills = [feedbackSkill, expenseSkill, taskSkill];

  it("matches simple keyword", () => {
    const result = routeByKeyword("I found a bug in the login page", skills);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("feedback");
  });

  it("matches Chinese keyword", () => {
    const result = routeByKeyword("我要报销上周打车费", skills);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("expense");
  });

  it("matches regex pattern", () => {
    const result = routeByKeyword("创建一个任务给小明", skills);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("task");
  });

  it("returns null when no match", () => {
    const result = routeByKeyword("hello how are you", skills);
    expect(result).toBeNull();
  });

  it("handles empty skills array", () => {
    const result = routeByKeyword("bug report", []);
    expect(result).toBeNull();
  });

  it("handles empty message", () => {
    const result = routeByKeyword("", skills);
    expect(result).toBeNull();
  });

  it("is case insensitive", () => {
    const result = routeByKeyword("FEEDBACK about the app", skills);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("feedback");
  });
});

describe("buildClassificationPrompt", () => {
  it("includes all skill descriptions", () => {
    const skills = [
      makeSkill({ name: "feedback", description: "Handle feedback" }),
      makeSkill({ name: "expense", description: "Handle expenses" }),
    ];
    const prompt = buildClassificationPrompt("test message", skills);
    expect(prompt).toContain('"feedback": Handle feedback');
    expect(prompt).toContain('"expense": Handle expenses');
    expect(prompt).toContain("general");
    expect(prompt).toContain("test message");
  });
});

describe("parseClassificationResponse", () => {
  const skills = [
    makeSkill({ name: "feedback" }),
    makeSkill({ name: "expense" }),
  ];

  it("parses exact match", () => {
    const result = parseClassificationResponse("feedback", skills);
    expect(result?.name).toBe("feedback");
  });

  it("parses with quotes", () => {
    const result = parseClassificationResponse('"expense"', skills);
    expect(result?.name).toBe("expense");
  });

  it("parses with whitespace", () => {
    const result = parseClassificationResponse("  feedback  ", skills);
    expect(result?.name).toBe("feedback");
  });

  it("returns null for general", () => {
    const result = parseClassificationResponse("general", skills);
    expect(result).toBeNull();
  });

  it("returns null for unknown skill", () => {
    const result = parseClassificationResponse("unknown", skills);
    expect(result).toBeNull();
  });
});
