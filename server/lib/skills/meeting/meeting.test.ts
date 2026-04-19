import { describe, expect, it, vi } from "vitest";
import { routeByKeyword } from "~/lib/skills/router";
import { meetingSkill } from "./index";

vi.mock("~/lib/notion/docs");
vi.mock("~/lib/notion/tasks");
vi.mock("~/lib/ai/workflows/hooks");

describe("meeting skill routing", () => {
  it("matches '总结' keyword", () => {
    const result = routeByKeyword("帮我总结一下讨论", [meetingSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("meeting");
  });

  it("matches 'summarize' keyword", () => {
    const result = routeByKeyword("summarize this thread", [meetingSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("meeting");
  });

  it("matches '会议' keyword", () => {
    const result = routeByKeyword("会议纪要", [meetingSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("meeting");
  });

  it("matches 'action items' keyword", () => {
    const result = routeByKeyword("extract action items from this", [
      meetingSkill,
    ]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("meeting");
  });

  it("matches '纪要' keyword", () => {
    const result = routeByKeyword("生成纪要", [meetingSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("meeting");
  });

  it("matches 'notes' keyword", () => {
    const result = routeByKeyword("create meeting notes", [meetingSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("meeting");
  });

  it("matches '讨论' keyword", () => {
    const result = routeByKeyword("总结今天的讨论", [meetingSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("meeting");
  });

  it("matches 'extract tasks meeting' keyword", () => {
    const result = routeByKeyword("create tasks from this meeting", [
      meetingSkill,
    ]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("meeting");
  });

  it("matches '待办 提取' keyword", () => {
    const result = routeByKeyword("待办提取", [meetingSkill]);
    expect(result).not.toBeNull();
    expect(result?.skill.name).toBe("meeting");
  });
});

describe("meeting skill structure", () => {
  it("has required tools", () => {
    const toolNames = Object.keys(meetingSkill.tools);
    expect(toolNames).toContain("getThreadMessagesForSummary");
    expect(toolNames).toContain("saveDocToNotion");
    expect(toolNames).toContain("createTasksFromMeeting");
  });

  it("has Docs and Tasks resources", () => {
    const resourceNames = meetingSkill.resources?.map((r) => r.name) ?? [];
    expect(resourceNames).toContain("Docs");
    expect(resourceNames).toContain("Tasks");
  });

  it("has a system prompt mentioning action items", () => {
    expect(meetingSkill.systemPrompt).toContain("createTasksFromMeeting");
    expect(meetingSkill.systemPrompt).toContain("Action Item");
  });
});
