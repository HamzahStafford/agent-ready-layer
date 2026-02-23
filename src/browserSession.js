/**
 * Browser session: one Playwright browser + page, act like a human (click, fill, navigate).
 * Contract = map of what actions exist; this module = execution in real browser.
 */

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

let browser = null;
let page = null;

function hasPage() {
  return page != null;
}

/**
 * Launch browser (optionally headed so user can watch).
 * @param {{ headed?: boolean }} options
 */
export async function launch(options = {}) {
  if (browser) return { ok: true, message: 'Browser already open' };
  const { headed = false } = options;
  browser = await chromium.launch({
    headless: !headed,
    args: headed ? [] : ['--no-sandbox'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  page = await context.newPage();
  return { ok: true, message: headed ? 'Browser opened (visible)' : 'Browser opened (headless)' };
}

/**
 * Navigate to URL.
 * @param {string} url
 * @param {{ waitUntil?: 'load'|'domcontentloaded'|'networkidle', timeout?: number }} options
 */
export async function navigate(url, options = {}) {
  if (!page) throw new Error('Browser not launched. Call browser_launch first.');
  const { waitUntil = 'domcontentloaded', timeout = 30000 } = options;
  const res = await page.goto(url, { waitUntil, timeout });
  return {
    ok: true,
    url: page.url(),
    status: res?.status(),
    title: await page.title(),
  };
}

/**
 * Click element by visible text, aria-label, or CSS selector.
 * @param {string} descriptionOrSelector - e.g. "Add to cart", "Search", or "button#submit"
 */
export async function click(descriptionOrSelector) {
  if (!page) throw new Error('Browser not launched. Call browser_launch first.');
  const s = String(descriptionOrSelector || '').trim();
  if (!s) throw new Error('click: description or selector is required');
  const looksLikeSelector = /^[#.\[]|[a-z]+\[|^input$|^button$/i.test(s) || s.includes('>>');
  let locator;
  if (looksLikeSelector && s.length < 200) {
    try {
      locator = page.locator(s).first();
    } catch {
      locator = null;
    }
  }
  if (!locator) {
    locator = page.getByRole('button', { name: s }).or(page.getByRole('link', { name: s })).or(page.getByText(s, { exact: false }).first());
  }
  await locator.click({ timeout: 10000 });
  return { ok: true, clicked: s };
}

/**
 * Fill one input by label text, name, or selector.
 * @param {string} fieldIdentifier - label text, input name, or CSS selector
 * @param {string} value
 */
export async function fill(fieldIdentifier, value) {
  if (!page) throw new Error('Browser not launched. Call browser_launch first.');
  const id = fieldIdentifier.trim();
  const byName = page.locator(`input[name="${id}"], select[name="${id}"], textarea[name="${id}"]`).first();
  const byLabel = page.getByLabel(id).first();
  const byPlaceholder = page.getByPlaceholder(id).first();
  const locator = byName.or(byLabel).or(byPlaceholder);
  await locator.fill(String(value), { timeout: 8000 });
  return { ok: true, field: id, value: String(value) };
}

/**
 * Fill multiple form fields (e.g. search, filters). Keys = field name or label.
 * @param {Record<string, string>} fields - e.g. { "search": "trekking shoes", "size": "40" }
 */
export async function fillForm(fields) {
  if (!page) throw new Error('Browser not launched. Call browser_launch first.');
  const results = [];
  for (const [name, value] of Object.entries(fields)) {
    await fill(name, value);
    results.push({ field: name, value });
  }
  return { ok: true, filled: results };
}

/**
 * Snapshot of current page: interactive elements (buttons, links, forms) so agent knows what to do next.
 * Uses same idea as contract: list of clickables and form fields.
 */
export async function getSnapshot() {
  if (!page) throw new Error('Browser not launched. Call browser_launch first.');
  const html = await page.content();
  const $ = cheerio.load(html, { decodeEntities: true });

  const buttons = [];
  const links = [];
  const forms = [];

  $('button, input[type="submit"], input[type="button"], [role="button"]').each((i, el) => {
    const $el = $(el);
    const text = ($el.text() || $el.attr('value') || $el.attr('aria-label') || '').trim().slice(0, 80);
    if (text) buttons.push({ type: 'button', text, tag: $el.prop('tagName')?.toLowerCase() });
  });

  $('a[href]').each((i, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    if (!href || href === '#' || href.startsWith('javascript:')) return;
    const text = $el.text().trim().slice(0, 80);
    if (text) links.push({ type: 'link', text, href: href.slice(0, 200) });
  });

  $('form').each((i, el) => {
    const $form = $(el);
    const inputs = [];
    $form.find('input, select, textarea').each((_, inp) => {
      const $inp = $(inp);
      const name = $inp.attr('name');
      if (!name || ($inp.attr('type') || '').toLowerCase() === 'hidden') return;
      const label = $inp.attr('aria-label') || $inp.attr('placeholder') || name;
      inputs.push({ name, label, type: ($inp.attr('type') || 'text').toLowerCase() });
    });
    const submitText = $form.find('button[type="submit"], input[type="submit"]').first().text().trim() || 'Submit';
    forms.push({ type: 'form', submitLabel: submitText, inputs });
  });

  const title = $('title').text().trim() || '';
  const currentUrl = page.url();

  return {
    url: currentUrl,
    title,
    buttons: buttons.slice(0, 50),
    links: links.slice(0, 80),
    forms,
  };
}

/**
 * Close browser.
 */
export async function close() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    return { ok: true, message: 'Browser closed' };
  }
  return { ok: true, message: 'No browser was open' };
}

export { hasPage };
