import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockChatPostMessage } = vi.hoisted(() => {
  const mockChatPostMessage = vi.fn();

  const g = globalThis as Record<string, unknown>;
  g.defineEventHandler = (handler: (event: unknown) => unknown) => handler;
  g.getHeader = (_event: unknown, name: string) => {
    if (name === "authorization") return `Bearer ${process.env.CRON_SECRET}`;
    return undefined;
  };
  g.setResponseStatus = vi.fn();

  return { mockChatPostMessage };
});

vi.mock("@slack/web-api", () => ({
  WebClient: class {
    chat = { postMessage: mockChatPostMessage };
  },
}));

vi.mock("~/lib/notion/alerts", () => ({
  getAlertDigest: vi.fn(),
}));

import type { AlertDigest } from "~/lib/notion/alerts";
import { getAlertDigest } from "~/lib/notion/alerts";
import { buildAlertBlocks } from "./alerts.get";

const mockGetAlertDigest = vi.mocked(getAlertDigest);

const emptyDigest: AlertDigest = {
  overdueExpenses: [],
  overdueRecruitment: [],
  overdueFeedback: [],
  totalAlerts: 0,
};

const fullDigest: AlertDigest = {
  overdueExpenses: [
    {
      id: "e1",
      url: "https://notion.so/e1",
      claimTitle: "Old taxi",
      claimDescription: "",
      amount: 100,
      currency: "AED",
      expenseType: "Travel",
      submissionDate: "2026-03-23",
      status: "Pending",
      submittedBy: [{ id: "u1", name: "Alice" }],
      daysOverdue: 5,
      alertReason: "pending_approval",
    },
    {
      id: "e2",
      url: "https://notion.so/e2",
      claimTitle: "Approved claim",
      claimDescription: "",
      amount: 200,
      currency: "CNY",
      expenseType: "Meals",
      submissionDate: "2026-03-24",
      status: "Approved",
      submittedBy: [],
      daysOverdue: 4,
      alertReason: "pending_payment",
    },
  ],
  overdueRecruitment: [
    {
      id: "r1",
      url: "https://notion.so/r1",
      candidateName: "Bob",
      positionApplied: "Engineer",
      status: "Pending Review",
      resumeSource: "LinkedIn",
      email: "bob@example.com",
      phone: null,
      interviewTime: null,
      daysOverdue: 3,
    },
  ],
  overdueFeedback: [
    {
      id: "f1",
      url: "https://notion.so/f1",
      name: "Old bug",
      type: "Bug",
      status: "Pending",
      description: "Something broken",
      priority: "P1",
      source: "Customer",
      customer: "Acme",
      assignedTo: [],
      createdBy: [],
      createdDate: "2026-03-21",
      dueDate: null,
      tags: [],
      daysOverdue: 7,
    },
  ],
  totalAlerts: 4,
};

describe("buildAlertBlocks", () => {
  it("builds blocks with all alert categories", () => {
    const blocks = buildAlertBlocks(fullDigest);

    const headerBlock = blocks.find((b) => b.type === "header");
    expect(headerBlock).toBeDefined();

    const sectionTexts = blocks
      .filter((b) => b.type === "section")
      .map((b) =>
        "text" in b && b.text ? (b.text as { text: string }).text : "",
      );

    expect(
      sectionTexts.some((t) => t.includes("Pending Approval >3 Days")),
    ).toBe(true);
    expect(
      sectionTexts.some((t) => t.includes("Awaiting Payment >3 Days")),
    ).toBe(true);
    expect(sectionTexts.some((t) => t.includes("Recruitment"))).toBe(true);
    expect(sectionTexts.some((t) => t.includes("Feedback"))).toBe(true);
  });

  it("includes expense details in blocks", () => {
    const blocks = buildAlertBlocks(fullDigest);
    const sectionTexts = blocks
      .filter((b) => b.type === "section")
      .map((b) =>
        "text" in b && b.text ? (b.text as { text: string }).text : "",
      );

    expect(
      sectionTexts.some((t) => t.includes("Old taxi") && t.includes("5 days")),
    ).toBe(true);
    expect(
      sectionTexts.some(
        (t) => t.includes("Approved claim") && t.includes("4 days"),
      ),
    ).toBe(true);
  });

  it("includes recruitment details in blocks", () => {
    const blocks = buildAlertBlocks(fullDigest);
    const sectionTexts = blocks
      .filter((b) => b.type === "section")
      .map((b) =>
        "text" in b && b.text ? (b.text as { text: string }).text : "",
      );

    expect(
      sectionTexts.some((t) => t.includes("Bob") && t.includes("Engineer")),
    ).toBe(true);
  });

  it("includes feedback details in blocks", () => {
    const blocks = buildAlertBlocks(fullDigest);
    const sectionTexts = blocks
      .filter((b) => b.type === "section")
      .map((b) =>
        "text" in b && b.text ? (b.text as { text: string }).text : "",
      );

    expect(
      sectionTexts.some((t) => t.includes("Old bug") && t.includes("Acme")),
    ).toBe(true);
  });

  it("returns only header, divider, and context when no alerts", () => {
    const blocks = buildAlertBlocks(emptyDigest);
    const sectionBlocks = blocks.filter((b) => b.type === "section");
    expect(sectionBlocks).toHaveLength(0);
    expect(blocks.some((b) => b.type === "header")).toBe(true);
    expect(blocks.some((b) => b.type === "divider")).toBe(true);
    expect(blocks.some((b) => b.type === "context")).toBe(true);
  });

  it("shows Unknown for expenses without submitter name", () => {
    const digest: AlertDigest = {
      ...emptyDigest,
      overdueExpenses: [
        {
          id: "e-no-name",
          url: "https://notion.so/e-no-name",
          claimTitle: "Anonymous claim",
          claimDescription: "",
          amount: 50,
          currency: "AED",
          expenseType: "Other",
          submissionDate: "2026-03-20",
          status: "Pending",
          submittedBy: [],
          daysOverdue: 8,
          alertReason: "pending_approval",
        },
      ],
      totalAlerts: 1,
    };
    const blocks = buildAlertBlocks(digest);
    const sectionTexts = blocks
      .filter((b) => b.type === "section")
      .map((b) =>
        "text" in b && b.text ? (b.text as { text: string }).text : "",
      );

    expect(sectionTexts.some((t) => t.includes("Unknown"))).toBe(true);
  });
});

describe("alerts cron handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    process.env.SLACK_DASHBOARD_CHANNEL_ID = "C-DASHBOARD";
  });

  it("skips posting when no overdue items", async () => {
    mockGetAlertDigest.mockResolvedValue(emptyDigest);

    const { default: handler } = await import("./alerts.get");
    const result = await handler({
      method: "GET",
      headers: { get: () => `Bearer test-secret` },
      node: { req: {}, res: { statusCode: 200 } },
    } as never);

    expect(result).toMatchObject({
      success: true,
      totalAlerts: 0,
      message: "No overdue items",
    });
    expect(mockChatPostMessage).not.toHaveBeenCalled();
  });

  it("posts alert message when overdue items exist", async () => {
    mockGetAlertDigest.mockResolvedValue(fullDigest);

    const { default: handler } = await import("./alerts.get");
    const result = await handler({
      method: "GET",
      headers: { get: () => `Bearer test-secret` },
      node: { req: {}, res: { statusCode: 200 } },
    } as never);

    expect(result).toMatchObject({ success: true, totalAlerts: 4 });
    expect(mockChatPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C-DASHBOARD",
        text: expect.stringContaining("4 items"),
      }),
    );
  });
});
