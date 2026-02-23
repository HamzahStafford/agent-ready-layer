/**
 * Capture XHR/fetch requests while loading a page (Playwright).
 * Returns list of API endpoints + sample payloads so the agent can call them directly.
 */

import { chromium } from 'playwright';

const API_RESOURCE_TYPES = new Set(['xhr', 'fetch']);

/**
 * Infer a minimal JSON schema from a request body (object).
 * @param {Object} obj
 * @returns {Object} schema like { key: "string" | "number" | "boolean" | "object" }
 */
function inferSchemaFromBody(obj) {
  if (obj === null || typeof obj !== 'object') {
    return { _body: typeof obj };
  }
  const schema = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) schema[k] = 'string';
    else if (Array.isArray(v)) schema[k] = 'array';
    else if (typeof v === 'object') schema[k] = 'object';
    else schema[k] = typeof v;
  }
  return schema;
}

/**
 * Fetch HTML and record all XHR/fetch requests (API calls) made during page load.
 * @param {string} url - Page URL
 * @param {{ waitUntil?: string, timeout?: number, waitAfterLoad?: number }} options
 * @returns {Promise<{ html: string, discoveredApis: Array<Object> }>}
 */
export async function fetchWithApiDiscovery(url, options = {}) {
  const {
    waitUntil = 'domcontentloaded',
    timeout = 30000,
    waitAfterLoad = 2500,
  } = options;

  const discoveredApis = [];
  const seen = new Set();

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    page.on('requestfinished', async (request) => {
      const type = request.resourceType();
      if (!API_RESOURCE_TYPES.has(type)) return;
      const u = request.url();
      const method = request.method();
      const key = `${method} ${u}`;
      if (seen.has(key)) return;
      seen.add(key);

      let postData = null;
      let postDataJSON = null;
      try {
        postData = request.postData();
        postDataJSON = request.postDataJSON();
      } catch (_) {}

      const headers = request.headers();
      const contentType = headers['content-type'] || '';

      discoveredApis.push({
        method,
        url: u,
        postDataSample: postData || undefined,
        bodySchema: postDataJSON && typeof postDataJSON === 'object'
          ? inferSchemaFromBody(postDataJSON)
          : undefined,
        contentType: contentType.slice(0, 80) || undefined,
      });
    });

    await page.goto(url, { waitUntil, timeout });
    await new Promise((r) => setTimeout(r, waitAfterLoad));

    const html = await page.content();
    return {
      html,
      discoveredApis: [...discoveredApis],
    };
  } finally {
    await browser.close();
  }
}
