import { tool } from "ai";
import { z } from "zod";
import type { SLACheckInput } from "~/lib/workflow-engine/sla";
import { checkSLAViolations } from "~/lib/workflow-engine/sla";
import { fromNotionStatus } from "~/lib/workflow-engine/types";

const checkAlerts = tool({
  description:
    "Check for overdue items and SLA violations across all modules (expense claims, recruitment, feedback). Use when user asks about alerts, overdue items, or what needs attention.",
  inputSchema: z.object({}),
  execute: async (_input, { experimental_context: _ctx }) => {
    "use step";

    const { queryExpenseClaims, queryRecruitment, queryFeedback } =
      await import("~/lib/notion/query");

    try {
      const [expenseClaims, recruitment, feedback] = await Promise.all([
        queryExpenseClaims({ status: "Pending" }),
        queryRecruitment({ status: "Pending Review" }),
        queryFeedback({ status: "Pending" }),
      ]);

      const slaInputs: SLACheckInput[] = [
        ...expenseClaims.map((e) => ({
          entityType: "expense_claim" as const,
          entityId: e.id,
          entityTitle: e.claimTitle,
          entityUrl: e.url,
          status:
            fromNotionStatus("expense_claim", e.status ?? "") ??
            ("pending" as const),
          statusSinceDate: e.submissionDate,
        })),
        ...recruitment.map((r) => ({
          entityType: "recruitment" as const,
          entityId: r.id,
          entityTitle: r.candidateName,
          entityUrl: r.url,
          status:
            fromNotionStatus("recruitment", r.status ?? "") ??
            ("pending" as const),
          statusSinceDate: r.interviewTime,
        })),
        ...feedback.map((f) => ({
          entityType: "feedback" as const,
          entityId: f.id,
          entityTitle: f.name,
          entityUrl: f.url,
          status:
            fromNotionStatus("feedback", f.status ?? "") ??
            ("pending" as const),
          statusSinceDate: f.createdDate,
        })),
      ];

      const violations = checkSLAViolations(slaInputs);

      if (violations.length === 0) {
        return {
          success: true,
          message:
            "No SLA violations found. All items are within their expected timeframes.",
          violations: [],
          summary: {
            total: 0,
            byType: {},
          },
        };
      }

      const byType: Record<string, number> = {};
      const formatted = violations.map((v) => {
        byType[v.entityType] = (byType[v.entityType] ?? 0) + 1;
        const days = Math.floor(v.hoursOverdue / 24);
        const urgency = days >= 7 ? "🔴" : days >= 3 ? "🟡" : "⚠️";
        return `${urgency} *${v.entityTitle}* (${v.entityType.replace("_", " ")}) — overdue by ${days}d ${v.hoursOverdue % 24}h | <${v.entityUrl}|View in Notion>`;
      });

      return {
        success: true,
        message: `Found ${violations.length} SLA violation(s).`,
        formatted: formatted.join("\n"),
        violations,
        summary: {
          total: violations.length,
          byType,
        },
      };
    } catch (error) {
      console.error("Failed to check alerts:", error);
      return {
        success: false,
        message: "Failed to check SLA violations",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const alertTools = { checkAlerts };
