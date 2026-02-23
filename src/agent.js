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
      return msg.content || '(No text output)';
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

  const systemPrompt = `You are an assistant with access to web scraping tools (MCP web-scraper). When the user asks to fetch a page, get a contract from a URL, or analyze HTML, use the appropriate tool:
- web_scraper_fetch_contract: fetch a URL and get the API contract (actions, forms, links). Use when you need to discover what a page offers.
- web_scraper_contract_from_html: generate contract from raw HTML string.
- web_scraper_fetch_html: fetch raw HTML from a URL.
Use these tools when needed, then summarize or act on the results for the user.`;

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
