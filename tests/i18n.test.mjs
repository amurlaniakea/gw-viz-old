// Comprueba que ES y EN están completos y que el HTML por defecto (español) coincide con el diccionario.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STR } from '../docs/js/i18n.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const html = read('../docs/index.html'), app = read('../docs/js/app.js');
const keys = (l) => Object.keys(STR[l]).sort();

test('ES y EN tienen exactamente las mismas claves, sin textos vacíos', () => {
  assert.deepEqual(keys('en'), keys('es'));
  for (const l of Object.keys(STR)) for (const k of keys(l)) {
    const v = STR[l][k]; assert.ok(typeof v === 'function' || String(v).trim().length > 0, `${l}.${k} vacío`);
  }
});

test('todas las claves usadas en index.html y app.js existen', () => {
  const used = new Set();
  for (const m of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) used.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) m[1].split(';').forEach((p) => used.add(p.split(':')[1]));
  for (const m of app.matchAll(/\bt\('([^']+)'/g)) used.add(m[1]);
  for (const m of app.matchAll(/set(?:Status)\('([^']+)'/g)) used.add(m[1]);
  for (const k of used) assert.ok(k in STR.es && k in STR.en, `falta la clave ${k}`);
  assert.ok(used.size > 40);
});

test('el HTML por defecto es idéntico al diccionario español', () => {
  const re = /<(\w+)([^>]*?)\sdata-i18n(?:-html)?="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g; let n = 0;
  for (const m of html.matchAll(re)) { n++; assert.equal(m[5], STR.es[m[3]], `clave ${m[3]}`); }
  assert.ok(n >= 28, `solo ${n} elementos`);
});

test('inglés y francés: sin restos de español (salvo nombres propios) y sin cadenas sin traducir', () => {
  const same = new Set(['ph_ins', 'ph_rd', 'lane_h1', 'lane_l1', 'r_sh', 'r_sl', 'pause', 'o_ph', 'r_fr']);
  const spanish = { en: /[áéíóúñ¿¡«»]/, fr: /[áíóúñ¿¡]/ };      // el francés comparte é è ê « »
  for (const l of ['en', 'fr']) for (const k of keys(l)) {
    const v = STR[l][k]; if (typeof v === 'function') continue;
    assert.ok(!spanish[l].test(v.replace(/Jiménez-Forteza|Martínez/g, '')), `restos de español en ${l}.${k}: ${v}`);
    if (!same.has(k)) { assert.notEqual(v, STR.es[k], `${l}.${k} igual que el español`); if (l === 'fr') assert.notEqual(v, STR.en[k], `fr.${k} igual que el inglés`); }
  }
  assert.match(STR.en.st_ok('X'), /Real data loaded: X/);
  assert.match(STR.fr.st_ok('X'), /Données réelles chargées\u00a0: X/);
});

test('el selector de idioma ofrece exactamente los idiomas del diccionario', () => {
  const sel = html.match(/<select id="lang"[^>]*>([\s\S]*?)<\/select>/)[1];
  assert.deepEqual([...sel.matchAll(/value="(\w+)"/g)].map((m) => m[1]).sort(), Object.keys(STR).sort());
});
