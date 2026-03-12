import type { App } from "@slack/bolt";
import newFeedbackCallback from "./new-feedback";
import sampleShortcutCallback from "./sample-shortcut";

const register = (app: App) => {
  app.shortcut("sample_shortcut_id", sampleShortcutCallback);
  app.shortcut("new_feedback", newFeedbackCallback);
};

export default { register };
