// What a customer is charged online, worked out on the server from the order alone. The page
// shows the same numbers (BIN_PRICE and the PROMO_* values in public/index.html): change both
// together. If they ever disagree, checkout refuses to start (see expectedTotal in worker.js),
// so nobody is charged a different amount from the one they were shown.
//
// Amounts are in cents, as Stripe expects.

export const BIN_PRICE = 3500;

// The booking form's "6 or more" needs a head count first, so only 1–5 bins are paid online.
export const MAX_STANDARD_BINS = 5;

export const PROMO = {
  // Same courtesy code as the page. It's public, so it only keeps the promo price to the promo
  // form; checking the service address on each reservation is the real gate.
  code: 'PROMO2026',
  binPrice: 2000,
  allThreePrice: 5500, // All three kinds of bin together; bins beyond those are binPrice each.
  kinds: ['Trash', 'Recycling', 'Green waste'],
  maxBins: 10,
  serviceDate: '2026-11-19',
  // The promo can be paid for up to the end of the service day, Los Angeles time (PST in November).
  payableUntil: Date.parse('2026-11-20T00:00:00-08:00'),
};

/**
 * Prices an order. Returns { ok: true, lineItems, total } or { ok: false, error }.
 *   { kind: 'bins', bins }                            the booking form, at BIN_PRICE per bin
 *   { kind: 'monticello', bins, binTypes, code }      the Monticello Special
 */
export function quote(order, now = Date.now()) {
  if (!order || typeof order !== 'object') return fail('Missing order.');
  const bins = order.bins;

  if (order.kind === 'bins') {
    if (!Number.isInteger(bins) || bins < 1 || bins > MAX_STANDARD_BINS) {
      return fail(`Online payment is for 1 to ${MAX_STANDARD_BINS} bins.`);
    }
    return priced([{ name: 'Trash bin cleaning', unitAmount: BIN_PRICE, quantity: bins }]);
  }

  if (order.kind === 'monticello') {
    if (now >= PROMO.payableUntil) return fail('The Monticello Special has ended.');
    const code = typeof order.code === 'string' ? order.code.replace(/\s+/g, '').toUpperCase() : '';
    if (code !== PROMO.code) return fail('That promo code is not valid.');

    const types = order.binTypes;
    if (!Array.isArray(types) || types.length < 1 || types.length > PROMO.kinds.length ||
        new Set(types).size !== types.length || !types.every((t) => PROMO.kinds.includes(t))) {
      return fail('Choose which bins to clean.');
    }
    if (!Number.isInteger(bins) || bins < types.length || bins > PROMO.maxBins) {
      return fail(`Choose between ${types.length} and ${PROMO.maxBins} bins.`);
    }

    if (types.length < PROMO.kinds.length) {
      return priced([{ name: 'Monticello Special bin cleaning', unitAmount: PROMO.binPrice, quantity: bins }]);
    }
    const items = [{ name: 'Monticello Special: all 3 bins (trash, recycling, green waste)', unitAmount: PROMO.allThreePrice, quantity: 1 }];
    const extra = bins - PROMO.kinds.length;
    if (extra > 0) items.push({ name: 'Monticello Special: extra bin', unitAmount: PROMO.binPrice, quantity: extra });
    return priced(items);
  }

  return fail('Unknown service.');
}

function priced(lineItems) {
  const total = lineItems.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
  return { ok: true, lineItems, total };
}

function fail(error) {
  return { ok: false, error };
}
