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
 * Generate action name from discovered API URL (path + method).
 * @param {{ method: string, url: string }} api
 * @param {Set<string>} used
 */
function apiActionName(api, used) {
  try {
    const u = new URL(api.url);
    const path = u.pathname.replace(/\/$/, '') || 'root';
    const base = path.split('/').filter(Boolean).slice(-2).join('_') || 'api';
    const slug = `${api.method.toLowerCase()}_${base}`.replace(/[^a-z0-9_]/g, '_');
    let name = slug;
    let n = 2;
    while (used.has(name)) name = slug + '_' + n++;
    used.add(name);
    return name;
  } catch {
    const name = `api_${used.size + 1}`;
    used.add(name);
    return name;
  }
}

/**
 * Generate full API contract from HTML.
 * @param {string} html - Full HTML string
 * @param {{ context?: string, discoveredApis?: Array<Object> }} options
 * @returns {Object} API contract (contractName, actions, apiEndpoints)
 */
export function generateContract(html, options = {}) {
  const $ = parseDOM(html);
  const { forms, buttons, links } = extractInteractiveGroups($);
  const contractName = inferContractName($, options.context);
  const actions = [];
  const usedActions = new Set();

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
  actions.forEach((a) => usedActions.add(a.action));

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

  const apiEndpoints = [];
  if (options.discoveredApis && options.discoveredApis.length > 0) {
    for (const api of options.discoveredApis) {
      const actionName = apiActionName(api, usedActions);
      apiEndpoints.push({
        action: actionName,
        method: api.method,
        url: api.url,
        bodySchema: api.bodySchema,
        description: `Real API: ${api.method} ${api.url}`,
      });
    }
  }

  const out = { contractName, actions };
  if (apiEndpoints.length) out.apiEndpoints = apiEndpoints;
  return out;
}
