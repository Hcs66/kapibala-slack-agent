import { describe, expect, it } from "vitest";
import {
  expenseClaimToEntity,
  feedbackToEntity,
  recruitmentToEntity,
  taskToEntity,
} from "./adapters";

describe("expenseClaimToEntity", () => {
  it("converts a pending expense claim", () => {
    const entity = expenseClaimToEntity({
      id: "e1",
      url: "https://notion.so/e1",
      claimTitle: "Taxi fare",
      claimDescription: "Airport taxi",
      amount: 100,
      currency: "USD",
      expenseType: "Travel",
      submissionDate: "2026-03-25",
      status: "Pending",
      submittedBy: [{ id: "u1", name: "Alice" }],
    });

    expect(entity.type).toBe("expense_claim");
    expect(entity.title).toBe("Taxi fare");
    expect(entity.status).toBe("pending");
    expect(entity.owner).toBe("u1");
    expect(entity.metadata.amount).toBe(100);
    expect(entity.metadata.currency).toBe("USD");
  });

  it("maps Approved status correctly", () => {
    const entity = expenseClaimToEntity({
      id: "e2",
      url: "https://notion.so/e2",
      claimTitle: "Lunch",
      claimDescription: "",
      amount: 50,
      currency: "USD",
      expenseType: "Meals",
      submissionDate: "2026-03-25",
      status: "Approved",
      submittedBy: [],
    });

    expect(entity.status).toBe("approved");
    expect(entity.owner).toBe("");
  });

  it("maps Paid status to done", () => {
    const entity = expenseClaimToEntity({
      id: "e3",
      url: "https://notion.so/e3",
      claimTitle: "Equipment",
      claimDescription: "",
      amount: 200,
      currency: "USD",
      expenseType: "Equipment",
      submissionDate: "2026-03-20",
      status: "Paid",
      submittedBy: [],
    });

    expect(entity.status).toBe("done");
  });

  it("defaults to pending for null status", () => {
    const entity = expenseClaimToEntity({
      id: "e4",
      url: "https://notion.so/e4",
      claimTitle: "Unknown",
      claimDescription: "",
      amount: null,
      currency: null,
      expenseType: null,
      submissionDate: null,
      status: null,
      submittedBy: [],
    });

    expect(entity.status).toBe("pending");
  });
});

describe("recruitmentToEntity", () => {
  it("converts a pending review candidate", () => {
    const entity = recruitmentToEntity({
      id: "r1",
      url: "https://notion.so/r1",
      candidateName: "Bob",
      positionApplied: "Engineer",
      status: "Pending Review",
      resumeSource: "LinkedIn",
      email: "bob@example.com",
      phone: null,
      interviewTime: "2026-04-01",
    });

    expect(entity.type).toBe("recruitment");
    expect(entity.title).toBe("Bob");
    expect(entity.status).toBe("pending");
    expect(entity.metadata.positionApplied).toBe("Engineer");
  });

  it("defaults to pending for unknown status", () => {
    const entity = recruitmentToEntity({
      id: "r2",
      url: "https://notion.so/r2",
      candidateName: "Charlie",
      positionApplied: null,
      status: "SomeUnknownStatus",
      resumeSource: null,
      email: null,
      phone: null,
      interviewTime: null,
    });

    expect(entity.status).toBe("pending");
  });
});

describe("taskToEntity", () => {
  it("converts a task with assignee", () => {
    const entity = taskToEntity({
      id: "t1",
      url: "https://notion.so/t1",
      name: "PG schema design",
      taskNum: "B1",
      status: "In Progress",
      priority: "High",
      description: "Design the schema",
      summary: "",
      log: "",
      assignee: [{ id: "u2", name: "Dev" }],
      dueDate: "2026-04-01",
      updatedAt: "2026-03-28T10:00:00Z",
    });

    expect(entity.type).toBe("task");
    expect(entity.title).toBe("B1 PG schema design");
    expect(entity.status).toBe("in_progress");
    expect(entity.priority).toBe("High");
    expect(entity.assignee).toBe("u2");
    expect(entity.dueDate).toBe("2026-04-01");
  });

  it("maps Done status correctly", () => {
    const entity = taskToEntity({
      id: "t2",
      url: "https://notion.so/t2",
      name: "Done task",
      taskNum: "A1",
      status: "Done",
      priority: "Low",
      description: "",
      summary: "",
      log: "",
      assignee: [],
      dueDate: null,
      updatedAt: null,
    });

    expect(entity.status).toBe("done");
    expect(entity.priority).toBe("Low");
  });
});

describe("feedbackToEntity", () => {
  it("converts a feedback record with priority", () => {
    const entity = feedbackToEntity({
      id: "f1",
      url: "https://notion.so/f1",
      name: "Login bug",
      type: "Bug",
      status: "Pending",
      description: "Login button broken",
      priority: "P1",
      source: "Customer",
      customer: "Acme",
      assignedTo: [{ id: "u3", name: "QA" }],
      createdBy: [{ id: "u4", name: "Reporter" }],
      createdDate: "2026-03-20",
      dueDate: "2026-04-01",
      tags: ["login", "critical"],
    });

    expect(entity.type).toBe("feedback");
    expect(entity.title).toBe("Login bug");
    expect(entity.status).toBe("pending");
    expect(entity.priority).toBe("P1");
    expect(entity.assignee).toBe("u3");
    expect(entity.owner).toBe("u4");
    expect(entity.metadata.customer).toBe("Acme");
    expect(entity.metadata.tags).toEqual(["login", "critical"]);
  });

  it("maps In Progress status correctly", () => {
    const entity = feedbackToEntity({
      id: "f2",
      url: "https://notion.so/f2",
      name: "Feature request",
      type: "Feature Request",
      status: "In Progress",
      description: "",
      priority: "P3",
      source: "Internal",
      customer: "",
      assignedTo: [],
      createdBy: [],
      createdDate: null,
      dueDate: null,
      tags: [],
    });

    expect(entity.status).toBe("in_progress");
    expect(entity.priority).toBe("P3");
  });
});
