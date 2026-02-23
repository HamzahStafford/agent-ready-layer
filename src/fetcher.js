/**
 * Fetch full HTML from URL using Chromium (Playwright).
 * Renders JS so we get complete DOM.
 * Fallback: plain fetch() when useChromium=false or Chromium fails.
 */

import { chromium } from 'playwright';

/**
 * @param {string} url - Full URL to fetch
 * @param {{ waitUntil?: 'load'|'domcontentloaded'|'networkidle', timeout?: number, useChromium?: boolean }} options
 * @returns {Promise<string>} Full HTML string
 */
export async function fetchHtmlWithChromium(url, options = {}) {
  const { waitUntil = 'domcontentloaded', timeout = 30000, useChromium = true } = options;

  if (useChromium) {
    try {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil, timeout });
        await new Promise((r) => setTimeout(r, 1500));
        const html = await page.content();
        return html;
      } finally {
        await browser.close();
      }
    } catch (e) {
      console.error('Chromium fetch failed, falling back to HTTP GET:', e.message);
    }
  }

  // Fallback: plain HTTP GET (no JS execution)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgentContractGenerator/1.0)' },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}
