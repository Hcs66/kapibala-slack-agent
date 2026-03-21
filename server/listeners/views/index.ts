import type { App } from "@slack/bolt";
import { CANDIDATE_RESUME_UPLOAD_VIEW_CALLBACK_ID } from "../actions/candidate-resume-upload";
import { EXPENSE_INVOICE_UPLOAD_VIEW_CALLBACK_ID } from "../actions/expense-invoice-upload";
import { EXPENSE_CLAIM_FORM_CALLBACK_ID } from "../shortcuts/expense-claim";
import { CANDIDATE_FORM_CALLBACK_ID } from "../shortcuts/new-candidate";
import { FEEDBACK_FORM_CALLBACK_ID } from "../shortcuts/new-feedback";
import candidateFormCallback from "./candidate-form";
import candidateResumeUploadViewCallback from "./candidate-resume-upload";
import expenseClaimFormCallback from "./expense-claim-form";
import expenseClaimPayModalCallback from "./expense-claim-pay-modal";
import expenseInvoiceUploadViewCallback from "./expense-invoice-upload";
import feedbackFormCallback from "./feedback-form";
import sampleViewCallback from "./sample-view";

const register = (app: App) => {
  app.view("sample_view_id", sampleViewCallback);
  app.view(FEEDBACK_FORM_CALLBACK_ID, feedbackFormCallback);
  app.view(EXPENSE_CLAIM_FORM_CALLBACK_ID, expenseClaimFormCallback);
  app.view("expense_claim_pay_modal", expenseClaimPayModalCallback);
  app.view(CANDIDATE_FORM_CALLBACK_ID, candidateFormCallback);
  app.view(
    CANDIDATE_RESUME_UPLOAD_VIEW_CALLBACK_ID,
    candidateResumeUploadViewCallback,
  );
  app.view(
    EXPENSE_INVOICE_UPLOAD_VIEW_CALLBACK_ID,
    expenseInvoiceUploadViewCallback,
  );
};

export default { register };
