#!/usr/bin/env node
/**
 * MCP Web Scraper Server
 * Exposes web scraping / contract generation as MCP tools for agents.
 * Run: node src/mcp-server.js (stdio transport)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { urlToContract } from './index.js';
import { generateContract } from './contractGenerator.js';
import * as browserSession from './browserSession.js';

const server = new McpServer({
  name: 'web-scraper',
  version: '1.0.0',
});

server.registerTool('web_scraper_fetch_contract', {
  description: 'Fetch a URL (with Chromium or HTTP), parse DOM, and return the API contract (actions, forms, links). Set discover_apis true to also capture XHR/fetch and add apiEndpoints so the agent can call the site APIs directly.',
  inputSchema: {
    url: z.string().describe('Full URL of the page to scrape'),
    context: z.string().optional().describe('Optional context hint for contract name (e.g. productPage, contactForm)'),
    use_chromium: z.boolean().optional().describe('Use Chromium to render JS (default true). Set false for HTTP-only fetch.'),
    discover_apis: z.boolean().optional().describe('Capture XHR/fetch during page load and add apiEndpoints to contract (default false). Requires Chromium.'),
  },
}, async ({ url, context, use_chromium, discover_apis }) => {
  const useChromium = use_chromium !== false;
  const { contract } = await urlToContract(url, { context, useChromium, discoverApis: !!discover_apis });
  return {
    content: [{ type: 'text', text: JSON.stringify(contract, null, 2) }],
  };
});

server.registerTool('web_scraper_contract_from_html', {
  description: 'Generate API contract from raw HTML string (no fetch). Use when you already have the page HTML.',
  inputSchema: {
    html: z.string().describe('Raw HTML content of the page'),
    context: z.string().optional().describe('Optional context hint for contract name'),
  },
}, async ({ html, context }) => {
  const contract = generateContract(html, { context });
  return {
    content: [{ type: 'text', text: JSON.stringify(contract, null, 2) }],
  };
});

server.registerTool('web_scraper_fetch_html', {
  description: 'Fetch full HTML from a URL (Chromium or HTTP). Returns raw HTML string.',
  inputSchema: {
    url: z.string().describe('Full URL to fetch'),
    use_chromium: z.boolean().optional().describe('Use Chromium to render JS (default true)'),
  },
}, async ({ url, use_chromium }) => {
  const { fetchHtmlWithChromium } = await import('./fetcher.js');
  const useChromium = use_chromium !== false;
  const html = await fetchHtmlWithChromium(url, { useChromium });
  return {
    content: [{ type: 'text', text: html }],
  };
});

server.registerTool('web_scraper_call_api', {
  description: 'Call a real HTTP API (e.g. an endpoint from contract.apiEndpoints). Use this to execute actions like the site does (POST/GET to the same URLs the page uses). Pass optional headers_json (JSON string) if the site requires auth.',
  inputSchema: {
    method: z.string().describe('HTTP method: GET, POST, PUT, PATCH, or DELETE'),
    url: z.string().describe('Full URL to call (e.g. from contract.apiEndpoints[].url)'),
    body: z.string().optional().describe('JSON string or raw body for POST/PUT/PATCH'),
    headers_json: z.string().optional().describe('Optional headers as JSON string, e.g. \'{"Content-Type":"application/json","Cookie":"..."}\''),
  },
}, async ({ method, url, body, headers_json }) => {
  let headers = { 'User-Agent': 'Mozilla/5.0 (compatible; AgentContractGenerator/1.0)' };
  if (headers_json) {
    try {
      const parsed = JSON.parse(headers_json);
      if (typeof parsed === 'object' && parsed !== null) headers = { ...headers, ...parsed };
    } catch (_) {}
  }
  const opts = { method: method.toUpperCase(), headers };
  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    opts.body = body;
    if (!opts.headers['Content-Type'] && body.trim().startsWith('{'))
      opts.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = { _raw: text, _status: res.status };
  }
  return {
    content: [{ type: 'text', text: JSON.stringify({ status: res.status, ok: res.ok, data: result }) }],
  };
});

// --- Browser agent: act like a human in a real browser ---

server.registerTool('browser_launch', {
  description: 'Open a real browser (Playwright). Use headed: true to show the window so the user can watch. Call this before other browser_* tools.',
  inputSchema: {
    headed: z.boolean().optional().describe('If true, browser window is visible (default false = headless)'),
  },
}, async ({ headed }) => {
  const out = await browserSession.launch({ headed: !!headed });
  return { content: [{ type: 'text', text: JSON.stringify(out) }] };
});

server.registerTool('browser_navigate', {
  description: 'Navigate the browser to a URL. Requires browser_launch first.',
  inputSchema: {
    url: z.string().describe('Full URL to open (e.g. https://example.com/shop)'),
  },
}, async ({ url }) => {
  const out = await browserSession.navigate(url);
  return { content: [{ type: 'text', text: JSON.stringify(out) }] };
});

server.registerTool('browser_click', {
  description: 'Click an element in the page by its visible text or description (e.g. "Add to cart", "Search"). Can also pass a CSS selector. Requires browser open.',
  inputSchema: {
    description_or_selector: z.string().describe('Button/link text to click (e.g. "Search", "Add to cart") or a CSS selector'),
  },
}, async ({ description_or_selector }) => {
  const out = await browserSession.click(description_or_selector);
  return { content: [{ type: 'text', text: JSON.stringify(out) }] };
});

server.registerTool('browser_fill', {
  description: 'Fill one form field (input/select/textarea) by its label, name, or placeholder. Requires browser open.',
  inputSchema: {
    field: z.string().describe('Field label, name, or placeholder (e.g. "search", "Search products")'),
    value: z.string().describe('Value to type'),
  },
}, async ({ field, value }) => {
  const out = await browserSession.fill(field, value);
  return { content: [{ type: 'text', text: JSON.stringify(out) }] };
});

server.registerTool('browser_fill_form', {
  description: 'Fill multiple form fields at once. Pass a JSON string of field names to values, e.g. \'{"search":"trekking shoes","size":"40"}\'. Requires browser open.',
  inputSchema: {
    fields_json: z.string().describe('JSON object of field name/label to value, e.g. \'{"search":"shoes","max_price":"100"}\''),
  },
}, async ({ fields_json }) => {
  let fields = {};
  try {
    fields = JSON.parse(fields_json);
    if (typeof fields !== 'object' || fields === null) fields = {};
  } catch (_) {}
  const out = await browserSession.fillForm(fields);
  return { content: [{ type: 'text', text: JSON.stringify(out) }] };
});

server.registerTool('browser_snapshot', {
  description: 'Get current page state: URL, title, list of buttons, links, and forms (with field names). Use this to decide next click or fill. Requires browser open.',
  inputSchema: {},
}, async () => {
  const out = await browserSession.getSnapshot();
  return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
});

server.registerTool('browser_close', {
  description: 'Close the browser. Call when done with the session.',
  inputSchema: {},
}, async () => {
  const out = await browserSession.close();
  return { content: [{ type: 'text', text: JSON.stringify(out) }] };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
