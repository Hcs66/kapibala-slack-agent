import { describe, expect, it } from "vitest";
import {
  canTransition,
  getValidTransitions,
  InvalidTransitionError,
  transition,
} from "./status-machine";
import type { WorkflowEntity } from "./types";

function makeEntity(overrides: Partial<WorkflowEntity> = {}): WorkflowEntity {
  return {
    id: "test-id",
    type: "expense_claim",
    title: "Test Entity",
    owner: "user-1",
    status: "pending",
    logs: [],
    approvals: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    notionPageId: "page-1",
    notionPageUrl: "https://notion.so/page-1",
    metadata: {},
    ...overrides,
  };
}

describe("getValidTransitions", () => {
  it("returns valid targets for expense_claim pending", () => {
    expect(getValidTransitions("expense_claim", "pending")).toEqual([
      "approved",
      "rejected",
      "cancelled",
    ]);
  });

  it("returns valid targets for task pending", () => {
    expect(getValidTransitions("task", "pending")).toEqual([
      "in_progress",
      "cancelled",
    ]);
  });

  it("returns empty array for terminal states", () => {
    expect(getValidTransitions("expense_claim", "done")).toEqual([]);
    expect(getValidTransitions("task", "done")).toEqual([]);
    expect(getValidTransitions("expense_claim", "cancelled")).toEqual([]);
  });

  it("returns empty array for unmapped status", () => {
    expect(getValidTransitions("task", "approved")).toEqual([]);
  });

  it("allows expense_claim approved → done", () => {
    expect(getValidTransitions("expense_claim", "approved")).toContain("done");
  });

  it("allows task in_progress → done and back to pending", () => {
    const targets = getValidTransitions("task", "in_progress");
    expect(targets).toContain("done");
    expect(targets).toContain("pending");
  });

  it("allows feedback in_progress → done and back to pending", () => {
    const targets = getValidTransitions("feedback", "in_progress");
    expect(targets).toContain("done");
    expect(targets).toContain("pending");
  });

  it("allows recruitment pending → in_progress, rejected, cancelled", () => {
    const targets = getValidTransitions("recruitment", "pending");
    expect(targets).toContain("in_progress");
    expect(targets).toContain("rejected");
    expect(targets).toContain("cancelled");
  });
});

describe("canTransition", () => {
  it("returns true for valid transitions", () => {
    expect(canTransition("expense_claim", "pending", "approved")).toBe(true);
    expect(canTransition("task", "pending", "in_progress")).toBe(true);
    expect(canTransition("feedback", "pending", "in_progress")).toBe(true);
  });

  it("returns false for invalid transitions", () => {
    expect(canTransition("expense_claim", "pending", "done")).toBe(false);
    expect(canTransition("task", "pending", "done")).toBe(false);
    expect(canTransition("task", "done", "pending")).toBe(false);
  });

  it("returns false for same-status transition", () => {
    expect(canTransition("task", "pending", "pending")).toBe(false);
  });
});

describe("transition", () => {
  it("transitions entity and appends log entry", () => {
    const entity = makeEntity({ status: "pending" });
    const result = transition(entity, "approved", "approver-1", "Looks good");

    expect(result.status).toBe("approved");
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].actor).toBe("approver-1");
    expect(result.logs[0].action).toBe("status_change:pending→approved");
    expect(result.logs[0].detail).toBe("Looks good");
    expect(result.updatedAt).toBe(result.logs[0].timestamp);
  });

  it("preserves existing logs", () => {
    const entity = makeEntity({
      status: "pending",
      logs: [
        {
          timestamp: "2026-01-01T00:00:00Z",
          actor: "system",
          action: "created",
          detail: "",
        },
      ],
    });
    const result = transition(entity, "approved", "approver-1");

    expect(result.logs).toHaveLength(2);
    expect(result.logs[0].action).toBe("created");
    expect(result.logs[1].action).toBe("status_change:pending→approved");
  });

  it("does not mutate the original entity", () => {
    const entity = makeEntity({ status: "pending" });
    const result = transition(entity, "approved", "approver-1");

    expect(entity.status).toBe("pending");
    expect(entity.logs).toHaveLength(0);
    expect(result.status).toBe("approved");
  });

  it("throws InvalidTransitionError for invalid transition", () => {
    const entity = makeEntity({ status: "pending" });

    expect(() => transition(entity, "done", "user-1")).toThrow(
      InvalidTransitionError,
    );
  });

  it("InvalidTransitionError contains useful info", () => {
    const entity = makeEntity({ status: "pending" });

    try {
      transition(entity, "done", "user-1");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTransitionError);
      const err = error as InvalidTransitionError;
      expect(err.entityType).toBe("expense_claim");
      expect(err.from).toBe("pending");
      expect(err.to).toBe("done");
      expect(err.message).toContain("approved");
    }
  });

  it("uses empty string for detail when not provided", () => {
    const entity = makeEntity({ status: "pending" });
    const result = transition(entity, "approved", "approver-1");

    expect(result.logs[0].detail).toBe("");
  });

  it("handles task lifecycle: pending → in_progress → done", () => {
    const entity = makeEntity({ type: "task", status: "pending" });
    const step1 = transition(entity, "in_progress", "dev-1", "Started work");
    const step2 = transition(step1, "done", "dev-1", "Completed");

    expect(step2.status).toBe("done");
    expect(step2.logs).toHaveLength(2);
  });
});
