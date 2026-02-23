# Agent-Ready Layer — Semantic Interface for Web

![Agent-Ready Demo](https://github.com/HamzahStafford/agent-ready-layer/raw/main/demo/demo-first-phase.gif)

**Tagline:** *"Computer-use is powerful but inefficient. A semantic acceleration layer reduces cost, latency, and hallucinated clicks."*

Actionable API layer for AI agents: parse HTML/DOM → semantic analysis → **action contract** (named actions + schemas). Agents call actions by name and parameters instead of screenshot–reason–click loops.

---

## What it does

- **Input:** URL or raw HTML
- **Output:** Structured **action contract** (e.g. `search_product(query)`, `add_to_cart(product_id)`, `checkout()`)
- **Purpose:** Deterministic, low-token web interaction for agents (e.g. auto shopping, form fill)

See [spec.md](./spec.md) for vision, architecture, and roadmap.

---

## Setup

```bash
npm install
```

### Environment

Create a `.env` file (see `mcp-config.example.json` for MCP config pattern):

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=google/gemini-3.1-pro-preview
```

---

## Scripts

| Command | Description |
|--------|-------------|
| `npm run fetch` | Fetch page (URL → HTML) |
| `npm run contract` | Generate action contract from HTML/URL |
| `npm start` | Run CLI (default entry) |
| `npm run mcp` | Start MCP server (contract tools) |
| `npm run agent` | Run agent (OpenRouter + MCP) |

---

## Project layout

```
src/
  cli.js        # CLI: fetch, contract
  mcp-server.js # MCP tools for contract fetch/generation
  agent.js      # Agent loop (OpenRouter + contract-driven actions)
```

---

## License

See repo or project terms.
