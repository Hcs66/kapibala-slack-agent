import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/notion/query", () => ({
  queryExpenseClaims: vi.fn(),
  queryFeedback: vi.fn(),
  queryRecruitment: vi.fn(),
}));

import {
  queryExpenseClaims,
  queryFeedback,
  queryRecruitment,
} from "~/lib/notion/query";
import { getAlertDigest, getDaysOverdue } from "./alerts";

const mockQueryExpenseClaims = vi.mocked(queryExpenseClaims);
const mockQueryFeedback = vi.mocked(queryFeedback);
const mockQueryRecruitment = vi.mocked(queryRecruitment);

const NOW = new Date("2026-03-28T12:00:00Z");

function daysAgo(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

describe("getDaysOverdue", () => {
  it("returns null for null date", () => {
    expect(getDaysOverdue(null, NOW)).toBeNull();
  });

  it("returns 0 for today", () => {
    expect(getDaysOverdue("2026-03-28", NOW)).toBe(0);
  });

  it("returns correct days for past date", () => {
    expect(getDaysOverdue("2026-03-23", NOW)).toBe(5);
  });

  it("returns negative for future date", () => {
    expect(getDaysOverdue("2026-03-30", NOW)).toBe(-2);
  });
});

describe("getAlertDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns overdue pending expenses (>=3 days)", async () => {
    mockQueryExpenseClaims
      .mockResolvedValueOnce([
        {
          id: "e1",
          url: "https://notion.so/e1",
          claimTitle: "Old taxi",
          claimDescription: "",
          amount: 100,
          expenseType: "Travel",
          submissionDate: daysAgo(5),
          status: "Pending",
          submittedBy: [{ id: "u1", name: "Alice" }],
        },
        {
          id: "e2",
          url: "https://notion.so/e2",
          claimTitle: "Recent lunch",
          claimDescription: "",
          amount: 50,
          expenseType: "Meals",
          submissionDate: daysAgo(1),
          status: "Pending",
          submittedBy: [],
        },
      ])
      .mockResolvedValueOnce([]);
    mockQueryRecruitment.mockResolvedValue([]);
    mockQueryFeedback.mockResolvedValue([]);

    const digest = await getAlertDigest(NOW);

    expect(digest.overdueExpenses).toHaveLength(1);
    expect(digest.overdueExpenses[0].claimTitle).toBe("Old taxi");
    expect(digest.overdueExpenses[0].daysOverdue).toBe(5);
    expect(digest.overdueExpenses[0].alertReason).toBe("pending_approval");
    expect(digest.totalAlerts).toBe(1);
  });

  it("returns overdue approved expenses awaiting payment", async () => {
    mockQueryExpenseClaims.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: "e3",
        url: "https://notion.so/e3",
        claimTitle: "Approved old claim",
        claimDescription: "",
        amount: 200,
        expenseType: "Travel",
        submissionDate: daysAgo(4),
        status: "Approved",
        submittedBy: [],
      },
    ]);
    mockQueryRecruitment.mockResolvedValue([]);
    mockQueryFeedback.mockResolvedValue([]);

    const digest = await getAlertDigest(NOW);

    expect(digest.overdueExpenses).toHaveLength(1);
    expect(digest.overdueExpenses[0].alertReason).toBe("pending_payment");
    expect(digest.overdueExpenses[0].daysOverdue).toBe(4);
  });

  it("returns overdue recruitment candidates", async () => {
    mockQueryExpenseClaims.mockResolvedValue([]);
    mockQueryRecruitment.mockResolvedValue([
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
      },
    ]);
    mockQueryFeedback.mockResolvedValue([]);

    const digest = await getAlertDigest(NOW);

    expect(digest.overdueRecruitment).toHaveLength(1);
    expect(digest.overdueRecruitment[0].candidateName).toBe("Bob");
  });

  it("returns overdue feedback (>=3 days)", async () => {
    mockQueryExpenseClaims.mockResolvedValue([]);
    mockQueryRecruitment.mockResolvedValue([]);
    mockQueryFeedback.mockResolvedValue([
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
        createdDate: daysAgo(7),
        dueDate: null,
        tags: [],
      },
      {
        id: "f2",
        url: "https://notion.so/f2",
        name: "New bug",
        type: "Bug",
        status: "Pending",
        description: "Just reported",
        priority: "P2",
        source: "Internal",
        customer: "",
        assignedTo: [],
        createdBy: [],
        createdDate: daysAgo(1),
        dueDate: null,
        tags: [],
      },
    ]);

    const digest = await getAlertDigest(NOW);

    expect(digest.overdueFeedback).toHaveLength(1);
    expect(digest.overdueFeedback[0].name).toBe("Old bug");
    expect(digest.overdueFeedback[0].daysOverdue).toBe(7);
  });

  it("returns empty digest when nothing is overdue", async () => {
    mockQueryExpenseClaims.mockResolvedValue([]);
    mockQueryRecruitment.mockResolvedValue([]);
    mockQueryFeedback.mockResolvedValue([]);

    const digest = await getAlertDigest(NOW);

    expect(digest.totalAlerts).toBe(0);
    expect(digest.overdueExpenses).toHaveLength(0);
    expect(digest.overdueRecruitment).toHaveLength(0);
    expect(digest.overdueFeedback).toHaveLength(0);
  });

  it("combines alerts from all categories", async () => {
    mockQueryExpenseClaims
      .mockResolvedValueOnce([
        {
          id: "e1",
          url: "https://notion.so/e1",
          claimTitle: "Old expense",
          claimDescription: "",
          amount: 100,
          expenseType: "Travel",
          submissionDate: daysAgo(5),
          status: "Pending",
          submittedBy: [],
        },
      ])
      .mockResolvedValueOnce([]);
    mockQueryRecruitment.mockResolvedValue([
      {
        id: "r1",
        url: "https://notion.so/r1",
        candidateName: "Charlie",
        positionApplied: "PM",
        status: "Pending Review",
        resumeSource: "Referral",
        email: null,
        phone: null,
        interviewTime: null,
      },
    ]);
    mockQueryFeedback.mockResolvedValue([
      {
        id: "f1",
        url: "https://notion.so/f1",
        name: "Stale feedback",
        type: "Feature Request",
        status: "Pending",
        description: "",
        priority: "P3",
        source: "Internal",
        customer: "",
        assignedTo: [],
        createdBy: [],
        createdDate: daysAgo(10),
        dueDate: null,
        tags: [],
      },
    ]);

    const digest = await getAlertDigest(NOW);

    expect(digest.totalAlerts).toBe(3);
    expect(digest.overdueExpenses).toHaveLength(1);
    expect(digest.overdueRecruitment).toHaveLength(1);
    expect(digest.overdueFeedback).toHaveLength(1);
  });

  it("excludes expenses with null submission date", async () => {
    mockQueryExpenseClaims
      .mockResolvedValueOnce([
        {
          id: "e-null",
          url: "https://notion.so/e-null",
          claimTitle: "No date",
          claimDescription: "",
          amount: 50,
          expenseType: "Other",
          submissionDate: null,
          status: "Pending",
          submittedBy: [],
        },
      ])
      .mockResolvedValueOnce([]);
    mockQueryRecruitment.mockResolvedValue([]);
    mockQueryFeedback.mockResolvedValue([]);

    const digest = await getAlertDigest(NOW);

    expect(digest.overdueExpenses).toHaveLength(0);
  });

  it("excludes feedback with null created date", async () => {
    mockQueryExpenseClaims.mockResolvedValue([]);
    mockQueryRecruitment.mockResolvedValue([]);
    mockQueryFeedback.mockResolvedValue([
      {
        id: "f-null",
        url: "https://notion.so/f-null",
        name: "No date feedback",
        type: "Bug",
        status: "Pending",
        description: "",
        priority: "P2",
        source: "Internal",
        customer: "",
        assignedTo: [],
        createdBy: [],
        createdDate: null,
        dueDate: null,
        tags: [],
      },
    ]);

    const digest = await getAlertDigest(NOW);

    expect(digest.overdueFeedback).toHaveLength(0);
  });
});
