#!/usr/bin/env node
/**
 * CLI: fetch HTML from URL (Chromium) → generate API contract → print JSON
 * MCP: use "npm run mcp" or node src/mcp-server.js for the web-scraper MCP server.
 * Usage:
 *   node src/cli.js <url> [--context=contactForm] [--output=contract.json]
 *   node src/cli.js --html=./page.html [--context=name] [--output=out.json]
 *   node src/cli.js --mcp   → start MCP server (stdio)
 */

const fs = await import('fs');
const path = await import('path');

const runMcp = process.argv.includes('--mcp');
const url = process.argv.filter((a) => !a.startsWith('--'))[2] ?? process.argv[2];
const contextArg = process.argv.find((a) => a.startsWith('--context='));
const htmlPathArg = process.argv.find((a) => a.startsWith('--html='));
const outputArg = process.argv.find((a) => a.startsWith('--output='));
const useChromium = !process.argv.includes('--no-chromium');
const discoverApis = process.argv.includes('--discover-apis');
const context = contextArg ? contextArg.slice('--context='.length) : undefined;
const htmlPath = htmlPathArg ? htmlPathArg.slice('--html='.length) : undefined;
const outputPath = outputArg ? outputArg.slice('--output='.length) : undefined;

function writeContract(contract) {
  const json = JSON.stringify(contract, null, 2);
  if (outputPath) {
    const out = path.resolve(process.cwd(), outputPath);
    fs.writeFileSync(out, json, 'utf8');
    console.error('Wrote:', out);
  } else {
    console.log(json);
  }
}

async function main() {
  if (runMcp) {
    await import('./mcp-server.js');
    return;
  }

  if (htmlPath) {
    const html = fs.readFileSync(path.resolve(process.cwd(), htmlPath), 'utf8');
    const { generateContract } = await import('./contractGenerator.js');
    const contract = generateContract(html, { context });
    writeContract(contract);
    return;
  }

  if (!url || url.startsWith('--')) {
    console.error(`
Usage:
  node src/cli.js <url> [--context=name] [--discover-apis] [--output=contract.json]
  node src/cli.js --html=./page.html [--context=name] [--output=contract.json]
  node src/cli.js --mcp   (start MCP web-scraper server, stdio)

Examples:
  node src/cli.js https://example.com [--discover-apis] --output=contract.json
  node src/cli.js --html=./saved.html --context=productPage --output=out.json
  npm run mcp   (same as node src/mcp-server.js)
`);
    process.exit(1);
  }

  const { urlToContract } = await import('./index.js');
  const { contract } = await urlToContract(url, { context, useChromium, discoverApis });
  writeContract(contract);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
