import type { ModelMessage, UIMessageChunk } from "ai";
import { getWritable } from "workflow";
import { routeAndCreateAgent } from "~/lib/ai/agent";
import type { SlackAgentContextInput } from "~/lib/ai/context";
import { initializeSkills } from "~/lib/skills/bootstrap";

function extractLastUserMessage(messages: ModelMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      const content = messages[i].content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        const textPart = content.find(
          (p) => "type" in p && p.type === "text" && "text" in p,
        );
        if (textPart && "text" in textPart) return textPart.text as string;
      }
    }
  }
  return "";
}

export async function chatWorkflow(
  messages: ModelMessage[],
  context: SlackAgentContextInput,
) {
  "use workflow";

  await initializeSkills();

  const writable = getWritable<UIMessageChunk>();
  const lastMessage = extractLastUserMessage(messages);
  const { agent } = routeAndCreateAgent(lastMessage, context);

  await agent.stream({
    messages,
    writable,
    experimental_context: context,
  });
}
