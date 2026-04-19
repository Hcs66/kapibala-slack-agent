import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/notion/query", () => ({
  queryExpenseClaims: vi.fn(),
  queryFeedback: vi.fn(),
  queryRecruitment: vi.fn(),
  queryTasks: vi.fn(),
}));

vi.mock("~/lib/workflow-engine/adapters", () => ({
  expenseClaimToEntity: vi.fn((r) => ({
    id: r.id,
    type: "expense_claim",
    title: r.claimTitle,
    status: r.status === "Pending" ? "pending" : "approved",
    owner: "",
    createdAt: r.submissionDate ?? "",
    updatedAt: r.submissionDate ?? "",
    notionPageId: r.id,
    notionPageUrl: r.url,
    metadata: { amount: r.amount, currency: r.currency },
    logs: [],
    approvals: [],
  })),
  feedbackToEntity: vi.fn((r) => ({
    id: r.id,
    type: "feedback",
    title: r.name,
    status: "pending",
    owner: "",
    createdAt: r.createdDate ?? "",
    updatedAt: r.createdDate ?? "",
    notionPageId: r.id,
    notionPageUrl: r.url,
    metadata: {},
    logs: [],
    approvals: [],
  })),
  recruitmentToEntity: vi.fn((r) => ({
    id: r.id,
    type: "recruitment",
    title: r.candidateName,
    status: "pending",
    owner: "",
    createdAt: "",
    updatedAt: "",
    notionPageId: r.id,
    notionPageUrl: r.url,
    metadata: {},
    logs: [],
    approvals: [],
  })),
  taskToEntity: vi.fn((r) => ({
    id: r.id,
    type: "task",
    title: r.name,
    status: r.status === "To Do" ? "pending" : "in_progress",
    owner: "",
    createdAt: r.updatedAt ?? "",
    updatedAt: r.updatedAt ?? "",
    notionPageId: r.id,
    notionPageUrl: r.url,
    metadata: {},
    logs: [],
    approvals: [],
  })),
}));

import {
  queryExpenseClaims,
  queryFeedback,
  queryRecruitment,
  queryTasks,
} from "~/lib/notion/query";
import { getUserPendingItems } from "./aggregation";

const mockQueryExpenseClaims = vi.mocked(queryExpenseClaims);
const mockQueryFeedback = vi.mocked(queryFeedback);
const mockQueryRecruitment = vi.mocked(queryRecruitment);
const mockQueryTasks = vi.mocked(queryTasks);

function makeExpense(id: string, status: string) {
  return {
    id,
    url: `https://notion.so/${id}`,
    claimTitle: `Expense ${id}`,
    claimDescription: "",
    amount: 100,
    currency: "USD",
    expenseType: "Travel",
    submissionDate: "2026-04-01",
    status,
    submittedBy: [{ id: "u1", name: "Alice" }],
  };
}

function makeFeedback(id: string) {
  return {
    id,
    url: `https://notion.so/${id}`,
    name: `Feedback ${id}`,
    type: "Bug",
    status: "Pending",
    description: "",
    priority: "P1",
    source: "Internal",
    customer: "",
    assignedTo: [{ id: "u1", name: "Alice" }],
    createdBy: [],
    createdDate: "2026-04-01",
    dueDate: null,
    tags: [],
  };
}

function makeRecruitment(id: string) {
  return {
    id,
    url: `https://notion.so/${id}`,
    candidateName: `Candidate ${id}`,
    positionApplied: "Engineer",
    status: "Pending Review",
    resumeSource: null,
    email: null,
    phone: null,
    interviewTime: null,
  };
}

function makeTask(id: string, status: string) {
  return {
    id,
    url: `https://notion.so/${id}`,
    name: `Task ${id}`,
    taskNum: id,
    status,
    priority: "High",
    description: "",
    summary: "",
    log: "",
    assignee: [{ id: "u1", name: "Alice" }],
    dueDate: null,
    updatedAt: "2026-04-01T00:00:00Z",
  };
}

describe("getUserPendingItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryExpenseClaims.mockResolvedValue([]);
    mockQueryFeedback.mockResolvedValue([]);
    mockQueryRecruitment.mockResolvedValue([]);
    mockQueryTasks.mockResolvedValue([]);
  });

  it("returns empty result when no pending items", async () => {
    const result = await getUserPendingItems("u1");

    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.countByCategory.expense_approval).toBe(0);
    expect(result.countByCategory.task).toBe(0);
  });

  it("aggregates items from all modules", async () => {
    mockQueryExpenseClaims.mockImplementation(async ({ status }) => {
      if (status === "Pending") return [makeExpense("e1", "Pending")];
      if (status === "Approved") return [makeExpense("e2", "Approved")];
      return [];
    });
    mockQueryFeedback.mockResolvedValue([makeFeedback("f1")]);
    mockQueryRecruitment.mockResolvedValue([makeRecruitment("r1")]);
    mockQueryTasks
      .mockResolvedValueOnce([makeTask("t1", "To Do")])
      .mockResolvedValueOnce([]);

    const result = await getUserPendingItems("u1");

    expect(result.total).toBe(5);
    expect(result.countByCategory.expense_approval).toBe(1);
    expect(result.countByCategory.expense_payment).toBe(1);
    expect(result.countByCategory.feedback).toBe(1);
    expect(result.countByCategory.recruitment).toBe(1);
    expect(result.countByCategory.task).toBe(1);
  });

  it("filters by specific categories", async () => {
    mockQueryExpenseClaims.mockResolvedValue([makeExpense("e1", "Pending")]);
    mockQueryFeedback.mockResolvedValue([makeFeedback("f1")]);

    const result = await getUserPendingItems("u1", ["expense_approval"]);

    expect(result.total).toBe(1);
    expect(result.countByCategory.expense_approval).toBe(1);
    expect(result.countByCategory.feedback).toBe(0);
    expect(mockQueryFeedback).not.toHaveBeenCalled();
  });

  it("passes notionUserId filter to expense queries", async () => {
    mockQueryExpenseClaims.mockResolvedValue([]);

    await getUserPendingItems("user-123", ["expense_approval"]);

    expect(mockQueryExpenseClaims).toHaveBeenCalledWith({
      status: "Pending",
      submitterNotionUserId: "user-123",
    });
  });

  it("passes notionUserId filter to feedback queries", async () => {
    mockQueryFeedback.mockResolvedValue([]);

    await getUserPendingItems("user-123", ["feedback"]);

    expect(mockQueryFeedback).toHaveBeenCalledWith({
      status: "Pending",
      assigneeNotionUserId: "user-123",
    });
  });

  it("passes notionUserId filter to task queries", async () => {
    mockQueryTasks.mockResolvedValue([]);

    await getUserPendingItems("user-123", ["task"]);

    expect(mockQueryTasks).toHaveBeenCalledWith({
      assigneeNotionUserId: "user-123",
      status: "To Do",
    });
  });

  it("omits user filter when notionUserId is null", async () => {
    mockQueryExpenseClaims.mockResolvedValue([]);

    await getUserPendingItems(null, ["expense_approval"]);

    expect(mockQueryExpenseClaims).toHaveBeenCalledWith({
      status: "Pending",
    });
  });

  it("queries both To Do and In Progress for tasks", async () => {
    mockQueryTasks
      .mockResolvedValueOnce([makeTask("t1", "To Do")])
      .mockResolvedValueOnce([makeTask("t2", "In Progress")]);

    const result = await getUserPendingItems("u1", ["task"]);

    expect(result.countByCategory.task).toBe(2);
    expect(mockQueryTasks).toHaveBeenCalledTimes(2);
  });
});
