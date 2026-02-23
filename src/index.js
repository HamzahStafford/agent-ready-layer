/**
 * Agent Web Contract Generator
 * Pipeline: URL → Chromium HTML → DOM parse → semantic analysis → API contract JSON
 * Optional: capture XHR/fetch during load → apiEndpoints for direct API calls.
 */

import { fetchHtmlWithChromium } from './fetcher.js';
import { fetchWithApiDiscovery } from './apiDiscovery.js';
import { generateContract } from './contractGenerator.js';

/**
 * Full pipeline: fetch HTML from URL then generate contract.
 * If discoverApis is true, uses Playwright to record XHR/fetch and adds apiEndpoints to contract.
 * @param {string} url - Page URL
 * @param {{ context?: string, useChromium?: boolean, discoverApis?: boolean, waitUntil?: string, timeout?: number }} options
 * @returns {Promise<{ html: string, contract: Object }>}
 */
export async function urlToContract(url, options = {}) {
  const { context, useChromium = true, discoverApis = false, ...rest } = options;

  if (discoverApis && useChromium) {
    const { html, discoveredApis } = await fetchWithApiDiscovery(url, rest);
    const contract = generateContract(html, { context, discoveredApis });
    return { html, contract };
  }

  const html = await fetchHtmlWithChromium(url, { ...rest, useChromium });
  const contract = generateContract(html, { context });
  return { html, contract };
}

export { fetchHtmlWithChromium } from './fetcher.js';
export { fetchWithApiDiscovery } from './apiDiscovery.js';
export { parseDOM, extractInteractiveGroups } from './domParser.js';
export { generateContract } from './contractGenerator.js';
