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

vi.mock("~/lib/notion/query", () => ({
  queryFeedback: vi.fn(),
  queryExpenseClaims: vi.fn(),
  queryRecruitment: vi.fn(),
}));

import { createFeedback } from "~/lib/notion/feedback";
import {
  queryExpenseClaims,
  queryFeedback,
  queryRecruitment,
} from "~/lib/notion/query";
import { findNotionUser } from "~/lib/notion/user-map";
import { notionTools } from "./notion";

const mockCreateFeedback = vi.mocked(createFeedback);
const mockFindNotionUser = vi.mocked(findNotionUser);
const mockQueryFeedback = vi.mocked(queryFeedback);
const mockQueryExpenseClaims = vi.mocked(queryExpenseClaims);
const mockQueryRecruitment = vi.mocked(queryRecruitment);

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

function executeTool(
  toolName: keyof typeof notionTools,
  params: Record<string, unknown>,
  ctx = baseContext,
) {
  const toolDef = notionTools[toolName];
  return (
    toolDef as unknown as { execute: (...args: unknown[]) => unknown }
  ).execute(params, { experimental_context: ctx });
}

describe("queryMyTasks tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tasks assigned to the current user", async () => {
    mockUsersInfo.mockResolvedValue({
      user: { profile: { email: "dev@example.com" } },
    });
    mockFindNotionUser.mockResolvedValue("notion-user-abc");
    mockQueryFeedback.mockResolvedValue([
      {
        id: "page-1",
        url: "https://notion.so/page-1",
        name: "Fix login bug",
        type: "Bug",
        description: "Login broken",
        priority: "P1",
        source: "Customer",
        customer: "Acme",
        assignedTo: [{ id: "notion-user-abc", name: "Dev" }],
        createdBy: [],
        createdDate: "2026-03-15",
        dueDate: "2026-03-20",
        tags: ["urgent"],
      },
    ]);

    const result = await executeTool("queryMyTasks", {});

    expect(result).toMatchObject({ success: true, count: 1 });
    expect(mockQueryFeedback).toHaveBeenCalledWith({
      assigneeNotionUserId: "notion-user-abc",
      type: undefined,
      priority: undefined,
    });
  });

  it("returns error when Notion user cannot be resolved", async () => {
    mockUsersInfo.mockRejectedValue(new Error("user_not_found"));

    const result = await executeTool("queryMyTasks", {});

    expect(result).toMatchObject({ success: false });
    expect(mockQueryFeedback).not.toHaveBeenCalled();
  });

  it("passes type and priority filters", async () => {
    mockUsersInfo.mockResolvedValue({
      user: { profile: { email: "dev@example.com" } },
    });
    mockFindNotionUser.mockResolvedValue("notion-user-abc");
    mockQueryFeedback.mockResolvedValue([]);

    await executeTool("queryMyTasks", { type: "Bug", priority: "P0" });

    expect(mockQueryFeedback).toHaveBeenCalledWith({
      assigneeNotionUserId: "notion-user-abc",
      type: "Bug",
      priority: "P0",
    });
  });
});

describe("queryProjectStatus tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries feedback database", async () => {
    mockQueryFeedback.mockResolvedValue([
      {
        id: "p1",
        url: "https://notion.so/p1",
        name: "Bug A",
        type: "Bug",
        description: "",
        priority: "P0",
        source: "Internal",
        customer: "",
        assignedTo: [],
        createdBy: [],
        createdDate: "2026-03-10",
        dueDate: null,
        tags: [],
      },
    ]);

    const result = await executeTool("queryProjectStatus", {
      database: "feedback",
      filters: { priority: "P0" },
    });

    expect(result).toMatchObject({
      success: true,
      database: "feedback",
      count: 1,
    });
    expect(mockQueryFeedback).toHaveBeenCalledWith({
      type: undefined,
      priority: "P0",
      source: undefined,
    });
  });

  it("queries expense claims database", async () => {
    mockQueryExpenseClaims.mockResolvedValue([]);

    const result = await executeTool("queryProjectStatus", {
      database: "expense_claims",
      filters: { status: "Approved" },
    });

    expect(result).toMatchObject({
      success: true,
      database: "expense_claims",
      count: 0,
    });
    expect(mockQueryExpenseClaims).toHaveBeenCalledWith({
      approvalStatus: "Approved",
    });
  });

  it("queries recruitment database", async () => {
    mockQueryRecruitment.mockResolvedValue([
      {
        id: "r1",
        url: "https://notion.so/r1",
        candidateName: "Alice",
        positionApplied: "Software Engineer",
        currentStatus: "Interview",
        resumeSource: "LinkedIn",
        email: "alice@example.com",
        phone: null,
        interviewTime: "2026-03-25",
      },
    ]);

    const result = await executeTool("queryProjectStatus", {
      database: "recruitment",
      filters: { position: "Software Engineer" },
    });

    expect(result).toMatchObject({
      success: true,
      database: "recruitment",
      count: 1,
    });
    expect(mockQueryRecruitment).toHaveBeenCalledWith({
      positionApplied: "Software Engineer",
      currentStatus: undefined,
    });
  });
});

describe("queryPendingApprovals tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pending expense claims", async () => {
    mockQueryExpenseClaims.mockResolvedValue([
      {
        id: "e1",
        url: "https://notion.so/e1",
        claimTitle: "Taxi",
        claimDescription: "Airport taxi",
        amount: 150,
        currency: "AED",
        expenseType: "Travel",
        submissionDate: "2026-03-18",
        approvalStatus: null,
        submittedBy: [],
      },
      {
        id: "e2",
        url: "https://notion.so/e2",
        claimTitle: "Lunch",
        claimDescription: "Team lunch",
        amount: 200,
        currency: "CNY",
        expenseType: "Meals",
        submissionDate: "2026-03-17",
        approvalStatus: "Approved",
        submittedBy: [],
      },
    ]);

    const result = await executeTool("queryPendingApprovals", {});

    expect(result).toMatchObject({
      success: true,
      summary: { total: 2, pending: 1, approved: 1, rejected: 0 },
    });
  });

  it("handles empty results", async () => {
    mockQueryExpenseClaims.mockResolvedValue([]);

    const result = await executeTool("queryPendingApprovals", {});

    expect(result).toMatchObject({
      success: true,
      summary: { total: 0, pending: 0, approved: 0, rejected: 0 },
      message: "No pending expense claims.",
    });
  });

  it("returns error when query fails", async () => {
    mockQueryExpenseClaims.mockRejectedValue(new Error("DB error"));

    const result = await executeTool("queryPendingApprovals", {});

    expect(result).toMatchObject({
      success: false,
      error: "DB error",
    });
  });
});
