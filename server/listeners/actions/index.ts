import type { App } from "@slack/bolt";
import {
  CHANNEL_JOIN_APPROVAL_ACTION,
  EXPENSE_CLAIM_AGENT_APPROVAL_ACTION,
} from "~/lib/slack/blocks";
import { EXPENSE_CLAIM_APPROVAL_ACTION } from "../views/expense-claim-form";
import { channelJoinApprovalCallback } from "./channel-join-approval";
import { expenseClaimAgentApprovalCallback } from "./expense-claim-agent-approval";
import { expenseClaimApprovalCallback } from "./expense-claim-approval";
import { feedbackButtonsCallback } from "./feedback-button-action";
import sampleActionCallback from "./sample-action";

const register = (app: App) => {
  app.action("sample_action_id", sampleActionCallback);
  app.action("feedback", feedbackButtonsCallback);
  app.action(CHANNEL_JOIN_APPROVAL_ACTION, channelJoinApprovalCallback);
  app.action(
    `${CHANNEL_JOIN_APPROVAL_ACTION}_reject`,
    channelJoinApprovalCallback,
  );
  app.action(EXPENSE_CLAIM_APPROVAL_ACTION, expenseClaimApprovalCallback);
  app.action(
    `${EXPENSE_CLAIM_APPROVAL_ACTION}_reject`,
    expenseClaimApprovalCallback,
  );
  app.action(
    EXPENSE_CLAIM_AGENT_APPROVAL_ACTION,
    expenseClaimAgentApprovalCallback,
  );
  app.action(
    `${EXPENSE_CLAIM_AGENT_APPROVAL_ACTION}_reject`,
    expenseClaimAgentApprovalCallback,
  );
};

export default { register };
