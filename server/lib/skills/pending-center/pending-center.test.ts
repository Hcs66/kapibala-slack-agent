import { describe, expect, it, vi } from "vitest";
import { routeByKeyword } from "~/lib/skills/router";
import { pendingCenterSkill } from "./index";

vi.mock("~/lib/notion/aggregation");

describe("pending-center skill routing", () => {
  it("matches '待处理' keyword", () => {
    const result = routeByKeyword("待处理", [pendingCenterSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("pending-center");
  });

  it("matches '待办' keyword", () => {
    const result = routeByKeyword("我的待办", [pendingCenterSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("pending-center");
  });

  it("matches 'what do I need to do'", () => {
    const result = routeByKeyword("what do I need to do today", [
      pendingCenterSkill,
    ]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("pending-center");
  });

  it("matches 'what's on my plate'", () => {
    const result = routeByKeyword("what's on my plate", [pendingCenterSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("pending-center");
  });

  it("matches 'pending' keyword", () => {
    const result = routeByKeyword("show me pending items", [
      pendingCenterSkill,
    ]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("pending-center");
  });

  it("matches '我今天要做什么'", () => {
    const result = routeByKeyword("我今天要做什么", [pendingCenterSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("pending-center");
  });

  it("matches 'dashboard'", () => {
    const result = routeByKeyword("show me the dashboard", [
      pendingCenterSkill,
    ]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("pending-center");
  });
});
