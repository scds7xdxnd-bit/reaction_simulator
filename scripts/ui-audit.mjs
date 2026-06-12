/**
 * UI Audit screenshot script
 * Captures every surface of the Reaction Simulator for design review.
 * Run: node scripts/ui-audit.mjs
 * Output: docs/ui-audit/
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT   = join(__dirname, '../docs/ui-audit');
const URL   = 'http://localhost:5174';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VP    = { width: 1440, height: 900 };

mkdirSync(OUT, { recursive: true });

// ─── helpers ──────────────────────────────────────────────────────────────────

async function shot(page, slug, label) {
  await page.screenshot({ path: join(OUT, `${slug}.png`) });
  console.log(`  ✓  ${slug}  — ${label}`);
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Returns center coords {x,y} of the first element matching tag+text, or null
async function centerOf(page, tag, text) {
  return page.evaluate((tag, text) => {
    const el = Array.from(document.querySelectorAll(tag))
      .find(el => el.textContent.trim() === text);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, tag, text);
}

async function hoverLabel(page, text) {
  const pt = await centerOf(page, 'span', text);
  if (!pt) throw new Error(`Label not found: "${text}"`);
  await page.mouse.move(pt.x, pt.y);
  await wait(350);
}

async function clickButton(page, label) {
  const pt = await centerOf(page, 'button', label);
  if (!pt) throw new Error(`Button not found: "${label}"`);
  await page.mouse.click(pt.x, pt.y);
  await wait(450);
}

async function clickTab(page, label) {
  const pt = await centerOf(page, 'button', label);
  if (!pt) throw new Error(`Tab not found: "${label}"`);
  await page.mouse.click(pt.x, pt.y);
  await wait(600);
}

async function resetState(page) {
  // Click canvas background to deselect nodes and close any flyout
  await page.mouse.click(720, 400);
  await wait(250);
  // Press Escape to close modals
  await page.keyboard.press('Escape');
  await wait(200);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nReaction Simulator UI Audit\n' + '─'.repeat(40));

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', `--window-size=${VP.width},${VP.height}`],
    defaultViewport: VP,
  });

  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1200);

  // ── 1. Main canvas (default state) ──────────────────────────────────────────
  console.log('\n[Canvas]');
  await shot(page, '01-canvas-default', 'Full app, default flowsheet loaded');

  // ── 2. Dark mode ─────────────────────────────────────────────────────────────
  console.log('\n[Theme]');
  // Toggle dark mode via the theme button (title="Switch to dark/light mode")
  const themeBtn = await page.$('button[title*="mode"]');
  if (themeBtn) {
    await themeBtn.click();
    await wait(500);
    await shot(page, '02-dark-mode', 'Dark mode');
    await themeBtn.click(); // restore light
    await wait(400);
  } else {
    console.log('  ⚠  theme button not found, skipping');
  }

  // ── 3. Toolbar flyouts ───────────────────────────────────────────────────────
  console.log('\n[Toolbar flyouts]');
  for (const [slug, label] of [
    ['03-toolbar-reactors',  'Reactors'],
    ['04-toolbar-separate',  'Separate'],
    ['05-toolbar-pressure',  'Pressure'],
    ['06-toolbar-flow',      'Flow'],
  ]) {
    await resetState(page);
    try {
      await hoverLabel(page, label);
      await shot(page, slug, `${label} flyout`);
    } catch (e) {
      console.log(`  ⚠  ${e.message}`);
    }
  }

  // ── 4. Bottom toolbar actions ────────────────────────────────────────────────
  console.log('\n[Toolbar actions]');
  await resetState(page);

  // Params panel
  try {
    await clickButton(page, 'Params');
    await shot(page, '07-params-panel', 'Global Params panel open');
    await clickButton(page, 'Params'); // close
  } catch (e) { console.log(`  ⚠  Params: ${e.message}`); }

  // Examples flyout
  try {
    await resetState(page);
    await clickButton(page, 'Examples');
    await shot(page, '08-examples-flyout', 'Examples flyout open');
    await resetState(page);
  } catch (e) { console.log(`  ⚠  Examples: ${e.message}`); }

  // Export flyout (visible only when there are results)
  try {
    await resetState(page);
    await clickButton(page, 'Export');
    await shot(page, '09-export-flyout', 'Export flyout open (with results)');
    await resetState(page);
  } catch (e) { console.log(`  ⚠  Export (may be disabled): ${e.message}`); }

  // ── 5. Right panel tabs ───────────────────────────────────────────────────────
  console.log('\n[Right panel tabs]');
  const tabs = [
    ['10-panel-levenspiel', 'Levenspiel'],
    ['11-panel-profiles',   'Profiles'],
    ['12-panel-thermal',    'Thermal'],
    ['13-panel-dynamic',    'Dynamic'],
    ['14-panel-analysis',   'Analysis'],
    ['15-panel-scenarios',  'Scenarios'],
    ['16-panel-design',     'Design'],
  ];
  for (const [slug, label] of tabs) {
    await resetState(page);
    try {
      await clickTab(page, label);
      await shot(page, slug, `${label} tab`);
    } catch (e) { console.log(`  ⚠  ${label} tab: ${e.message}`); }
  }

  // ── 6. Node selection / config panels ────────────────────────────────────────
  console.log('\n[Node config panels]');
  // Click on the first visible node (CSTR) on the canvas
  // Nodes are rendered by React Flow — we'll find them by their label text
  await resetState(page);

  // Double-click the CSTR node to open its config panel
  const reactorNodes = await page.$$('.react-flow__node');
  for (const node of reactorNodes) {
    const text = await node.evaluate(el => el.textContent || '');
    if (text.includes('CSTR')) {
      await node.click();
      await wait(500);
      await shot(page, '17-node-cstr-selected', 'CSTR node selected (config sidebar open)');

      // Double-click to open inline editor if available
      await node.click({ clickCount: 2 });
      await wait(500);
      await shot(page, '18-node-cstr-edit', 'CSTR node double-click (inline param edit)');
      await page.keyboard.press('Escape');
      await wait(300);
      break;
    }
  }

  for (const node of reactorNodes) {
    const text = await node.evaluate(el => el.textContent || '');
    if (text.includes('PFR')) {
      await node.click();
      await wait(500);
      await shot(page, '19-node-pfr-selected', 'PFR node selected (config sidebar open)');
      break;
    }
  }

  // ── 7. Reaction builder modal ─────────────────────────────────────────────────
  console.log('\n[Modals]');
  await resetState(page);
  // The reaction builder is typically opened from the params panel or via a reaction button
  // Try to open it from within the CSTR panel (right-click or edit button)
  try {
    const pt = await page.evaluate(() => {
      const candidates = ['Edit Reaction', 'Reactions', 'Add Reaction', '+ Reaction'];
      for (const txt of candidates) {
        const el = Array.from(document.querySelectorAll('button, [role="button"]'))
          .find(el => el.textContent.trim().includes(txt));
        if (el) {
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
      }
      return null;
    });
    if (pt) {
      await page.mouse.click(pt.x, pt.y);
      await wait(600);
      await shot(page, '20-reaction-builder-modal', 'Reaction builder modal');
      await page.keyboard.press('Escape');
      await wait(300);
    } else {
      console.log('  ⚠  Reaction builder button not found');
    }
  } catch (e) { console.log(`  ⚠  Reaction builder: ${e.message}`); }

  // ── 8. Design specs panel ─────────────────────────────────────────────────────
  try {
    await resetState(page);
    // Try right-click on a node for design spec context menu
    for (const node of reactorNodes) {
      const text = await node.evaluate(el => el.textContent || '');
      if (text.includes('CSTR') || text.includes('PFR')) {
        await node.click({ button: 'right' });
        await wait(400);
        await shot(page, '21-context-menu', 'Node right-click context menu');
        await page.keyboard.press('Escape');
        await wait(300);
        break;
      }
    }
  } catch (e) { console.log(`  ⚠  Context menu: ${e.message}`); }

  // ── 9. Stream table close-up (bottom panel) ───────────────────────────────────
  console.log('\n[Stream table]');
  await resetState(page);
  // Scroll to stream table at bottom
  // Stream table is in the right panel alongside the Levenspiel plot
  // Scroll the right-panel container to reveal the table below the chart
  await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('*'))
      .find(el => el.textContent.trim() === 'STREAM TABLE');
    if (heading) heading.scrollIntoView({ block: 'start' });
  });
  await wait(300);
  await shot(page, '22-stream-table', 'Stream table (scrolled into view in right panel)');

  // ── 10. Responsive / narrow view ─────────────────────────────────────────────
  console.log('\n[Responsive]');
  await resetState(page);
  await page.setViewport({ width: 1280, height: 800 });
  await wait(400);
  await shot(page, '23-viewport-1280', '1280×800 viewport');

  await page.setViewport({ width: 1920, height: 1080 });
  await wait(400);
  await shot(page, '24-viewport-1920', '1920×1080 viewport');

  // ── Done ──────────────────────────────────────────────────────────────────────
  await browser.close();

  console.log(`\n✅  ${tabs.length + 20}+ screenshots saved to docs/ui-audit/\n`);
}

main().catch(err => {
  console.error('\n❌ Audit failed:', err.message);
  process.exit(1);
});
