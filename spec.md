# Semantic Interface for Agent-Ready Web

**Tagline:** *"Computer-use is powerful but inefficient. A semantic acceleration layer reduces cost, latency, and hallucinated clicks."*

**Positioning:** **Semantic Interface for Agent-Ready Web** — an actionable API layer for AI agents that enables deterministic web interaction beyond structured data. It sits above the data layer (crawl, HTML → JSON) and focuses on **action abstraction** and **task execution**, not only data extraction.

---

## 1. Vision & context

Computer-use agents (browser automation, shopping bots, RPA with AI) today rely heavily on **vision**: screenshot → LLM reads pixels → guess element → click. That loop is expensive in tokens and time, brittle when layout changes, and prone to misclicks. The product addresses this by adding a **semantic pre-processing layer**: the page is parsed once into a structured **action contract** (named actions with schemas); the agent then calls actions by name and parameters instead of “look and click.” Vision can remain as fallback when needed.

This is an **infrastructure play** — clear ROI through cost and latency reduction — not a generic “convert website to API” or scraping tool.

---

## 2. How this product differs from Firecrawl (and similar tools)

Tools like **Firecrawl** solve **web → data**: they crawl, render JS, and turn HTML into **structured content** (JSON, Markdown) that LLMs or downstream systems can consume. That is **data extraction**. It does not define *how an agent should interact* with the page — which button is “Add to Cart,” which inputs are email/password, which control is “filter by price.”

This product focuses on **action abstraction** (semantic interaction layer):

- **Input:** Same kind of raw material (HTML/DOM, or optionally pre-fetched data).
- **Output:** Not only “content in JSON,” but **action schema** — e.g. `search_product(query)`, `filter_price(min, max)`, `add_to_cart(product_id)`, `checkout()` — that an agent can call to *execute tasks* (search, filter, add to cart, submit form).
- **Purpose:** Enable **deterministic, low-token interaction** instead of repeated screenshot–reason–click loops.

So: **Firecrawl (and similar) = data pipeline.** **This product = semantic interaction layer on top** — it can consume crawled/structured data and turn it into an **actionable API** for agents.


| Dimension                                     | Firecrawl / scraping APIs | This product (Semantic Interface) |
| ----------------------------------------------- | --------------------------- | ----------------------------------- |
| Crawl + render JS                             | Yes                       | Can integrate or assume upstream  |
| Output: structured data (JSON/Markdown)       | Yes                       | Yes (contract includes schema)    |
| **Semantic action schema**                    | No                        | **Yes — core**                   |
| **Agent task API (execute actions)**          | No                        | **Yes**                           |
| Token / latency optimization for computer-use | No                        | Yes                               |
| Handling SPA flows as action graphs           | No                        | Yes (direction)                   |

**One-line differentiation:**
*"Expose actionable API for AI agents — enabling deterministic web interaction beyond structured data."*

The product does not duplicate Firecrawl; it operates **above** the data layer in the agent stack. Possible evolution: take **data from Firecrawl (or any crawler)** → **infer or map to action templates** → expose **action schema + execution API** for agents.

---

## 3. Problem & solution

### 3.1 Problem

- Vision-heavy computer-use is **costly** (tokens, inference, screenshot loops).
- **Slow** (multi-step screenshot–reason–click cycles).
- **Fragile** (layout changes break selectors and visual cues).
- **Error-prone** (misclicks on banners, wrong elements, retries).

### 3.2 Solution

A **semantic pre-processing layer** that parses the page (or uses pre-fetched data), produces a **structured action contract** (actions + schemas), and lets the agent **call named actions with parameters** instead of “look and click.” Vision remains available for edge cases or low-confidence situations.

### 3.3 Value proposition

- **Lower cost:** Fewer tokens per task (no repeated full-page screenshots for every step).
- **Lower latency:** Fewer round-trips; direct action calls.
- **Fewer misclicks:** Intent is explicit (e.g. `add_to_cart(product_id)`) instead of pixel-based guessing.
- **More stable:** Semantic actions are more resilient to layout changes than raw selectors or visual anchors.

---

## 4. Expected impact (direction for validation)

The thesis is that a parse-based semantic layer improves agent web interaction (speed, cost, accuracy) compared to vision-only automation. Full A/B or formal benchmarks are a post-MVP step; the table below describes the **intended direction** of impact.


| Metric                 | Vision-only (typical)             | With semantic layer (target direction) |
| ------------------------ | ----------------------------------- | ---------------------------------------- |
| Latency                | 8–15 s per task                  | 2–4 s                                 |
| Token usage            | High (screenshots + long context) | Lower (schema + tool call)             |
| Misclicks              | Common                            | Near zero when action exists           |
| Break on layout change | Yes                               | Less (schema more stable)              |
| Determinism            | Low                               | High (action + params)                 |

MVP focus: **demonstrate one end-to-end flow** (e.g. auto shopping) using the semantic layer. Quantitative comparison with vision-only can be added once the pipeline is stable.

---

## 5. MVP use case: Auto shopping

- **Why shopping:** Covers search, filter, add to cart, checkout — enough complexity to be credible. Task is easy to state: *"Buy a laptop under $1000 on site X."*
- **With semantic layer:** The page yields **semantic actions** (e.g. `search_product`, `filter_price`, `add_to_cart`, `checkout`). The agent calls them by name and parameters instead of reading pixels.
- **Demo:** Run one task (e.g. “add laptop under $1000 to cart”) using the contract; show that the agent uses the action schema to complete the flow. No need for a full A/B in the first two days.

---

## 6. System architecture

### 6.1 High-level: hybrid computer use

```
User task (e.g. "Buy laptop under $1000 on site X")
        │
        ▼
Agent (LLM + tool loop)
  – Fetches contract for URL → gets action graph → calls actions
  – Falls back to vision when confidence is low or action missing
        │
        ├──────────────────┬─────────────────────┐
        ▼                  ▼                     ▼
Semantic layer         Vision fallback      Core pipeline
Parse DOM →            Screenshot →         Fetcher → DOM Parser
Contract /             LLM vision →           → Contract generator
Action graph           click                 (contractName, actions, schema)
```

### 6.2 Post-MVP directions


| Component                    | Description                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Action graph**             | Beyond a flat list of forms: navigation edges, nodes for search / filter / add_to_cart / checkout.                      |
| **Confidence score**         | Per-action reliability; vision fallback when confidence is low.                                                         |
| **Data → action templates** | Input: e.g. JSON from Firecrawl or other crawler. Output: action schema. Enables “on top of” existing data pipelines. |
| **Vertical templates**       | E-commerce, form-fill, job boards — reusable action patterns.                                                          |
| **Execution API**            | Agent-callable endpoints to execute actions (submit form, click) against the page.                                      |

### 6.3 Current implementation (MVP)

- **Pipeline:** Fetcher (Chromium/HTTP) → DOM Parser (Cheerio) → Contract generator → JSON contract.
- **MCP web-scraper:** Tools to fetch contract from URL, from HTML, or raw HTML.
- **Agent:** OpenRouter + MCP; receives task → fetches contract → reasons and acts over structured actions (execution via contract schema can extend from here).

---

## 7. Market & business model

### 7.1 Market

Computer-use is being adopted by Operator-style agents, Claude Computer Use, browser-automation startups, enterprise AI ops, and agent startups (shopping bots, RPA). Shared pain: high vision cost, token-heavy loops, retries, slow and non-deterministic behavior. Value prop: meaningful reduction in token and latency and in misclicks → cost reduction with clear ROI.

### 7.2 Target segments


| Segment                            | Need                                          |
| ------------------------------------ | ----------------------------------------------- |
| AI browser / computer-use startups | Lower cost and latency per session.           |
| Automation SaaS                    | More stable, less breakage when sites change. |
| Enterprise AI teams                | Scale computer-use with predictable cost.     |

### 7.3 Revenue model (options)


| Model             | Description                                            |
| ------------------- | -------------------------------------------------------- |
| SDK / license     | e.g. $199–$999/month for teams integrating the layer. |
| Usage-based       | e.g. $0.003 per processed page (parse + contract).     |
| Performance-based | Share of cost savings (advanced; enterprise).          |

---

## 8. Pricing

- **Unit:** One **processed page** = one DOM parse + contract generation (e.g. one URL).
- **Tiers:** Free (limited pages/month) → Starter → Pro → Enterprise.
- **Overage:** e.g. $0.002–0.003 per page.
- **Enterprise:** On-prem, SLA, custom terms.

Framing: **cost reduction for computer-use** and **actionable API for agents**, not “scraping API.”

---

## 9. Workload & roadmap


| Phase             | Scope                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **MVP (current)** | Parse → contract; MCP tools; agent (OpenRouter);**demo one auto-shopping flow** with semantic layer.  |
| **Short-term**    | Action graph; confidence score; vision fallback; optional**data → action** input (e.g. from crawler). |
| **Mid-term**      | Execution simulation; analytics (latency, token, misclick); vertical templates.                        |
| **Long-term**     | SDK for AI browser / automation; enterprise (on-prem, SLA); performance-based pricing.                 |

---

## 10. Success conditions

- One end-to-end task (e.g. shopping) completed using the semantic layer.
- Clear product differentiation from Firecrawl and data-only scraping APIs (action schema + agent task API).
- Longer-term: demonstrate significant improvement in latency, token, and misclicks when compared to vision-only.

---

## 11. Summary

- **Product name:** Semantic Interface for Agent-Ready Web.
- **Role in stack:** Above data pipelines (e.g. Firecrawl). Delivers **action abstraction** and **task execution API** for agents, not only structured data.
- **Positioning:** *"Expose actionable API for AI agents — enabling deterministic web interaction beyond structured data."*
- **MVP:** One credible flow (e.g. auto shopping) using the contract; differentiation from Firecrawl explained; no requirement for full A/B in the first two days.

This spec supports pitch, roadmap, and PRD with a clear product definition and Firecrawl differentiation in PO/PM terms.
