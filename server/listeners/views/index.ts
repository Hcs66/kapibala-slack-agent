import type { App } from "@slack/bolt";
import { FEEDBACK_FORM_CALLBACK_ID } from "../shortcuts/new-feedback";
import feedbackFormCallback from "./feedback-form";
import sampleViewCallback from "./sample-view";

const register = (app: App) => {
  app.view("sample_view_id", sampleViewCallback);
  app.view(FEEDBACK_FORM_CALLBACK_ID, feedbackFormCallback);
};

export default { register };
