import { describe, expect, it } from "vitest";
import { createApprovalBlocks, processApproval } from "./approval";
import type { WorkflowEntity } from "./types";

function makeEntity(overrides: Partial<WorkflowEntity> = {}): WorkflowEntity {
  return {
    id: "test-id",
    type: "expense_claim",
    title: "Test Claim",
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

describe("createApprovalBlocks", () => {
  it("returns section + actions blocks", () => {
    const blocks = createApprovalBlocks({
      entityType: "expense_claim",
      entityId: "e1",
      entityTitle: "Taxi fare",
      requesterId: "U123",
      actionIdPrefix: "expense_approval",
      fields: [
        { label: "Amount", value: "$100" },
        { label: "Type", value: "Travel" },
      ],
      metadata: { pageId: "p1" },
    });

    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("section");
    expect(blocks[1].type).toBe("actions");
  });

  it("includes approve and reject buttons with correct action IDs", () => {
    const blocks = createApprovalBlocks({
      entityType: "expense_claim",
      entityId: "e1",
      entityTitle: "Taxi fare",
      requesterId: "U123",
      actionIdPrefix: "my_approval",
      fields: [],
      metadata: {},
    });

    const actionsBlock = blocks[1];
    if (actionsBlock.type !== "actions") throw new Error("Expected actions");
    expect(actionsBlock.elements).toHaveLength(2);

    const approveBtn = actionsBlock.elements[0];
    const rejectBtn = actionsBlock.elements[1];
    if (approveBtn.type !== "button" || rejectBtn.type !== "button") {
      throw new Error("Expected buttons");
    }

    expect(approveBtn.action_id).toBe("my_approval");
    expect(rejectBtn.action_id).toBe("my_approval_reject");
  });

  it("embeds metadata in button values", () => {
    const blocks = createApprovalBlocks({
      entityType: "expense_claim",
      entityId: "e1",
      entityTitle: "Taxi fare",
      requesterId: "U123",
      actionIdPrefix: "test",
      fields: [],
      metadata: { pageId: "p1", amount: 100 },
    });

    const actionsBlock = blocks[1];
    if (actionsBlock.type !== "actions") throw new Error("Expected actions");
    const approveBtn = actionsBlock.elements[0];
    if (approveBtn.type !== "button") throw new Error("Expected button");

    const parsed = JSON.parse(approveBtn.value ?? "{}");
    expect(parsed.pageId).toBe("p1");
    expect(parsed.amount).toBe(100);
    expect(parsed.approved).toBe(true);
    expect(parsed.entityId).toBe("e1");
  });
});

describe("processApproval", () => {
  it("approves entity and records approval", () => {
    const entity = makeEntity({ status: "pending" });
    const result = processApproval({
      entity,
      decision: "approved",
      approver: "approver-1",
      comment: "LGTM",
    });

    expect(result.entity.status).toBe("approved");
    expect(result.transitionValid).toBe(true);
    expect(result.approval.decision).toBe("approved");
    expect(result.approval.approver).toBe("approver-1");
    expect(result.approval.comment).toBe("LGTM");
    expect(result.entity.approvals).toHaveLength(1);
    expect(result.entity.logs).toHaveLength(1);
    expect(result.entity.logs[0].action).toBe("approval:approved");
  });

  it("rejects entity and records approval", () => {
    const entity = makeEntity({ status: "pending" });
    const result = processApproval({
      entity,
      decision: "rejected",
      approver: "approver-1",
    });

    expect(result.entity.status).toBe("rejected");
    expect(result.transitionValid).toBe(true);
    expect(result.approval.decision).toBe("rejected");
    expect(result.approval.comment).toBeUndefined();
  });

  it("does not change status when transition is invalid", () => {
    const entity = makeEntity({ status: "done" });
    const result = processApproval({
      entity,
      decision: "approved",
      approver: "approver-1",
    });

    expect(result.entity.status).toBe("done");
    expect(result.transitionValid).toBe(false);
    expect(result.entity.approvals).toHaveLength(1);
  });

  it("does not mutate original entity", () => {
    const entity = makeEntity({ status: "pending" });
    processApproval({
      entity,
      decision: "approved",
      approver: "approver-1",
    });

    expect(entity.status).toBe("pending");
    expect(entity.approvals).toHaveLength(0);
    expect(entity.logs).toHaveLength(0);
  });

  it("preserves existing logs and approvals", () => {
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
      approvals: [
        {
          approver: "old-approver",
          decision: "rejected",
          timestamp: "2026-01-01T00:00:00Z",
        },
      ],
    });

    const result = processApproval({
      entity,
      decision: "approved",
      approver: "approver-2",
    });

    expect(result.entity.logs).toHaveLength(2);
    expect(result.entity.approvals).toHaveLength(2);
  });
});
