import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUsersInfo = vi.fn();
const mockChatPostMessage = vi.fn();

vi.mock("@slack/web-api", () => ({
  WebClient: class {
    users = { info: mockUsersInfo };
    chat = { postMessage: mockChatPostMessage };
  },
}));

vi.mock("~/lib/notion/feedback", () => ({
  createFeedback: vi.fn(),
}));

vi.mock("~/lib/notion/user-map", () => ({
  findNotionUser: vi.fn(),
}));

import { createFeedback } from "~/lib/notion/feedback";
import { findNotionUser } from "~/lib/notion/user-map";
import { notionTools } from "./notion";

const mockCreateFeedback = vi.mocked(createFeedback);
const mockFindNotionUser = vi.mocked(findNotionUser);

const baseContext = {
  channel_id: "C123",
  dm_channel: "D456",
  thread_ts: "1234567890.123456",
  is_dm: true,
  team_id: "T789",
  bot_id: "B000",
  token: "xoxb-test-token",
  user_id: "U111",
};

function executeSubmitFeedback(
  params: Record<string, unknown>,
  ctx = baseContext,
) {
  const toolDef = notionTools.submitFeedback;
  return (
    toolDef as unknown as { execute: (...args: unknown[]) => unknown }
  ).execute(params, { experimental_context: ctx });
}

describe("submitFeedback tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FEEDBACK_CHANNEL_ID;
  });

  it("creates feedback in Notion with resolved user", async () => {
    mockUsersInfo.mockResolvedValue({
      user: { profile: { email: "test@example.com" } },
    });
    mockFindNotionUser.mockResolvedValue("notion-user-123");
    mockCreateFeedback.mockResolvedValue({
      url: "https://notion.so/page-123",
    } as ReturnType<typeof createFeedback> extends Promise<infer T>
      ? T
      : never);

    const result = await executeSubmitFeedback({
      name: "Login button broken",
      type: "Bug",
      description: "Login page confirm button not responding",
      priority: "P1",
      source: "Customer",
      customer: "Client A",
      tags: ["auth", "login"],
    });

    expect(result).toMatchObject({
      success: true,
      pageUrl: "https://notion.so/page-123",
    });
    expect(mockCreateFeedback).toHaveBeenCalledWith({
      name: "Login button broken",
      type: "Bug",
      description: "Login page confirm button not responding",
      summary: "",
      priority: "P1",
      source: "Customer",
      customer: "Client A",
      assignedToNotionUserId: null,
      createdByNotionUserId: "notion-user-123",
      dueDate: null,
      tags: ["auth", "login"],
      attachments: [],
    });
  });

  it("creates feedback even when user resolution fails", async () => {
    mockUsersInfo.mockRejectedValue(new Error("user_not_found"));
    mockCreateFeedback.mockResolvedValue({
      url: "https://notion.so/page-456",
    } as ReturnType<typeof createFeedback> extends Promise<infer T>
      ? T
      : never);

    const result = await executeSubmitFeedback({
      name: "Add dark mode",
      type: "Feature Request",
      description: "Would be nice to have dark mode",
      priority: "P3",
      source: "Internal",
    });

    expect(result).toMatchObject({ success: true });
    expect(mockCreateFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        createdByNotionUserId: null,
        customer: "",
        tags: [],
      }),
    );
  });

  it("posts notification to feedback channel when configured", async () => {
    process.env.FEEDBACK_CHANNEL_ID = "C-FEEDBACK";
    mockUsersInfo.mockResolvedValue({
      user: { profile: { email: "test@example.com" } },
    });
    mockFindNotionUser.mockResolvedValue(null);
    mockCreateFeedback.mockResolvedValue({
      url: "https://notion.so/page-789",
    } as ReturnType<typeof createFeedback> extends Promise<infer T>
      ? T
      : never);

    await executeSubmitFeedback({
      name: "Test feedback",
      type: "Bug",
      description: "Something broke",
      priority: "P2",
      source: "Internal",
    });

    expect(mockChatPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C-FEEDBACK",
        text: "New feedback: Test feedback",
      }),
    );
  });

  it("skips notification when FEEDBACK_CHANNEL_ID is not set", async () => {
    mockUsersInfo.mockResolvedValue({ user: { profile: {} } });
    mockCreateFeedback.mockResolvedValue({
      url: "https://notion.so/page-000",
    } as ReturnType<typeof createFeedback> extends Promise<infer T>
      ? T
      : never);

    await executeSubmitFeedback({
      name: "No channel test",
      type: "Other",
      description: "Testing",
      priority: "P2",
      source: "Internal",
    });

    expect(mockChatPostMessage).not.toHaveBeenCalled();
  });

  it("returns error when Notion API fails", async () => {
    mockUsersInfo.mockResolvedValue({ user: { profile: {} } });
    mockCreateFeedback.mockRejectedValue(new Error("Notion API error"));

    const result = await executeSubmitFeedback({
      name: "Will fail",
      type: "Bug",
      description: "This should fail",
      priority: "P2",
      source: "Internal",
    });

    expect(result).toMatchObject({
      success: false,
      error: "Notion API error",
    });
  });

  it("handles optional fields with defaults", async () => {
    mockUsersInfo.mockResolvedValue({ user: { profile: {} } });
    mockCreateFeedback.mockResolvedValue({
      url: "https://notion.so/page-min",
    } as ReturnType<typeof createFeedback> extends Promise<infer T>
      ? T
      : never);

    await executeSubmitFeedback({
      name: "Minimal feedback",
      type: "Question",
      description: "Just a question",
      priority: "P2",
      source: "Internal",
    });

    expect(mockCreateFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "",
        tags: [],
        attachments: [],
        assignedToNotionUserId: null,
        dueDate: null,
      }),
    );
  });
});
