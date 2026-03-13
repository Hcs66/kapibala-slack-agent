import type { App } from "@slack/bolt";
import { EXPENSE_CLAIM_FORM_CALLBACK_ID } from "../shortcuts/expense-claim";
import { CANDIDATE_FORM_CALLBACK_ID } from "../shortcuts/new-candidate";
import { FEEDBACK_FORM_CALLBACK_ID } from "../shortcuts/new-feedback";
import candidateFormCallback from "./candidate-form";
import expenseClaimFormCallback from "./expense-claim-form";
import feedbackFormCallback from "./feedback-form";
import sampleViewCallback from "./sample-view";

const register = (app: App) => {
  app.view("sample_view_id", sampleViewCallback);
  app.view(FEEDBACK_FORM_CALLBACK_ID, feedbackFormCallback);
  app.view(EXPENSE_CLAIM_FORM_CALLBACK_ID, expenseClaimFormCallback);
  app.view(CANDIDATE_FORM_CALLBACK_ID, candidateFormCallback);
};

export default { register };
