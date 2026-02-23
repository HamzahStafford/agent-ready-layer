#!/usr/bin/env node
/**
 * Agent: OpenRouter (LLM) + MCP web-scraper (tools).
 * API key from .env (OPENROUTER_API_KEY) or env. Usage: node src/agent.js "user message"
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createInterface } from 'node:readline';
const MCP_SERVER_PATH = join(__dirname, 'mcp-server.js');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-3.1-pro-preview';

/**
 * Spawn and connect to the web-scraper MCP server.
 */
async function connectMcp() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [MCP_SERVER_PATH],
    cwd: join(__dirname, '..'),
  });
  const client = new Client(
    { name: 'parse_web_agent', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );
  await client.connect(transport);
  return client;
}

/**
 * Convert MCP tool list to OpenRouter/OpenAI tools format.
 */
function mcpToolsToOpenAI(mcpTools) {
  return mcpTools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description || `Tool: ${t.name}`,
      parameters: t.inputSchema || { type: 'object', properties: {} },
    },
  }));
}

/**
 * Call OpenRouter chat completions (no stream) with optional tools.
 */
async function openRouterChat(apiKey, { model, messages, tools }) {
  const body = {
    model: model || DEFAULT_MODEL,
    messages,
    ...(tools && tools.length > 0 && { tools, tool_choice: 'auto' }),
  };
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/parse_web_agent',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Run one agent turn: send messages to OpenRouter; if tool_calls, execute via MCP and loop.
 */
async function runAgentTurn(apiKey, mcpClient, toolsOpenAI, messages, model) {
  const maxTurns = 15;
  let turn = 0;
  let currentMessages = [...messages];

  while (turn < maxTurns) {
    const response = await openRouterChat(apiKey, {
      model,
      messages: currentMessages,
      tools: toolsOpenAI,
    });

    const choice = response.choices?.[0];
    if (!choice?.message) {
      throw new Error('No message in OpenRouter response');
    }

    const msg = choice.message;
    currentMessages.push({
      role: 'assistant',
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
    });

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const text = (msg.content && String(msg.content).trim()) || '';
      if (text) return text;
      return "I didn't get a final reply. Try asking again or give me a specific store URL (e.g. a trekking shop) so I can fetch its contract and suggest actions.";
    }

    for (const tc of msg.tool_calls) {
      const name = tc.function?.name;
      const argsStr = tc.function?.arguments || '{}';
      let args;
      try {
        args = typeof argsStr === 'string' ? JSON.parse(argsStr) : argsStr;
      } catch {
        args = {};
      }
      const result = await mcpClient.callTool({ name, arguments: args });
      const text = result.content?.[0]?.text ?? (result.isError ? String(result.content?.[0]?.text || 'Error') : JSON.stringify(result));
      currentMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: text,
      });
    }
    turn++;
  }

  return '(Max turns reached)';
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('Set OPENROUTER_API_KEY');
    process.exit(1);
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const userInput = process.argv.slice(2).join(' ').trim();

  console.error('Connecting to MCP web-scraper...');
  const mcpClient = await connectMcp();
  const { tools } = await mcpClient.listTools();
  const toolsOpenAI = mcpToolsToOpenAI(tools);
  console.error(`Loaded ${tools.length} MCP tools: ${tools.map((t) => t.name).join(', ')}`);

  const systemPrompt = `You are an assistant that can both discover web pages (contract) and act in a real browser like a human.

Discovery (no browser):
- web_scraper_fetch_contract: get API contract (actions, forms, links) for a URL. Use discover_apis: true to also get apiEndpoints.
- web_scraper_contract_from_html, web_scraper_fetch_html: when you already have HTML or need raw HTML.

Execute in a real browser (human-like):
- browser_launch: open a browser (use headed: true so the user can watch). Do this first.
- browser_navigate: go to a URL.
- browser_snapshot: get current page state (buttons, links, forms). Use this to decide what to click or fill.
- browser_click: click by visible text (e.g. "Search", "Add to cart") or selector.
- browser_fill: fill one field by label/name (e.g. "search", "Size").
- browser_fill_form: fill multiple fields via JSON (e.g. '{"search":"trekking shoes","size":"40"}').
- browser_close: close the browser when done.

Recommended flow for shopping/product tasks (e.g. "trekking shoes, $100, black, size 40"):
1. browser_launch(headed: true) so the user sees the browser.
2. browser_navigate to a relevant shop URL (e.g. Nike, Decathlon, or a trekking store).
3. browser_snapshot to see current buttons/links/forms.
4. Use browser_fill or browser_fill_form to enter search/filters (e.g. search="trekking shoes", size=40), then browser_click("Search") or the submit button text.
5. browser_snapshot again to see results; optionally click a product or summarize what you see.
6. Always end with a clear text reply to the user. Then browser_close when the flow is done.

You can also use web_scraper_fetch_contract to get the contract first (to know what actions exist), then use the browser_* tools to perform those actions in the real page. Never end with only tool calls and no message.`;

  if (userInput) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput },
    ];
    const out = await runAgentTurn(apiKey, mcpClient, toolsOpenAI, messages, model);
    console.log(out);
    await mcpClient.close();
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const messages = [{ role: 'system', content: systemPrompt }];

  const ask = () => rl.question('You: ', async (line) => {
    const text = line?.trim();
    if (!text) {
      ask();
      return;
    }
    if (text === 'exit' || text === 'quit') {
      await mcpClient.close();
      rl.close();
      process.exit(0);
    }
    messages.push({ role: 'user', content: text });
    try {
      const out = await runAgentTurn(apiKey, mcpClient, toolsOpenAI, messages, model);
      console.log('Agent:', out);
      messages.push({ role: 'assistant', content: out });
    } catch (e) {
      console.error('Error:', e.message);
    }
    ask();
  });

  console.error('Interactive mode. Say "exit" or "quit" to leave.\n');
  ask();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
