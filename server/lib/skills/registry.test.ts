import { afterEach, describe, expect, it } from "vitest";

import { clearSkills, getAllSkills, getSkill, registerSkill } from "./registry";
import type { Skill } from "./types";

function makeSkill(name: string): Skill {
  return {
    name,
    description: `${name} skill`,
    triggerPatterns: [],
    systemPrompt: "",
    tools: {},
  };
}

describe("registry", () => {
  afterEach(() => {
    clearSkills();
  });

  it("registers and retrieves a skill", () => {
    const skill = makeSkill("feedback");
    registerSkill(skill);
    expect(getSkill("feedback")).toBe(skill);
  });

  it("returns undefined for unregistered skill", () => {
    expect(getSkill("nonexistent")).toBeUndefined();
  });

  it("returns all registered skills", () => {
    registerSkill(makeSkill("feedback"));
    registerSkill(makeSkill("expense"));
    registerSkill(makeSkill("task"));
    const all = getAllSkills();
    expect(all).toHaveLength(3);
    expect(all.map((s) => s.name)).toEqual(["feedback", "expense", "task"]);
  });

  it("overwrites skill with same name", () => {
    const original = makeSkill("feedback");
    const updated = { ...makeSkill("feedback"), description: "updated" };
    registerSkill(original);
    registerSkill(updated);
    expect(getSkill("feedback")?.description).toBe("updated");
    expect(getAllSkills()).toHaveLength(1);
  });

  it("clears all skills", () => {
    registerSkill(makeSkill("feedback"));
    registerSkill(makeSkill("expense"));
    clearSkills();
    expect(getAllSkills()).toHaveLength(0);
  });
});
