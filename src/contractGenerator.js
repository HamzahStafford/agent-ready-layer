/**
 * Build API contract from semantic DOM groups.
 * Output: contractName, actions (method, endpoint, schema).
 */

import { extractInteractiveGroups } from './domParser.js';
import { parseDOM } from './domParser.js';

const AGENT_PREFIX = '/agent';

/**
 * Infer contract name from page (title, first form, or default).
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} [contextHint]
 */
function inferContractName($, contextHint) {
  if (contextHint && /^[a-zA-Z0-9_]+$/.test(contextHint.replace(/\s/g, '_'))) {
    return contextHint.replace(/\s/g, '_');
  }
  const title = $('title').text().trim();
  if (title) {
    return title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40) || 'pageActions';
  }
  return 'pageActions';
}

/**
 * Slug for action names and endpoints.
 */
function slug(name) {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

/**
 * Build schema object from form inputs.
 */
function buildSchemaFromInputs(inputs) {
  const schema = {};
  for (const { name, type, required } of inputs) {
    schema[name] = { type, required };
  }
  return schema;
}

/**
 * Generate full API contract from HTML.
 * @param {string} html - Full HTML string
 * @param {{ context?: string, selectorsHint?: Record<string, string> }} options
 * @returns {Object} API contract (contractName, actions)
 */
export function generateContract(html, options = {}) {
  const $ = parseDOM(html);
  const { forms, buttons, links } = extractInteractiveGroups($);
  const contractName = inferContractName($, options.context);
  const actions = [];

  // Forms → POST/GET actions
  forms.forEach((form, idx) => {
    const actionName = form.submitLabel ? slug(form.submitLabel) : `submitForm_${idx + 1}`;
    const schema = buildSchemaFromInputs(form.inputs);
    actions.push({
      action: actionName,
      method: form.method,
      endpoint: `${AGENT_PREFIX}/${actionName}`,
      schema: Object.fromEntries(
        Object.entries(schema).map(([k, v]) => [k, v.type])
      ),
      description: form.submitLabel ? `Submit: ${form.submitLabel}` : `Form ${idx + 1}`,
    });
  });

  function ensureUnique(baseName, used) {
    let name = baseName;
    let n = 2;
    while (used.has(name)) name = baseName + '_' + n++;
    used.add(name);
    return name;
  }
  const usedActions = new Set(actions.map((a) => a.action));

  const formActionNames = new Set(forms.map((f) => (f.submitLabel ? slug(f.submitLabel) : '')).filter(Boolean));
  buttons.forEach((btn, idx) => {
    const base = (btn.text && slug(btn.text)) || (btn.id && slug(btn.id)) || '';
    if (btn.inForm && base && formActionNames.has(base)) return;
    const actionName = ensureUnique(base || `button_${idx + 1}`, usedActions);
    actions.push({
      action: actionName,
      method: 'POST',
      endpoint: `${AGENT_PREFIX}/${actionName}`,
      schema: {},
      description: btn.text || btn.id || `Button ${idx + 1}`,
    });
  });

  links.forEach((link) => {
    const pathSlug = slug(link.href.replace(/^https?:\/\/[^/]+/, '').replace(/\//g, '_').slice(0, 30)) || 'link';
    const baseName = (link.text && slug(link.text)) || (link.id && slug(link.id)) || pathSlug;
    const actionName = ensureUnique(baseName, usedActions);
    actions.push({
      action: actionName,
      method: 'GET',
      endpoint: `${AGENT_PREFIX}/${actionName}`,
      schema: {},
      description: link.text || link.href,
    });
  });

  return {
    contractName,
    actions,
  };
}
