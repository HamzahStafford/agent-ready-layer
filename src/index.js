/**
 * Agent Web Contract Generator
 * Pipeline: URL → Chromium HTML → DOM parse → semantic analysis → API contract JSON
 */

import { fetchHtmlWithChromium } from './fetcher.js';
import { generateContract } from './contractGenerator.js';

/**
 * Full pipeline: fetch HTML from URL then generate contract.
 * @param {string} url - Page URL
 * @param {{ context?: string, waitUntil?: string, timeout?: number }} options
 * @returns {Promise<{ html: string, contract: Object }>}
 */
export async function urlToContract(url, options = {}) {
  const { context, useChromium = true, ...fetchOpts } = options;
  const html = await fetchHtmlWithChromium(url, { ...fetchOpts, useChromium });
  const contract = generateContract(html, { context });
  return { html, contract };
}

export { fetchHtmlWithChromium } from './fetcher.js';
export { parseDOM, extractInteractiveGroups } from './domParser.js';
export { generateContract } from './contractGenerator.js';
