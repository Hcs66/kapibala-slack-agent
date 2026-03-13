import type { App } from "@slack/bolt";
import expenseClaimCallback from "./expense-claim";
import newCandidateCallback from "./new-candidate";
import newFeedbackCallback from "./new-feedback";

const register = (app: App) => {
  app.shortcut("new_feedback", newFeedbackCallback);
  app.shortcut("expense_claim", expenseClaimCallback);
  app.shortcut("new_candidate", newCandidateCallback);
};

export default { register };
