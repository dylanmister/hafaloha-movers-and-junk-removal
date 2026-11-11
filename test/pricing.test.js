// Run with `npm test`. Checks the amounts customers are charged online, and that the page shows
// the same prices the server charges.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { quote, BIN_PRICE, MAX_STANDARD_BINS, PROMO } from '../src/pricing.js';

const ALL_THREE = ['Trash', 'Recycling', 'Green waste'];
const BEFORE = Date.parse('2026-11-10T12:00:00-08:00');
const LAST_MINUTE = Date.parse('2026-11-19T23:59:00-08:00');
const AFTER = Date.parse('2026-11-20T00:00:00-08:00');
const promo = (bins, binTypes, code = 'PROMO2026', now = BEFORE) => quote({ kind: 'monticello', bins, binTypes, code }, now);

test('standard bin cleaning is $35 a bin, 1 to 5 bins', () => {
  assert.equal(quote({ kind: 'bins', bins: 1 }).total, 3500);
  assert.equal(quote({ kind: 'bins', bins: 5 }).total, 17500);
  assert.deepEqual(quote({ kind: 'bins', bins: 2 }).lineItems, [{ name: 'Trash bin cleaning', unitAmount: 3500, quantity: 2 }]);
  for (const bins of [0, 6, 2.5, '3', null, undefined, -1]) {
    assert.equal(quote({ kind: 'bins', bins }).ok, false, `bins: ${bins}`);
  }
});

test('Monticello: $20 a bin unless all three kinds are ticked', () => {
  assert.equal(promo(1, ['Trash']).total, 2000);
  assert.equal(promo(2, ['Trash', 'Recycling']).total, 4000);
  assert.equal(promo(10, ['Green waste']).total, 20000);
});

test('Monticello: all three kinds are $55, then $20 for each extra bin', () => {
  assert.equal(promo(3, ALL_THREE).total, 5500);
  assert.equal(promo(4, ALL_THREE).total, 7500);
  assert.equal(promo(10, ALL_THREE).total, 19500);
  assert.equal(promo(3, ALL_THREE).lineItems.length, 1);
  assert.deepEqual(promo(5, ALL_THREE).lineItems[1], { name: 'Monticello Special: extra bin', unitAmount: 2000, quantity: 2 });
});

test('Monticello: the server matches the page for every choice the form allows', () => {
  // The page's own formula (promoPrice in public/index.html, used by the pop-up and the "Pay online"
  // card), in dollars.
  const pageTotal = (bins, kinds) => (kinds === 3 ? 55 + (bins - 3) * 20 : bins * 20);
  const kindSets = [['Trash'], ['Recycling', 'Green waste'], ALL_THREE];
  for (const kinds of kindSets) {
    for (let bins = kinds.length; bins <= 10; bins++) {
      assert.equal(promo(bins, kinds).total, pageTotal(bins, kinds.length) * 100, `${bins} bins, ${kinds}`);
    }
  }
});

test('Monticello: the code is checked, ignoring case and spaces', () => {
  assert.equal(promo(1, ['Trash'], ' promo 2026 ').ok, true);
  assert.equal(promo(1, ['Trash'], 'PROMO2025').ok, false);
  assert.equal(promo(1, ['Trash'], '').ok, false);
  assert.equal(quote({ kind: 'monticello', bins: 1, binTypes: ['Trash'] }, BEFORE).ok, false, 'no code at all');
});

test('Monticello: bin choices have to make sense', () => {
  assert.equal(promo(1, []).ok, false, 'no kinds');
  assert.equal(promo(1, ['Trash', 'Recycling']).ok, false, 'fewer bins than kinds');
  assert.equal(promo(2, ['Trash', 'Trash']).ok, false, 'a kind twice');
  assert.equal(promo(1, ['Compost']).ok, false, 'unknown kind');
  assert.equal(promo(11, ['Trash']).ok, false, 'over 10 bins');
  assert.equal(promo(2.5, ['Trash']).ok, false, 'not a whole number');
  assert.equal(promo(1, 'Trash').ok, false, 'not a list');
});

test('Monticello: payable through the end of Nov 19 (Los Angeles), not after', () => {
  assert.equal(promo(1, ['Trash'], 'PROMO2026', LAST_MINUTE).ok, true);
  assert.equal(promo(1, ['Trash'], 'PROMO2026', AFTER).ok, false);
});

test('unknown services are refused', () => {
  assert.equal(quote({ kind: 'moving', bins: 1 }).ok, false);
  assert.equal(quote(null).ok, false);
});

test('the page shows the prices the server charges', () => {
  const page = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const pageValue = (name) => {
    const match = page.match(new RegExp(`var ${name} = '?([^';]+)'?;`));
    assert.ok(match, `${name} not found in public/index.html`);
    return match[1];
  };
  assert.equal(Number(pageValue('BIN_PRICE')) * 100, BIN_PRICE);
  assert.equal(Number(pageValue('PROMO_BIN_PRICE')) * 100, PROMO.binPrice);
  assert.equal(Number(pageValue('PROMO_ALL_THREE_PRICE')) * 100, PROMO.allThreePrice);
  assert.equal(pageValue('PROMO_CODE'), PROMO.code);
  assert.equal(Number(pageValue('PROMO_MAX_BINS')), PROMO.maxBins);
  // The booking form's last numbered option is the most that can be paid online.
  assert.match(page, new RegExp(`<option value="${MAX_STANDARD_BINS} bins">`));
  assert.match(page, new RegExp(`<option value="${MAX_STANDARD_BINS + 1} or more bins">`));
});

test('the Monticello pop-up and card offer the kinds and counts the server accepts', () => {
  const page = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  // The "Pay online" card is built from PROMO_KINDS.
  const kinds = page.match(/var PROMO_KINDS = \[([^\]]*)\];/);
  assert.ok(kinds, 'PROMO_KINDS not found in public/index.html');
  assert.deepEqual(kinds[1].split(',').map((kind) => kind.trim().replace(/^'|'$/g, '')), PROMO.kinds);
  // The pop-up's form is written out in the HTML.
  for (const kind of PROMO.kinds) assert.match(page, new RegExp(`name="binType" value="${kind}"`));
  assert.match(page, new RegExp(`<option value="${PROMO.maxBins}">`));
  assert.doesNotMatch(page, new RegExp(`<option value="${PROMO.maxBins + 1}">`));
});
