import { describe, expect, it } from "vitest";
import type { SLACheckInput } from "./sla";
import { checkSLAViolations, DEFAULT_SLA, getDaysOverdue } from "./sla";

const NOW = new Date("2026-03-28T12:00:00Z");

function hoursAgo(hours: number): string {
  const d = new Date(NOW);
  d.setTime(d.getTime() - hours * 60 * 60 * 1000);
  return d.toISOString();
}

describe("checkSLAViolations", () => {
  it("detects overdue pending expense claim (>72h)", () => {
    const items: SLACheckInput[] = [
      {
        entityType: "expense_claim",
        entityId: "e1",
        entityTitle: "Old taxi",
        entityUrl: "https://notion.so/e1",
        status: "pending",
        statusSinceDate: hoursAgo(100),
      },
    ];

    const violations = checkSLAViolations(items, DEFAULT_SLA, NOW);

    expect(violations).toHaveLength(1);
    expect(violations[0].entityId).toBe("e1");
    expect(violations[0].hoursOverdue).toBe(28);
    expect(violations[0].slaConfig.maxDurationHours).toBe(72);
  });

  it("does not flag items within SLA", () => {
    const items: SLACheckInput[] = [
      {
        entityType: "expense_claim",
        entityId: "e2",
        entityTitle: "Recent lunch",
        entityUrl: "https://notion.so/e2",
        status: "pending",
        statusSinceDate: hoursAgo(24),
      },
    ];

    const violations = checkSLAViolations(items, DEFAULT_SLA, NOW);

    expect(violations).toHaveLength(0);
  });

  it("skips items with null statusSinceDate", () => {
    const items: SLACheckInput[] = [
      {
        entityType: "expense_claim",
        entityId: "e3",
        entityTitle: "No date",
        entityUrl: "https://notion.so/e3",
        status: "pending",
        statusSinceDate: null,
      },
    ];

    const violations = checkSLAViolations(items, DEFAULT_SLA, NOW);

    expect(violations).toHaveLength(0);
  });

  it("skips items with no matching SLA config", () => {
    const items: SLACheckInput[] = [
      {
        entityType: "task",
        entityId: "t1",
        entityTitle: "Some task",
        entityUrl: "https://notion.so/t1",
        status: "in_progress",
        statusSinceDate: hoursAgo(200),
      },
    ];

    const violations = checkSLAViolations(items, DEFAULT_SLA, NOW);

    expect(violations).toHaveLength(0);
  });

  it("detects overdue approved expense claim (awaiting payment)", () => {
    const items: SLACheckInput[] = [
      {
        entityType: "expense_claim",
        entityId: "e4",
        entityTitle: "Approved old",
        entityUrl: "https://notion.so/e4",
        status: "approved",
        statusSinceDate: hoursAgo(96),
      },
    ];

    const violations = checkSLAViolations(items, DEFAULT_SLA, NOW);

    expect(violations).toHaveLength(1);
    expect(violations[0].hoursOverdue).toBe(24);
  });

  it("detects overdue recruitment and feedback", () => {
    const items: SLACheckInput[] = [
      {
        entityType: "recruitment",
        entityId: "r1",
        entityTitle: "Bob",
        entityUrl: "https://notion.so/r1",
        status: "pending",
        statusSinceDate: hoursAgo(120),
      },
      {
        entityType: "feedback",
        entityId: "f1",
        entityTitle: "Old bug",
        entityUrl: "https://notion.so/f1",
        status: "pending",
        statusSinceDate: hoursAgo(80),
      },
    ];

    const violations = checkSLAViolations(items, DEFAULT_SLA, NOW);

    expect(violations).toHaveLength(2);
    expect(violations[0].entityId).toBe("r1");
    expect(violations[1].entityId).toBe("f1");
  });

  it("uses custom SLA configs when provided", () => {
    const customSLA = [
      {
        entityType: "task" as const,
        status: "in_progress" as const,
        maxDurationHours: 24,
      },
    ];

    const items: SLACheckInput[] = [
      {
        entityType: "task",
        entityId: "t1",
        entityTitle: "Stuck task",
        entityUrl: "https://notion.so/t1",
        status: "in_progress",
        statusSinceDate: hoursAgo(48),
      },
    ];

    const violations = checkSLAViolations(items, customSLA, NOW);

    expect(violations).toHaveLength(1);
    expect(violations[0].hoursOverdue).toBe(24);
  });

  it("returns empty array for empty input", () => {
    expect(checkSLAViolations([], DEFAULT_SLA, NOW)).toEqual([]);
  });

  it("handles exact boundary (exactly at SLA limit)", () => {
    const items: SLACheckInput[] = [
      {
        entityType: "expense_claim",
        entityId: "e5",
        entityTitle: "Boundary",
        entityUrl: "https://notion.so/e5",
        status: "pending",
        statusSinceDate: hoursAgo(72),
      },
    ];

    const violations = checkSLAViolations(items, DEFAULT_SLA, NOW);

    expect(violations).toHaveLength(1);
    expect(violations[0].hoursOverdue).toBe(0);
  });
});

describe("getDaysOverdue", () => {
  it("converts hours to days", () => {
    expect(getDaysOverdue(72)).toBe(3);
    expect(getDaysOverdue(48)).toBe(2);
    expect(getDaysOverdue(23)).toBe(0);
    expect(getDaysOverdue(0)).toBe(0);
  });
});
