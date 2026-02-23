/**
 * Parse HTML string into queryable DOM tree (Cheerio).
 * Extract structure, tags, attributes for semantic analysis.
 */

import * as cheerio from 'cheerio';

/**
 * @param {string} html - Raw HTML string
 * @returns {import('cheerio').CheerioAPI} Cheerio root for querying
 */
export function parseDOM(html) {
  return cheerio.load(html, { decodeEntities: true });
}

/**
 * Get all interactive element groups: forms, standalone buttons, links with intent.
 * @param {import('cheerio').CheerioAPI} $
 * @returns {{ forms: Array<Object>, buttons: Array<Object>, links: Array<Object> }}
 */
export function extractInteractiveGroups($) {
  const forms = [];
  $('form').each((i, el) => {
    const $form = $(el);
    const action = $form.attr('action') || '';
    const method = (($form.attr('method') || 'get').toUpperCase());
    const inputs = [];
    $form.find('input, select, textarea').each((_, inp) => {
      const $inp = $(inp);
      const name = $inp.attr('name');
      if (!name) return;
      const type = ($inp.attr('type') || $inp.prop('tagName').toLowerCase() === 'select' ? 'select' : 'text').toLowerCase();
      inputs.push({
        name,
        type: type === 'select' ? 'string' : inputTypeToSchema(type),
        required: !!$inp.attr('required'),
      });
    });
    const submitText = $form.find('button[type="submit"], input[type="submit"]').first().text().trim() || 'submit';
    forms.push({
      action,
      method: method === 'GET' ? 'GET' : 'POST',
      inputs,
      submitLabel: submitText,
      id: $form.attr('id') || null,
      className: $form.attr('class') || null,
    });
  });

  const buttons = [];
  const buttonSelectors = [
    'button',
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="image"]',
    '[role="button"]',
    'a[class*="btn"], a[class*="button"]',
    '[data-action]',
    '[data-submit]',
    '[onclick]',
  ].join(', ');
  $(buttonSelectors).each((i, el) => {
    const $el = $(el);
    const text = (
      $el.text().trim() ||
      $el.attr('value') ||
      $el.attr('aria-label') ||
      $el.attr('title') ||
      $el.attr('data-label') ||
      $el.attr('data-action') ||
      $el.attr('alt') ||
      ''
    ).trim();
    const id = $el.attr('id') || null;
    const className = $el.attr('class') || null;
    const tag = $el.prop('tagName') ? $el.prop('tagName').toLowerCase() : '';
    const type = ($el.attr('type') || '').toLowerCase();
    const inForm = $el.closest('form').length > 0;
    buttons.push({ text, id, className, tag, type, inForm });
  });

  const links = [];
  $('a[href]').each((i, el) => {
    const $el = $(el);
    const href = ($el.attr('href') || '').trim();
    if (!href || href === '#' || href.startsWith('#') || /^\s*javascript\s*:/i.test(href)) return;
    const text = $el.text().trim();
    const className = $el.attr('class') || null;
    const id = $el.attr('id') || null;
    links.push({ href, text, className, id });
  });

  return { forms, buttons, links };
}

function inputTypeToSchema(type) {
  const map = {
    text: 'string',
    email: 'string',
    password: 'string',
    number: 'number',
    tel: 'string',
    url: 'string',
    hidden: 'string',
    checkbox: 'boolean',
    radio: 'string',
    date: 'string',
    datetime: 'string',
    search: 'string',
  };
  return map[type] || 'string';
}
