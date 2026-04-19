import { describe, expect, it } from "vitest";
import { fromNotionStatus, NOTION_STATUS_MAP, toNotionStatus } from "./types";

describe("NOTION_STATUS_MAP", () => {
  it("maps all expense_claim Notion statuses", () => {
    expect(NOTION_STATUS_MAP.expense_claim.Pending).toBe("pending");
    expect(NOTION_STATUS_MAP.expense_claim.Approved).toBe("approved");
    expect(NOTION_STATUS_MAP.expense_claim.Rejected).toBe("rejected");
    expect(NOTION_STATUS_MAP.expense_claim.Paid).toBe("done");
  });

  it("maps all task Notion statuses", () => {
    expect(NOTION_STATUS_MAP.task["To Do"]).toBe("pending");
    expect(NOTION_STATUS_MAP.task["In Progress"]).toBe("in_progress");
    expect(NOTION_STATUS_MAP.task.Done).toBe("done");
  });

  it("maps all recruitment Notion statuses", () => {
    expect(NOTION_STATUS_MAP.recruitment["Pending Review"]).toBe("pending");
    expect(NOTION_STATUS_MAP.recruitment.Interviewing).toBe("in_progress");
    expect(NOTION_STATUS_MAP.recruitment.Hired).toBe("done");
  });

  it("maps all feedback Notion statuses", () => {
    expect(NOTION_STATUS_MAP.feedback.Pending).toBe("pending");
    expect(NOTION_STATUS_MAP.feedback["In Progress"]).toBe("in_progress");
    expect(NOTION_STATUS_MAP.feedback.Resolved).toBe("done");
    expect(NOTION_STATUS_MAP.feedback.Closed).toBe("done");
  });
});

describe("toNotionStatus", () => {
  it("returns canonical Notion name for expense_claim", () => {
    expect(toNotionStatus("expense_claim", "pending")).toBe("Pending");
    expect(toNotionStatus("expense_claim", "approved")).toBe("Approved");
    expect(toNotionStatus("expense_claim", "done")).toBe("Paid");
  });

  it("returns first match when multiple Notion names map to same status", () => {
    expect(toNotionStatus("feedback", "done")).toBe("Resolved");
  });

  it("returns undefined for unmapped status", () => {
    expect(toNotionStatus("task", "approved")).toBeUndefined();
  });
});

describe("fromNotionStatus", () => {
  it("converts Notion status to WorkflowStatus", () => {
    expect(fromNotionStatus("expense_claim", "Pending")).toBe("pending");
    expect(fromNotionStatus("task", "In Progress")).toBe("in_progress");
    expect(fromNotionStatus("recruitment", "Hired")).toBe("done");
  });

  it("returns undefined for unknown Notion status", () => {
    expect(fromNotionStatus("task", "Unknown")).toBeUndefined();
  });
});
