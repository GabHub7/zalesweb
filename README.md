# Zales — AI Workflow Automation Platform

A minimal, monochrome, node-based workflow automation canvas. Drag nodes onto
an infinite canvas, wire them together, configure custom/open-source AI
models per node, and run the whole graph client-side in the browser.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 (strict monochrome palette — no accent colors)
- @xyflow/react (React Flow) for the node canvas
- Zustand for state management
- lucide-react for icons

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How it works

- **Sidebar (left):** collapsible node categories — Trigger, AI Models,
  Memory, Integrations, Data Transformation, Logic. Drag any node onto the
  canvas, or right-click the canvas to search and add a node at that spot.
- **Canvas (center):** infinite dotted-grid canvas. Connect nodes by dragging
  from the right handle of one node to the left handle of another.
- **Inspector (right):** click a node to configure it. AI nodes expose
  Base URL (e.g. `http://localhost:11434/v1` for Ollama), Model Name,
  System Prompt, Temperature/Top P sliders, and Max Tokens. Use "Test node"
  to run just that node in isolation.
- **Run:** the top-right Run button executes the whole graph starting from
  any Trigger node(s), passing each node's JSON output to the next connected
  node(s). Open "Run log" to see per-node inputs/outputs/errors and timing.

## Extending node types

All node types live in `src/lib/node-registry.ts` (schema/definition) and
`src/lib/execution-engine.ts` (runtime behavior). To add a new node:

1. Add a `NodeKind` entry in `src/types/zales.ts`.
2. Add its definition (category, icon, params) to `NODE_REGISTRY`.
3. Add a `case` for it in `runNode()` inside `execution-engine.ts`.

The Inspector form and sidebar entry are generated automatically from the
registry — no UI code needed for new nodes.

## WhatsApp — via third-party gateway (RapidAPI, Whapi.cloud, etc)

Zales doesn't run its own WhatsApp socket (no Baileys) — that only works on
a server that stays running 24/7, which rules out Vercel. Instead:

- **Sending**: use the built-in **HTTP Request** node pointed at your
  gateway provider's "send message" endpoint, with your API key/host in
  the node's **Headers** field.
- **Receiving**: point that provider's webhook setting at
  `/api/webhooks/gateway`, then use the **"WhatsApp Gateway (3rd-party)"**
  trigger node in your workflow — it has two fields (sender field path,
  message field path) so it adapts to whichever field names your specific
  provider's webhook payload uses.

See `DEPLOY.md` for the full walkthrough.



- AI Agent / Chat nodes call an OpenAI-compatible `/chat/completions`
  endpoint, so they work directly with Ollama, LM Studio, vLLM, or any
  OpenAI-compatible cloud provider (Together AI, Groq, etc).
- Code/Transform/Logic nodes run arbitrary JS via `new Function` in the
  browser — fine for local/trusted use, but sandbox this properly (e.g. a
  Worker or server-side VM) before exposing Zales to untrusted users.
- Workflows currently live only in browser memory (not yet persisted to
  SQLite as described in the spec) — wire up a `/api/workflows` route with
  SQLite if you need save/load across sessions.
