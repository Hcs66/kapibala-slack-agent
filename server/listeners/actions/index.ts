import type { App } from "@slack/bolt";
import {
  CANDIDATE_RESUME_UPLOAD_ACTION,
  CHANNEL_JOIN_APPROVAL_ACTION,
  EXPENSE_CLAIM_AGENT_APPROVAL_ACTION,
  EXPENSE_INVOICE_UPLOAD_ACTION,
  SAVE_DOC_ACTION,
} from "~/lib/slack/blocks";
import { EXPENSE_CLAIM_APPROVAL_ACTION } from "../views/expense-claim-form";
import { candidateResumeUploadCallback } from "./candidate-resume-upload";
import { channelJoinApprovalCallback } from "./channel-join-approval";
import { expenseClaimAgentApprovalCallback } from "./expense-claim-agent-approval";
import { expenseClaimApprovalCallback } from "./expense-claim-approval";
import { expenseClaimPayCallback } from "./expense-claim-pay";
import { expenseInvoiceUploadCallback } from "./expense-invoice-upload";
import { feedbackButtonsCallback } from "./feedback-button-action";
import sampleActionCallback from "./sample-action";
import { saveDocApprovalCallback } from "./save-doc-approval";

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
  app.action("expense_claim_pay", expenseClaimPayCallback);
  app.action(CANDIDATE_RESUME_UPLOAD_ACTION, candidateResumeUploadCallback);
  app.action(EXPENSE_INVOICE_UPLOAD_ACTION, expenseInvoiceUploadCallback);
  app.action(SAVE_DOC_ACTION, saveDocApprovalCallback);
  app.action(`${SAVE_DOC_ACTION}_reject`, saveDocApprovalCallback);
};

export default { register };
