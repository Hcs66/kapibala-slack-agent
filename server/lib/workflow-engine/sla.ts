import type { EntityType, WorkflowStatus } from "./types";

export interface SLAConfig {
  entityType: EntityType;
  status: WorkflowStatus;
  maxDurationHours: number;
  escalationChannelEnvKey?: string;
}

export const DEFAULT_SLA: SLAConfig[] = [
  {
    entityType: "expense_claim",
    status: "pending",
    maxDurationHours: 72,
    escalationChannelEnvKey: "SLACK_DASHBOARD_CHANNEL_ID",
  },
  {
    entityType: "expense_claim",
    status: "approved",
    maxDurationHours: 72,
    escalationChannelEnvKey: "SLACK_DASHBOARD_CHANNEL_ID",
  },
  {
    entityType: "recruitment",
    status: "pending",
    maxDurationHours: 72,
    escalationChannelEnvKey: "SLACK_DASHBOARD_CHANNEL_ID",
  },
  {
    entityType: "feedback",
    status: "pending",
    maxDurationHours: 72,
    escalationChannelEnvKey: "SLACK_DASHBOARD_CHANNEL_ID",
  },
];

export interface SLAViolation {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  entityUrl: string;
  status: WorkflowStatus;
  hoursOverdue: number;
  slaConfig: SLAConfig;
}

export interface SLACheckInput {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  entityUrl: string;
  status: WorkflowStatus;
  statusSinceDate: string | null;
}

export function checkSLAViolations(
  items: SLACheckInput[],
  slaConfigs: SLAConfig[] = DEFAULT_SLA,
  now: Date = new Date(),
): SLAViolation[] {
  const violations: SLAViolation[] = [];

  for (const item of items) {
    if (!item.statusSinceDate) continue;

    const matchingConfig = slaConfigs.find(
      (c) => c.entityType === item.entityType && c.status === item.status,
    );
    if (!matchingConfig) continue;

    const sinceMs = new Date(item.statusSinceDate).getTime();
    const elapsedHours = (now.getTime() - sinceMs) / (1000 * 60 * 60);

    if (elapsedHours >= matchingConfig.maxDurationHours) {
      violations.push({
        entityType: item.entityType,
        entityId: item.entityId,
        entityTitle: item.entityTitle,
        entityUrl: item.entityUrl,
        status: item.status,
        hoursOverdue: Math.floor(
          elapsedHours - matchingConfig.maxDurationHours,
        ),
        slaConfig: matchingConfig,
      });
    }
  }

  return violations;
}

export function getDaysOverdue(hoursOverdue: number): number {
  return Math.floor(hoursOverdue / 24);
}
