# Kapibala Team(kTeam) — Project Overview & Architecture

## Overview

An intelligent Slack Agent built on the Slack Assistant API, integrating AI conversations, Notion business workflows, and Human-in-the-Loop approval mechanisms.

Stack: TypeScript + Bolt for JavaScript + Nitro Server + AI SDK v6 + Workflow DevKit, deployed on Vercel.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Nitro | Server framework, file-based routing, Vercel deployment |
| Slack Framework | Bolt for JS + VercelReceiver | Event handling, interactive components, Assistant API |
| AI | AI SDK v6 + Workflow DevKit DurableAgent | Tool calling, streaming responses, durable execution |
| External Integration | Notion API | Feedback, expense claims, recruitment databases |
| Model | OpenAI gpt-5.2-chat (via Vercel AI Gateway) | Conversation generation |

## Project Structure

```
server/                           # Nitro srcDir
├── app.ts                        # Bolt App + VercelReceiver initialization
├── api/slack/events.post.ts      # Single HTTP endpoint (file-based routing)
├── listeners/                    # Slack event listeners (grouped by type)
│   ├── index.ts                  # Registers all listener groups
│   ├── assistant/                # Assistant API (thread started, user message, context changed)
│   ├── actions/                  # Interactive components (button approvals: channel join, expense)
│   ├── events/                   # App events (app_mention, app_home_opened)
│   ├── shortcuts/                # Global shortcuts (feedback, expense, candidate)
│   ├── views/                    # Modal form submissions (feedback, expense, candidate)
│   ├── commands/                 # Slash commands
│   └── messages/                 # Message handlers
├── lib/
│   ├── ai/
│   │   ├── agent.ts              # DurableAgent factory (system prompt + tool bindings)
│   │   ├── tools.ts              # AI tool definitions (channel messages, threads, join, search)
│   │   ├── context.ts            # SlackAgentContextInput type
│   │   └── workflows/
│   │       ├── chat.ts           # Main chat workflow ("use workflow")
│   │       └── hooks.ts          # HITL hook definitions (channel join approval)
│   ├── slack/
│   │   ├── blocks.ts             # Block Kit UI builders
│   │   ├── client.ts             # WebClient helpers
│   │   ├── utils.ts              # Message formatting, context extraction
│   │   └── files.ts              # File handling
│   └── notion/
│       ├── client.ts             # Notion Client initialization
│       ├── feedback.ts           # Feedback database CRUD
│       ├── expense-claim.ts      # Expense claim database CRUD + approval status updates
│       ├── recruitment.ts        # Recruitment candidate database CRUD
│       ├── file-upload.ts        # Notion file uploads
│       └── user-map.ts           # Slack → Notion user mapping (in-memory cache)
manifest.json                     # Slack App Manifest
nitro.config.ts                   # Nitro config (srcDir, @workflow/nitro module)
biome.json                        # Linter + Formatter
```

## Core Architecture

### Request Flow

```
Slack Event → POST /api/slack/events → VercelReceiver → Bolt App → Listener
```

All Slack interactions (events, commands, shortcuts, buttons, modals) go through the single `/api/slack/events` endpoint, routed by Bolt to the corresponding listener.

### AI Chat Flow

```
User Message → assistantUserMessage listener
                   ↓
              start(chatWorkflow)    ← "use workflow" durable execution
                   ↓
              createSlackAgent()     ← DurableAgent + system prompt + tools
                   ↓
              agent.stream()         ← Tool calling loop (each tool uses "use step")
                   ↓
              chatStream() → Slack   ← Streaming response
```

Agent Tools:
- `getChannelMessages` — Fetch channel messages
- `getThreadMessages` — Fetch thread messages
- `joinChannel` — Join a channel (requires user approval)
- `searchChannels` — Search channels by name/topic

### Human-in-the-Loop (HITL)

Sensitive operations (e.g., joining channels, expense approvals) use Workflow DevKit's `defineHook` for a suspend-resume pattern:

```
Tool triggered → Send approval buttons → hook.create() → Workflow suspends
                                                              ↓
User clicks button → Action Handler → hook.resume() → Workflow resumes
```

Current HITL scenarios:
- Channel join approval (`channelJoinApprovalHook`)
- Expense claim approval (`expenseClaimApprovalCallback`)

### Notion Business Integration

Global shortcuts trigger modal forms in Slack; submissions are written to Notion databases:

| Shortcut | Modal | Notion Database | Functionality |
|----------|-------|-----------------|---------------|
| `new_feedback` | Feedback form | Feedback DB | Create feedback records (type, priority, tags, attachments) |
| `expense_claim` | Expense form | Expense Claim DB | Create expense claims (amount, type, invoice attachments) + approval flow |
| `new_candidate` | Candidate form | Recruitment DB | Create candidates (position, resume, interview time) |

Shared capabilities:
- Notion file uploads (`file-upload.ts`)
- Slack → Notion user mapping (`user-map.ts`, in-memory cache)

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SLACK_BOT_TOKEN` | ✅ | Bot OAuth Token |
| `SLACK_SIGNING_SECRET` | ✅ | Request signature verification |
| `AI_GATEWAY_API_KEY` | ✅ | Vercel AI Gateway |
| `NOTION_KEY` | ✅ | Notion API Token |
| `NOTION_FEEDBACK_DATABASE_ID` | ✅ | Feedback database ID |
| `NOTION_EXPENSE_CLAIM_DATABASE_ID` | ✅ | Expense claim database ID |
| `NOTION_RECRUITMENT_DATABASE_ID` | ✅ | Recruitment database ID |
| `NGROK_AUTH_TOKEN` | — | Local dev tunnel |

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start local dev server
pnpm dev:tunnel       # Dev server + ngrok tunnel
pnpm build            # Production build
pnpm lint             # Biome check
pnpm typecheck        # TypeScript type check
```
