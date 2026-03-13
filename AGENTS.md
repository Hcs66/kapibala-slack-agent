# AGENTS.md

## Project Overview

Slack agent built with Bolt for JavaScript (TypeScript), Nitro server framework, AI SDK v6, and Workflow DevKit for durable execution. Deployed on Vercel.

## Build / Lint / Test Commands

Package manager: **pnpm** (v10.14.0). Do not use npm or yarn.

```bash
pnpm install              # Install dependencies
pnpm dev                  # Start local Nitro dev server
pnpm dev:tunnel           # Dev server with ngrok tunnel
pnpm build                # Production build (nitro build)
pnpm preview              # Preview production build
pnpm prepare              # Generate Nitro types

# Quality
pnpm lint                 # Lint with Biome (biome check .)
pnpm lint:fix             # Auto-fix lint issues (biome check . --write)
pnpm typecheck            # TypeScript check (tsc --noEmit)

# Testing (vitest — not yet configured in package.json)
pnpm test                 # Run all tests
pnpm test -- server/lib/ai/tools.test.ts          # Run a single test file
pnpm test -- -t "should handle normal input"       # Run a single test by name
```

Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before completing any task. All three must pass.

## Project Structure

```
server/                         # Nitro srcDir
├── api/slack/events.post.ts    # Single HTTP endpoint (file-based routing)
├── app.ts                      # Bolt App + VercelReceiver setup
├── routes/                     # Additional Nitro routes
├── listeners/                  # Slack event handlers, grouped by type
│   ├── index.ts                # Registers all listener groups
│   ├── assistant/              # Slack Assistant API (thread started, user message, context changed)
│   ├── actions/                # Interactive components (buttons, menus, HITL approval)
│   ├── events/                 # App events (app_mention, app_home_opened)
│   ├── commands/               # Slash commands
│   ├── messages/               # Message handlers
│   ├── shortcuts/              # Global/message shortcuts
│   └── views/                  # Modal submissions
├── lib/
│   ├── ai/
│   │   ├── agent.ts            # DurableAgent factory with system prompt + tools
│   │   ├── tools.ts            # AI SDK tool definitions (getChannelMessages, joinChannel, etc.)
│   │   ├── context.ts          # SlackAgentContextInput type
│   │   └── workflows/
│   │       ├── chat.ts         # Main chat workflow ("use workflow" directive)
│   │       └── hooks.ts        # HITL hooks (defineHook from workflow)
│   └── slack/
│       ├── blocks.ts           # Block Kit UI builders
│       ├── client.ts           # WebClient helpers
│       └── utils.ts            # Message formatting, thread/channel context helpers
nitro.config.ts                 # Nitro config (srcDir: "server", @workflow/nitro module)
biome.json                      # Linter + formatter config
tsconfig.json                   # Extends .nitro/types/tsconfig.json
```

## Code Style

### Formatting (Biome)

- 2-space indentation, 80 char line width, LF line endings
- Double quotes for strings
- Biome organizes imports automatically (`organizeImports: "on"`)
- Biome scope: `server/**/*.{ts,js}`, `manifest.json`, `nitro.config.ts`, `tsconfig.json`, `biome.json`
- `noConsole` is disabled only in `scripts/**`

### TypeScript

- Strict mode via Nitro's generated tsconfig
- Use `type` keyword for type-only imports: `import type { Foo } from "bar"`
- Path alias `~/` maps to `server/` (Nitro convention) — use it for all internal imports
- Never suppress type errors with `as any`, `@ts-ignore`, or `@ts-expect-error`
- Workflow DevKit plugin enabled in tsconfig

### Naming Conventions

- Files: `kebab-case.ts` (e.g., `channel-join-approval.ts`, `app-home-opened.ts`)
- Exports: `camelCase` for functions/variables, `PascalCase` for types/interfaces
- Constants: `UPPER_SNAKE_CASE` for action IDs and string constants (e.g., `CHANNEL_JOIN_APPROVAL_ACTION`)
- Listener callbacks: descriptive camelCase matching the event (e.g., `assistantUserMessage`, `channelJoinApprovalCallback`)

### Imports

- External packages first, then internal `~/` imports, separated by blank line
- Use `import type` for type-only imports
- Dynamic imports inside `"use step"` functions to avoid bundling Node.js modules in workflow context

```typescript
import { tool } from "ai";
import { z } from "zod";
import type { SlackAgentContextInput } from "~/lib/ai/context";
import { channelJoinApprovalHook } from "~/lib/ai/workflows/hooks";
```

### Error Handling

- Return structured `{ success: boolean; message: string; error?: string }` objects from tools
- Use `error instanceof Error ? error.message : "Unknown error"` pattern
- Wrap Slack API calls in try/catch with `console.error` for failures
- Use `console.warn` for non-critical failures (e.g., failed emoji reactions)
- Never use empty catch blocks

### Tool Definitions

Tools use AI SDK's `tool()` with Zod schemas. Key patterns:

```typescript
const myTool = tool({
  description: "Clear description for the LLM",
  inputSchema: z.object({
    param: z.string().describe("Description for the LLM"),
  }),
  execute: async ({ param }, { experimental_context }) => {
    "use step"; // Required for Workflow durable execution
    // Dynamic imports inside step
    const { WebClient } = await import("@slack/web-api");
    const ctx = experimental_context as SlackAgentContextInput;
    const client = new WebClient(ctx.token);
    // ... implementation
  },
});
```

- Add `"use step"` directive for durable execution in tool execute functions
- Use dynamic imports inside steps to avoid bundling issues
- Access context via `experimental_context` cast to `SlackAgentContextInput`
- Export tools as a single object (e.g., `export const slackTools = { ... }`)

### Workflow Patterns

- `"use workflow"` directive marks durable workflow functions
- `"use step"` directive marks individual durable steps within workflows
- Hooks (`defineHook`) enable human-in-the-loop: workflow pauses at `await hook`, resumes when `hook.resume()` is called
- Hook creation must happen in workflow context (not inside steps)

### Listener Registration

Each listener group exports a `register(app: App)` function. The main `listeners/index.ts` calls all of them:

```typescript
const registerListeners = (app: App) => {
  actions.register(app);
  assistant.register(app);
  // ...
};
```

### Slack-Specific

- Use Slack mrkdwn (not standard markdown): `*bold*`, `_italic_`, `<@USER_ID>`, `<#CHANNEL_ID>`
- Slack code blocks don't support language tags
- Always `await ack()` immediately in action/command handlers
- For long operations after ack, use fire-and-forget pattern to avoid `operation_timeout`
- Buffer request body manually in the events endpoint to avoid H3 stream consumption issues

## Testing

- Framework: Vitest (co-located `*.test.ts` files or `server/__tests__/`)
- Mock `@slack/web-api` WebClient in tests
- Unit tests required for all exported functions
- E2E tests (`*.e2e.test.ts`) for user-facing changes (handlers, commands, interactive components)

## Git Conventions

Conventional commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`

Never commit `.env` files, API keys, tokens, or `node_modules/`.

## Environment Variables

- `SLACK_BOT_TOKEN` (required) — Bot OAuth token
- `SLACK_SIGNING_SECRET` (required) — Request signing secret
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway key
- `NGROK_AUTH_TOKEN` — For local dev tunnel
