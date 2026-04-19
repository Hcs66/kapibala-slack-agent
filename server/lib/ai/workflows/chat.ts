import type { ModelMessage, UIMessageChunk } from "ai";
import { fetch, getWritable } from "workflow";
import { routeAndCreateAgent } from "~/lib/ai/agent";
import type { SlackAgentContextInput } from "~/lib/ai/context";
import { initializeSkills } from "~/lib/skills/bootstrap";

function extractUserMessageText(message: ModelMessage): string | null {
  if (message.role !== "user") return null;
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textPart = content.find(
      (p) => "type" in p && p.type === "text" && "text" in p,
    );
    if (textPart && "text" in textPart) return textPart.text as string;
  }
  return null;
}

function extractAllUserMessages(messages: ModelMessage[]): string[] {
  const result: string[] = [];
  for (const msg of messages) {
    const text = extractUserMessageText(msg);
    if (text) result.push(text);
  }
  return result;
}

export async function chatWorkflow(
  messages: ModelMessage[],
  context: SlackAgentContextInput,
) {
  "use workflow";

  globalThis.fetch = fetch;

  await initializeSkills();

  const writable = getWritable<UIMessageChunk>();
  const allUserMessages = extractAllUserMessages(messages);
  const lastMessage = allUserMessages[allUserMessages.length - 1] ?? "";
  const { agent } = await routeAndCreateAgent(
    lastMessage,
    context,
    allUserMessages,
  );

  await agent.stream({
    messages,
    writable,
    experimental_context: context,
  });
}
