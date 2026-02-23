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

const server = new McpServer({
  name: 'web-scraper',
  version: '1.0.0',
});

server.registerTool('web_scraper_fetch_contract', {
  description: 'Fetch a URL (with Chromium or HTTP), parse DOM, and return the API contract JSON. Use this to discover actions/forms/links on a page.',
  inputSchema: {
    url: z.string().describe('Full URL of the page to scrape'),
    context: z.string().optional().describe('Optional context hint for contract name (e.g. productPage, contactForm)'),
    use_chromium: z.boolean().optional().describe('Use Chromium to render JS (default true). Set false for HTTP-only fetch.'),
  },
}, async ({ url, context, use_chromium }) => {
  const useChromium = use_chromium !== false;
  const { contract } = await urlToContract(url, { context, useChromium });
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
