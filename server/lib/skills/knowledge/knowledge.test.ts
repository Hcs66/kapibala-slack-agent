import { describe, expect, it, vi } from "vitest";
import { routeByKeyword } from "~/lib/skills/router";
import { knowledgeSkill } from "./index";

vi.mock("~/lib/notion/knowledge");

describe("knowledge skill routing", () => {
  it("matches '知识库' keyword", () => {
    const result = routeByKeyword("搜索知识库", [knowledgeSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("knowledge");
  });

  it("matches '文档' keyword", () => {
    const result = routeByKeyword("有没有相关文档", [knowledgeSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("knowledge");
  });

  it("matches 'knowledge' keyword", () => {
    const result = routeByKeyword("search the knowledge base", [
      knowledgeSkill,
    ]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("knowledge");
  });

  it("matches '上次讨论' keyword", () => {
    const result = routeByKeyword("上次讨论的结果是什么", [knowledgeSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("knowledge");
  });

  it("matches 'find doc' keyword", () => {
    const result = routeByKeyword("find the doc about deployment", [
      knowledgeSkill,
    ]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("knowledge");
  });

  it("matches '查一下' keyword", () => {
    const result = routeByKeyword("帮我查一下之前的方案", [knowledgeSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("knowledge");
  });

  it("matches 'PRD' keyword", () => {
    const result = routeByKeyword("PRD在哪里", [knowledgeSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("knowledge");
  });

  it("matches '技术文档' keyword", () => {
    const result = routeByKeyword("有技术文档吗", [knowledgeSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("knowledge");
  });

  it("matches 'what do we know about' keyword", () => {
    const result = routeByKeyword("what do we know about the API design", [
      knowledgeSkill,
    ]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("knowledge");
  });

  it("matches '操作手册' keyword", () => {
    const result = routeByKeyword("有操作手册吗", [knowledgeSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("knowledge");
  });

  it("matches 'guide' keyword", () => {
    const result = routeByKeyword("is there a guide for onboarding", [
      knowledgeSkill,
    ]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("knowledge");
  });

  it("matches 'look up' keyword", () => {
    const result = routeByKeyword("look up the auth architecture", [
      knowledgeSkill,
    ]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("knowledge");
  });

  it("does not match unrelated messages", () => {
    const result = routeByKeyword("提交一个报销", [knowledgeSkill]);
    expect(result).toBeNull();
  });
});
