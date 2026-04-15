import { registerSkill } from "./registry";

let initialized = false;

export async function initializeSkills(): Promise<void> {
  if (initialized) return;

  const { feedbackSkill } = await import("~/lib/skills/feedback");
  const { expenseSkill } = await import("~/lib/skills/expense");
  const { recruitmentSkill } = await import("~/lib/skills/recruitment");
  const { taskSkill } = await import("~/lib/skills/task");
  const { meetingSkill } = await import("~/lib/skills/meeting");
  const { budgetSkill } = await import("~/lib/skills/budget");
  const { alertSkill } = await import("~/lib/skills/alert");

  registerSkill(feedbackSkill);
  registerSkill(expenseSkill);
  registerSkill(recruitmentSkill);
  registerSkill(taskSkill);
  registerSkill(meetingSkill);
  registerSkill(budgetSkill);
  registerSkill(alertSkill);

  initialized = true;
}

export function resetInitialization(): void {
  initialized = false;
}
