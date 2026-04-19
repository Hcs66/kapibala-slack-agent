import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUsersInfo = vi.fn();
const mockChatPostMessage = vi.fn();
const mockConversationsReplies = vi.fn();
const mockConversationsHistory = vi.fn();

vi.mock("@slack/web-api", () => ({
  WebClient: class {
    users = { info: mockUsersInfo };
    chat = { postMessage: mockChatPostMessage };
    conversations = {
      replies: mockConversationsReplies,
      history: mockConversationsHistory,
    };
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

vi.mock("~/lib/notion/expense-claim", () => ({
  createExpenseClaim: vi.fn(),
}));

vi.mock("~/lib/notion/recruitment", () => ({
  createCandidate: vi.fn(),
}));

vi.mock("~/lib/notion/docs", () => ({
  createDoc: vi.fn(),
}));

vi.mock("~/lib/slack/blocks", () => ({
  expenseClaimApprovalBlocks: vi.fn().mockReturnValue([]),
  candidateResumeUploadBlocks: vi.fn().mockReturnValue([]),
  expenseInvoiceUploadBlocks: vi.fn().mockReturnValue([]),
  saveDocApprovalBlocks: vi.fn().mockReturnValue([]),
}));

const mockHookCreate = vi.fn();
vi.mock("~/lib/ai/workflows/hooks", () => ({
  saveDocApprovalHook: {
    create: (...args: unknown[]) => mockHookCreate(...args),
  },
}));

import { createDoc } from "~/lib/notion/docs";
import { createExpenseClaim } from "~/lib/notion/expense-claim";
import { createFeedback } from "~/lib/notion/feedback";
import {
  queryExpenseClaims,
  queryFeedback,
  queryRecruitment,
} from "~/lib/notion/query";
import { createCandidate } from "~/lib/notion/recruitment";
import { findNotionUser } from "~/lib/notion/user-map";
import { notionTools } from "./notion";

const mockCreateFeedback = vi.mocked(createFeedback);
const mockFindNotionUser = vi.mocked(findNotionUser);
const mockQueryFeedback = vi.mocked(queryFeedback);
const mockQueryExpenseClaims = vi.mocked(queryExpenseClaims);
const mockQueryRecruitment = vi.mocked(queryRecruitment);
const mockCreateExpenseClaim = vi.mocked(createExpenseClaim);
const mockCreateCandidate = vi.mocked(createCandidate);
const mockCreateDoc = vi.mocked(createDoc);

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
    delete process.env.SLACK_FEEDBACK_CHANNEL_ID;
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
    process.env.SLACK_FEEDBACK_CHANNEL_ID = "C-FEEDBACK";
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

  it("skips notification when SLACK_FEEDBACK_CHANNEL_ID is not set", async () => {
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
        status: null,
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
        status: null,
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
      status: "Approved",
    });
  });

  it("queries recruitment database", async () => {
    mockQueryRecruitment.mockResolvedValue([
      {
        id: "r1",
        url: "https://notion.so/r1",
        candidateName: "Alice",
        positionApplied: "Software Engineer",
        status: "Interview",
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
      status: undefined,
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
        expenseType: "Travel",
        submissionDate: "2026-03-18",
        status: null,
        submittedBy: [],
      },
      {
        id: "e2",
        url: "https://notion.so/e2",
        claimTitle: "Lunch",
        claimDescription: "Team lunch",
        amount: 200,
        expenseType: "Meals",
        submissionDate: "2026-03-17",
        status: "Approved",
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

function executeSubmitExpenseClaim(
  params: Record<string, unknown>,
  ctx = baseContext,
) {
  const toolDef = notionTools.submitExpenseClaim;
  return (
    toolDef as unknown as { execute: (...args: unknown[]) => unknown }
  ).execute(params, {
    experimental_context: ctx,
  });
}

const expenseClaimParams = {
  claimTitle: "Airport taxi",
  claimDescription: "Taxi from airport to office",
  amount: 150,
  expenseType: "Travel",
};

describe("submitExpenseClaim tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SLACK_APPROVALS_CHANNEL_ID = "C-APPROVALS";
  });

  it("creates claim and sends approval request to channel", async () => {
    mockUsersInfo.mockResolvedValue({
      user: { profile: { email: "user@example.com" } },
    });
    mockFindNotionUser.mockResolvedValue("notion-user-111");
    mockCreateExpenseClaim.mockResolvedValue({
      id: "page-ec-1",
      url: "https://notion.so/ec-1",
    } as ReturnType<typeof createExpenseClaim> extends Promise<infer T>
      ? T
      : never);

    const result = await executeSubmitExpenseClaim(expenseClaimParams);

    expect(mockCreateExpenseClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        claimTitle: "Airport taxi",
        amount: 150,
        expenseType: "Travel",
        submittedByNotionUserId: "notion-user-111",
      }),
    );
    expect(mockChatPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C-APPROVALS",
      }),
    );
    expect(result).toMatchObject({
      success: true,
      message: expect.stringContaining("sent for approval"),
      pageUrl: "https://notion.so/ec-1",
    });
  });

  it("posts invoice upload button to thread after creation", async () => {
    mockUsersInfo.mockResolvedValue({ user: { profile: {} } });
    mockCreateExpenseClaim.mockResolvedValue({
      id: "page-ec-upload",
      url: "https://notion.so/ec-upload",
    } as ReturnType<typeof createExpenseClaim> extends Promise<infer T>
      ? T
      : never);

    await executeSubmitExpenseClaim(expenseClaimParams);

    expect(mockChatPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: baseContext.dm_channel,
        thread_ts: baseContext.thread_ts,
      }),
    );
  });

  it("still posts upload button when SLACK_APPROVALS_CHANNEL_ID is not set", async () => {
    delete process.env.SLACK_APPROVALS_CHANNEL_ID;
    mockUsersInfo.mockResolvedValue({ user: { profile: {} } });
    mockCreateExpenseClaim.mockResolvedValue({
      id: "page-ec-3",
      url: "https://notion.so/ec-3",
    } as ReturnType<typeof createExpenseClaim> extends Promise<infer T>
      ? T
      : never);

    const result = await executeSubmitExpenseClaim(expenseClaimParams);

    expect(mockCreateExpenseClaim).toHaveBeenCalled();
    expect(mockChatPostMessage).toHaveBeenCalledTimes(1);
    expect(mockChatPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: baseContext.dm_channel,
        thread_ts: baseContext.thread_ts,
      }),
    );
    expect(result).toMatchObject({
      success: true,
      message: expect.stringContaining("no approvals channel"),
      pageUrl: "https://notion.so/ec-3",
    });
  });

  it("returns error when Notion create fails", async () => {
    mockUsersInfo.mockResolvedValue({ user: { profile: {} } });
    mockCreateExpenseClaim.mockRejectedValue(new Error("Notion down"));

    const result = await executeSubmitExpenseClaim(expenseClaimParams);

    expect(result).toMatchObject({
      success: false,
      error: "Notion down",
    });
  });
});

function executeSubmitCandidate(
  params: Record<string, unknown>,
  ctx = baseContext,
) {
  const toolDef = notionTools.submitCandidate;
  return (
    toolDef as unknown as { execute: (...args: unknown[]) => unknown }
  ).execute(params, { experimental_context: ctx });
}

const candidateParams = {
  candidateName: "Zhang San",
  positionApplied: "Software Engineer",
  resumeSource: "LinkedIn",
  email: "zhangsan@example.com",
};

describe("submitCandidate tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SLACK_RECRUITMENT_CHANNEL_ID;
  });

  it("creates candidate in Notion and returns page URL", async () => {
    mockCreateCandidate.mockResolvedValue({
      id: "page-c-1",
      url: "https://notion.so/candidate-1",
    } as ReturnType<typeof createCandidate> extends Promise<infer T>
      ? T
      : never);

    const result = await executeSubmitCandidate(candidateParams);

    expect(mockCreateCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateName: "Zhang San",
        positionApplied: "Software Engineer",
        resumeSource: "LinkedIn",
        email: "zhangsan@example.com",
        phone: "",
        status: "",
        interviewTime: null,
        zoomMeetingLink: "",
        resumeLink: "",
        resumeAttachments: [],
      }),
    );
    expect(result).toMatchObject({
      success: true,
      pageUrl: "https://notion.so/candidate-1",
    });
  });

  it("posts resume upload button to thread after creation", async () => {
    mockCreateCandidate.mockResolvedValue({
      id: "page-c-upload",
      url: "https://notion.so/candidate-upload",
    } as ReturnType<typeof createCandidate> extends Promise<infer T>
      ? T
      : never);

    await executeSubmitCandidate(candidateParams);

    expect(mockChatPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: baseContext.dm_channel,
        thread_ts: baseContext.thread_ts,
      }),
    );
  });

  it("posts notification to recruitment channel when configured", async () => {
    process.env.SLACK_RECRUITMENT_CHANNEL_ID = "C-RECRUIT";
    mockCreateCandidate.mockResolvedValue({
      id: "page-c-2",
      url: "https://notion.so/candidate-2",
    } as ReturnType<typeof createCandidate> extends Promise<infer T>
      ? T
      : never);

    await executeSubmitCandidate(candidateParams);

    expect(mockChatPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C-RECRUIT",
        text: "New candidate: Zhang San",
      }),
    );
  });

  it("still posts upload button when SLACK_RECRUITMENT_CHANNEL_ID is not set", async () => {
    mockCreateCandidate.mockResolvedValue({
      id: "page-c-3",
      url: "https://notion.so/candidate-3",
    } as ReturnType<typeof createCandidate> extends Promise<infer T>
      ? T
      : never);

    await executeSubmitCandidate(candidateParams);

    expect(mockChatPostMessage).toHaveBeenCalledTimes(1);
    expect(mockChatPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: baseContext.dm_channel,
        thread_ts: baseContext.thread_ts,
      }),
    );
  });

  it("returns error when Notion API fails", async () => {
    mockCreateCandidate.mockRejectedValue(new Error("Notion API error"));

    const result = await executeSubmitCandidate(candidateParams);

    expect(result).toMatchObject({
      success: false,
      error: "Notion API error",
    });
  });

  it("handles all optional fields", async () => {
    mockCreateCandidate.mockResolvedValue({
      id: "page-c-4",
      url: "https://notion.so/candidate-4",
    } as ReturnType<typeof createCandidate> extends Promise<infer T>
      ? T
      : never);

    await executeSubmitCandidate({
      candidateName: "Li Si",
      positionApplied: "Product Manager",
      resumeSource: "Email",
      phone: "+86-13800138000",
      email: "lisi@example.com",
      interviewTime: "2026-03-25",
      zoomMeetingLink: "https://zoom.us/j/123",
      resumeLink: "https://example.com/resume.pdf",
    });

    expect(mockCreateCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateName: "Li Si",
        positionApplied: "Product Manager",
        resumeSource: "Email",
        phone: "+86-13800138000",
        email: "lisi@example.com",
        interviewTime: "2026-03-25",
        zoomMeetingLink: "https://zoom.us/j/123",
        resumeLink: "https://example.com/resume.pdf",
        resumeAttachments: [],
      }),
    );
  });

  it("includes optional fields in channel notification", async () => {
    process.env.SLACK_RECRUITMENT_CHANNEL_ID = "C-RECRUIT";
    mockCreateCandidate.mockResolvedValue({
      id: "page-c-5",
      url: "https://notion.so/candidate-5",
    } as ReturnType<typeof createCandidate> extends Promise<infer T>
      ? T
      : never);

    await executeSubmitCandidate({
      ...candidateParams,
      phone: "+1-555-0100",
      interviewTime: "2026-04-01",
      zoomMeetingLink: "https://zoom.us/j/456",
      resumeLink: "https://example.com/cv.pdf",
    });

    const notificationCall = mockChatPostMessage.mock.calls.find(
      (call) => call[0].channel === "C-RECRUIT",
    );
    expect(notificationCall).toBeDefined();
    const sectionText = notificationCall?.[0].blocks[1].text.text;
    expect(sectionText).toContain("+1-555-0100");
    expect(sectionText).toContain("2026-04-01");
    expect(sectionText).toContain("zoom.us/j/456");
    expect(sectionText).toContain("example.com/cv.pdf");
  });
});

describe("queryPendingItems tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries pending recruitment candidates", async () => {
    mockQueryRecruitment.mockResolvedValue([
      {
        id: "r1",
        url: "https://notion.so/r1",
        candidateName: "Alice",
        positionApplied: "Software Engineer",
        status: "Pending Review",
        resumeSource: "LinkedIn",
        email: "alice@example.com",
        phone: null,
        interviewTime: null,
      },
    ]);

    const result = await executeTool("queryPendingItems", {
      category: "pending_recruitment",
    });

    expect(result).toMatchObject({
      success: true,
      category: "pending_recruitment",
      count: 1,
    });
    expect(mockQueryRecruitment).toHaveBeenCalledWith({
      status: "Pending Review",
    });
  });

  it("queries pending expense approvals", async () => {
    mockQueryExpenseClaims.mockResolvedValue([
      {
        id: "e1",
        url: "https://notion.so/e1",
        claimTitle: "Taxi",
        claimDescription: "Airport taxi",
        amount: 150,
        expenseType: "Travel",
        submissionDate: "2026-03-18",
        status: "Pending",
        submittedBy: [],
      },
    ]);

    const result = await executeTool("queryPendingItems", {
      category: "pending_expense_approval",
    });

    expect(result).toMatchObject({
      success: true,
      category: "pending_expense_approval",
      count: 1,
    });
    expect(mockQueryExpenseClaims).toHaveBeenCalledWith({
      status: "Pending",
    });
  });

  it("queries expenses awaiting payment", async () => {
    mockQueryExpenseClaims.mockResolvedValue([
      {
        id: "e2",
        url: "https://notion.so/e2",
        claimTitle: "Lunch",
        claimDescription: "Team lunch",
        amount: 200,
        expenseType: "Meals",
        submissionDate: "2026-03-17",
        status: "Approved",
        submittedBy: [],
      },
    ]);

    const result = await executeTool("queryPendingItems", {
      category: "pending_expense_payment",
    });

    expect(result).toMatchObject({
      success: true,
      category: "pending_expense_payment",
      count: 1,
    });
    expect(mockQueryExpenseClaims).toHaveBeenCalledWith({
      status: "Approved",
    });
  });

  it("queries pending feedback", async () => {
    mockQueryFeedback.mockResolvedValue([
      {
        id: "f1",
        url: "https://notion.so/f1",
        name: "Login bug",
        type: "Bug",
        status: "Pending",
        description: "Login broken",
        priority: "P1",
        source: "Customer",
        customer: "Acme",
        assignedTo: [],
        createdBy: [],
        createdDate: "2026-03-15",
        dueDate: null,
        tags: [],
      },
    ]);

    const result = await executeTool("queryPendingItems", {
      category: "pending_feedback",
    });

    expect(result).toMatchObject({
      success: true,
      category: "pending_feedback",
      count: 1,
    });
    expect(mockQueryFeedback).toHaveBeenCalledWith({ status: "Pending" });
  });

  it("returns empty results gracefully", async () => {
    mockQueryRecruitment.mockResolvedValue([]);

    const result = await executeTool("queryPendingItems", {
      category: "pending_recruitment",
    });

    expect(result).toMatchObject({
      success: true,
      count: 0,
      message: "No candidates pending review.",
    });
  });

  it("returns error when query fails", async () => {
    mockQueryFeedback.mockRejectedValue(new Error("DB error"));

    const result = await executeTool("queryPendingItems", {
      category: "pending_feedback",
    });

    expect(result).toMatchObject({
      success: false,
      error: "DB error",
    });
  });
});

describe("getThreadMessagesForSummary tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches thread replies and resolves user names", async () => {
    mockConversationsReplies.mockResolvedValue({
      messages: [
        {
          user: "U001",
          text: "Let's discuss the architecture",
          ts: "1711612800.000000",
        },
        {
          user: "U002",
          text: "I think we should use DurableAgent",
          ts: "1711612860.000000",
        },
      ],
    });
    mockUsersInfo
      .mockResolvedValueOnce({ user: { real_name: "Alice", name: "alice" } })
      .mockResolvedValueOnce({ user: { real_name: "Bob", name: "bob" } });

    const result = await executeTool("getThreadMessagesForSummary", {
      channel_id: "C123",
      thread_ts: "1711612800.000000",
    });

    expect(result).toMatchObject({
      success: true,
      messageCount: 2,
      participants: ["Alice", "Bob"],
    });
    expect((result as { messages: string }).messages).toContain("Alice");
    expect((result as { messages: string }).messages).toContain("Bob");
    expect(mockConversationsReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C123",
        ts: "1711612800.000000",
      }),
    );
  });

  it("fetches channel history when no thread_ts provided", async () => {
    mockConversationsHistory.mockResolvedValue({
      messages: [
        { user: "U001", text: "Morning standup", ts: "1711612800.000000" },
      ],
    });
    mockUsersInfo.mockResolvedValue({
      user: { real_name: "Alice", name: "alice" },
    });

    const result = await executeTool("getThreadMessagesForSummary", {
      channel_id: "C123",
    });

    expect(result).toMatchObject({ success: true, messageCount: 1 });
    expect(mockConversationsHistory).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "C123" }),
    );
  });

  it("filters messages by user ID", async () => {
    mockConversationsReplies.mockResolvedValue({
      messages: [
        { user: "U001", text: "My point is...", ts: "1711612800.000000" },
        { user: "U002", text: "I disagree", ts: "1711612860.000000" },
        { user: "U001", text: "Let me clarify", ts: "1711612920.000000" },
      ],
    });
    mockUsersInfo.mockResolvedValue({
      user: { real_name: "Alice", name: "alice" },
    });

    const result = await executeTool("getThreadMessagesForSummary", {
      channel_id: "C123",
      thread_ts: "1711612800.000000",
      filter_user_id: "U001",
    });

    expect(result).toMatchObject({ success: true, messageCount: 2 });
  });

  it("converts ISO date strings to Unix timestamps", async () => {
    mockConversationsReplies.mockResolvedValue({ messages: [] });

    await executeTool("getThreadMessagesForSummary", {
      channel_id: "C123",
      thread_ts: "1711612800.000000",
      oldest: "2026-03-28",
    });

    expect(mockConversationsReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        oldest: expect.stringMatching(/^\d+(\.\d+)?$/),
      }),
    );
  });

  it("returns error when Slack API fails", async () => {
    mockConversationsReplies.mockRejectedValue(new Error("channel_not_found"));

    const result = await executeTool("getThreadMessagesForSummary", {
      channel_id: "C999",
      thread_ts: "1711612800.000000",
    });

    expect(result).toMatchObject({
      success: false,
      error: "channel_not_found",
    });
  });

  it("handles empty messages gracefully", async () => {
    mockConversationsReplies.mockResolvedValue({ messages: [] });

    const result = await executeTool("getThreadMessagesForSummary", {
      channel_id: "C123",
      thread_ts: "1711612800.000000",
    });

    expect(result).toMatchObject({
      success: true,
      messageCount: 0,
      participants: [],
    });
  });

  it("falls back to user ID when user info lookup fails", async () => {
    mockConversationsReplies.mockResolvedValue({
      messages: [{ user: "U001", text: "Hello", ts: "1711612800.000000" }],
    });
    mockUsersInfo.mockRejectedValue(new Error("user_not_found"));

    const result = await executeTool("getThreadMessagesForSummary", {
      channel_id: "C123",
      thread_ts: "1711612800.000000",
    });

    expect(result).toMatchObject({ success: true, messageCount: 1 });
    expect((result as { messages: string }).messages).toContain("U001");
  });
});

describe("saveDocToNotion tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOTION_DOCS_DATABASE_ID = "db-docs-123";
    mockHookCreate.mockReturnValue(Promise.resolve({ approved: true }));
  });

  it("creates a doc in Notion after user approves via button", async () => {
    mockUsersInfo.mockResolvedValue({
      user: { profile: { email: "author@example.com" } },
    });
    mockFindNotionUser.mockResolvedValue("notion-author-123");
    mockCreateDoc.mockResolvedValue({
      url: "https://notion.so/doc-123",
    } as ReturnType<typeof createDoc> extends Promise<infer T> ? T : never);

    const result = await executeTool("saveDocToNotion", {
      docName: "Agent Architecture Discussion 2026-03-28",
      summary: "Team discussed new agent architecture approach",
      category: ["Architecture"],
      content:
        "## Background\nThe team discussed...\n\n## Decisions\n- Use DurableAgent",
    });

    expect(result).toMatchObject({
      success: true,
      pageUrl: "https://notion.so/doc-123",
    });
    expect(mockChatPostMessage).toHaveBeenCalled();
    expect(mockHookCreate).toHaveBeenCalled();
    expect(mockCreateDoc).toHaveBeenCalledWith({
      docName: "Agent Architecture Discussion 2026-03-28",
      summary: "Team discussed new agent architecture approach",
      category: ["Architecture"],
      authorNotionUserId: "notion-author-123",
      content:
        "## Background\nThe team discussed...\n\n## Decisions\n- Use DurableAgent",
    });
  });

  it("returns rejected when user clicks Cancel", async () => {
    mockHookCreate.mockReturnValue(Promise.resolve({ approved: false }));

    const result = await executeTool("saveDocToNotion", {
      docName: "Meeting Notes",
      summary: "Weekly sync notes",
      category: ["Guide"],
      content: "Notes content here",
    });

    expect(result).toMatchObject({
      success: false,
      rejected: true,
    });
    expect(mockCreateDoc).not.toHaveBeenCalled();
  });

  it("creates doc even when author resolution fails", async () => {
    mockUsersInfo.mockRejectedValue(new Error("user_not_found"));
    mockCreateDoc.mockResolvedValue({
      url: "https://notion.so/doc-456",
    } as ReturnType<typeof createDoc> extends Promise<infer T> ? T : never);

    const result = await executeTool("saveDocToNotion", {
      docName: "Meeting Notes",
      summary: "Weekly sync notes",
      category: ["Guide"],
      content: "Notes content here",
    });

    expect(result).toMatchObject({ success: true });
    expect(mockCreateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ authorNotionUserId: null }),
    );
  });

  it("returns error when Notion API fails", async () => {
    mockUsersInfo.mockResolvedValue({ user: { profile: {} } });
    mockCreateDoc.mockRejectedValue(new Error("Notion API error"));

    const result = await executeTool("saveDocToNotion", {
      docName: "Will fail",
      summary: "This should fail",
      category: ["Tech Spec"],
      content: "Content",
    });

    expect(result).toMatchObject({
      success: false,
      error: "Notion API error",
    });
  });

  it("supports multiple categories", async () => {
    mockUsersInfo.mockResolvedValue({ user: { profile: {} } });
    mockCreateDoc.mockResolvedValue({
      url: "https://notion.so/doc-multi",
    } as ReturnType<typeof createDoc> extends Promise<infer T> ? T : never);

    await executeTool("saveDocToNotion", {
      docName: "Architecture Guide",
      summary: "Architecture best practices",
      category: ["Architecture", "Best Practices"],
      content: "Guide content",
    });

    expect(mockCreateDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        category: ["Architecture", "Best Practices"],
      }),
    );
  });
});
