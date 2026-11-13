/**
 * Regression guard for v1.9 after Flips and the separate Refinamiento tab were retired.
 *
 * This file deliberately retains its historical filename to replace the obsolete
 * v1.8 test in GitHub when v1.9 is uploaded over an existing repository.
 * It has no dependency on the removed `src/flipping.js` module.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const main = readFileSync('src/main.js', 'utf8');
const branches = readFileSync('src/branches.js', 'utf8');

const countRoutes = (markup, className) =>
  [...markup.matchAll(/<button\b[^>]*>/g)]
    .map(match => match[0])
    .filter(tag => new RegExp(`class="[^"]*\\b${className}\\b`).test(tag))
    .map(tag => tag.match(/data-route="([^"]+)"/)?.[1])
    .filter(Boolean);

test('v4.1: diez herramientas en escritorio, agrupadas (vuelven los flips, al Mercado Negro)', () => {
  assert.deepEqual(countRoutes(html, 'nav-link'), ['top', 'planner', 'bm', 'refine', 'calc', 'prices', 'flips', 'enchant', 'business', 'farm']);
  assert(!html.includes('data-route="flip"'));
});

test('v4.0: cinco accesos principales en la barra del teléfono (el resto en el menú)', () => {
  assert.deepEqual(countRoutes(html, 'phone-tab'), ['top', 'planner', 'bm', 'refine', 'calc']);
});

test('Migración v1.9: refinamiento dentro del Top, y transferencias activas', () => {
  assert.match(branches, /key:'refining',title:'Refinamiento'/);
  for (const action of ['mark-first', 'clear-marked', 'send-marked-planner', 'send-marked-calc', 'send-plan-calc']) {
    assert(main.includes(action), `Control ausente: ${action}`);
  }
  assert(!main.includes('function flipPage()'));
  assert(!main.includes('function runFlips()'));
});
