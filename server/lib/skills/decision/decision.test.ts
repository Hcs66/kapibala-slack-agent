import { describe, expect, it, vi } from "vitest";
import { routeByKeyword } from "~/lib/skills/router";
import { decisionSkill } from "./index";

vi.mock("~/lib/notion/decisions");
vi.mock("~/lib/notion/query");

describe("decision skill routing", () => {
  it("matches '决策' keyword", () => {
    const result = routeByKeyword("记录一个决策", [decisionSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("decision");
  });

  it("matches '决定' keyword", () => {
    const result = routeByKeyword("我们决定用方案A", [decisionSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("decision");
  });

  it("matches 'decision' keyword", () => {
    const result = routeByKeyword("record a decision", [decisionSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("decision");
  });

  it("matches 'we decided' keyword", () => {
    const result = routeByKeyword("we decided to use React", [decisionSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("decision");
  });

  it("matches '结论' keyword", () => {
    const result = routeByKeyword("讨论的结论是什么", [decisionSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("decision");
  });

  it("matches '敲定' keyword", () => {
    const result = routeByKeyword("敲定了技术方案", [decisionSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("decision");
  });

  it("matches '历史决策' keyword", () => {
    const result = routeByKeyword("查看历史决策", [decisionSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("decision");
  });

  it("matches 'what did we decide' keyword", () => {
    const result = routeByKeyword("what did we decide about the API", [
      decisionSkill,
    ]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("decision");
  });

  it("matches '谁决定' keyword", () => {
    const result = routeByKeyword("谁决定了这个方案", [decisionSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("decision");
  });

  it("matches 'who decided' keyword", () => {
    const result = routeByKeyword("who decided on the architecture", [
      decisionSkill,
    ]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("decision");
  });
});
