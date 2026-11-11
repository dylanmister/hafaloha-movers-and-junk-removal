// Cloudflare Worker for hafaloha.us. The site is static (public/) and Cloudflare serves those files
// directly, without running this. This script answers only the /api/ paths below, which take
// payments through Stripe Checkout: Stripe's own secure payment page. It takes cards only, typed in
// or through Apple Pay (at the top on Apple devices), then sends the customer back to the site.
// Card details never touch this site.
//
//   GET  /api/checkout/available    { available }      The page offers "Pay now" only when available.
//   GET  /api/catalog               { products, monticello }
//                                                      The Stripe product catalog, for the "Pay
//                                                      online" section, and whether that section's
//                                                      Monticello Special card can take payment.
//   POST /api/checkout              { url }            Opens a Checkout Session; the page goes to url.
//                                                      Either a product from the catalog (kind
//                                                      'catalog'), or bin cleaning priced here (kind
//                                                      'bins' or 'monticello', pricing.js).
//   GET  /api/checkout/session?id=  { status, paymentStatus, amountTotal, ref }
//                                                      What the page may say once Stripe sends the
//                                                      customer back.
//   POST /api/stripe/webhook        Stripe's events. The dependable record that a payment went
//                                   through: a customer can pay and never make it back to the site.
//
// Secrets never go in this file or the repo (it's public). Locally they live in .dev.vars; online,
// set them with `npx wrangler secret put <NAME>`:
//   STRIPE_SECRET_KEY       A restricted key (rk_…) with these permissions: Checkout Sessions: Write,
//                           Products: Read, and Prices: Read.
//   STRIPE_WEBHOOK_SECRET   The signing secret (whsec_…) of the webhook endpoint.

import Stripe from 'stripe';
import { quote, PROMO } from './pricing.js';

const API_VERSION = '2026-10-28.endive';
// Marks the sessions this site opens, so Stripe can tell this integration apart from others.
const INTEGRATION_ID = 'hafaloha_website_vqtmzkbr';
const MAX_BODY_BYTES = 8 * 1024;
const PROBLEM = 'Something went wrong. Please try again, or call or text (949) 731-4378.';
// The only ways to pay on this site: cards, typed in or through Apple Pay, which Stripe counts as
// a card payment. Stripe still starts from what's turned on in the Dashboard (Settings → Payment
// methods) and this narrows it, so Cash App Pay, bank payments and the rest never show here, even
// when they're on there. Link, Stripe's saved-details wallet, rides along with cards and offers its
// own bank and Klarna payments, so it's switched off too (NO_LINK). Google Pay is a card wallet as
// well, which the code can't hold back: keep it off in the Dashboard. The page's "ways to pay" row
// says the same (public/index.html).
const PAYMENT_METHODS = ['card'];
const NO_LINK = { link: { display: 'never' } };
// What Stripe's page asks for when no booking form came first ("Pay online"): who, where, and how
// to reach them. Stripe's address form (it calls it the shipping address) takes the name and phone
// too, and Apple Pay can fill it all in. Don't swap it for a custom field: any custom field makes
// Stripe leave Apple Pay off the page.
const ASK_WHERE = {
  shipping_address_collection: { allowed_countries: ['US'] },
  phone_number_collection: { enabled: true },
  custom_text: { shipping_address: { message: "The address where we'll do the job." } },
};
// How long the catalog is reused before asking Stripe again. A change in the Dashboard shows on
// the site within this time.
const CATALOG_SECONDS = 300;
// How many of a thing can be paid for at once, by the product's unit label in Stripe. A product
// can set its own with the metadata key website_max_quantity. Bins stop at 5 ("6 or more" needs
// a count first), as on the booking form.
const MAX_BY_UNIT = { bin: 5, hour: 12 };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const route = `${request.method} ${url.pathname}`;
    try {
      switch (route) {
        case 'GET /api/checkout/available': return json({ available: Boolean(env.STRIPE_SECRET_KEY) });
        case 'GET /api/catalog': return await catalog(env, ctx, url);
        case 'POST /api/checkout': return await createCheckout(request, env, url);
        case 'GET /api/checkout/session': return await checkoutSession(url, env);
        case 'POST /api/stripe/webhook': return await webhook(request, env);
        default: return json({ error: 'Not found.' }, 404);
      }
    } catch (err) {
      // Log what Stripe says went wrong and its request ID (to look up in the Dashboard), never
      // the key or the customer's details.
      console.error(JSON.stringify({ msg: 'api error', route, type: err?.type, code: err?.code, requestId: err?.requestId, message: err?.message }));
      return json({ error: PROBLEM }, 500);
    }
  },
};

/* ---- The catalog ---- */

// Every active product with an active one-off USD default price, unless its metadata says
// website: hide (the Monticello Special, for one: it's for code holders only, so the page gives it
// a card of its own, priced from pricing.js). Oldest first, unless a product sets website_order.
async function catalog(env, ctx, url) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Online payment is not set up yet.' }, 503);

  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}/api/catalog?v=3`);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const products = await stripe(env).products.list({ active: true, limit: 100, expand: ['data.default_price'] });
  const items = products.data
    .filter(showOnSite)
    .map(catalogItem)
    .filter(Boolean)
    .sort((a, b) => a.sort - b.sort || a.created - b.created)
    .map(({ sort, created, ...item }) => item);

  // The Monticello Special's card shows only while the special can still be paid for.
  const monticello = Date.now() < PROMO.payableUntil;
  const response = json({ products: items, monticello }, 200, `public, max-age=${CATALOG_SECONDS}`);
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function showOnSite(product) {
  return product.active && (product.metadata?.website || '').trim().toLowerCase() !== 'hide';
}

// What the page needs to show one product and pay for it. amount is null when the customer
// enters it at checkout (a "customer chooses price" price, used for quoted jobs).
function catalogItem(product) {
  const price = product.default_price;
  if (!price || typeof price !== 'object' || !price.active || price.type !== 'one_time' || price.currency !== 'usd') return null;
  const custom = Boolean(price.custom_unit_amount);
  if (!custom && !(price.unit_amount > 0)) return null;
  const unit = (product.unit_label || '').trim().toLowerCase();
  const order = Number(product.metadata?.website_order);
  return {
    price: price.id,
    name: product.name,
    description: product.description || '',
    // The card's checklist (the product's Marketing feature list in the Dashboard) and the badge by
    // its name (metadata website_badge), when the product has them.
    features: (product.marketing_features || []).map((feature) => clean(feature?.name, 80)).filter(Boolean).slice(0, 6),
    badge: clean(product.metadata?.website_badge, 24),
    amount: custom ? null : price.unit_amount,
    unit,
    maxQuantity: custom ? 1 : maxQuantity(product),
    sort: Number.isFinite(order) ? order : 1000,
    created: product.created,
  };
}

function maxQuantity(product) {
  const set = Number(product.metadata?.website_max_quantity);
  if (Number.isInteger(set) && set >= 1 && set <= 99) return set;
  return MAX_BY_UNIT[(product.unit_label || '').trim().toLowerCase()] || 1;
}

/* ---- Opening a checkout ---- */

async function createCheckout(request, env, url) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Online payment is not set up yet.' }, 503);

  // Only the site's own pages can start a checkout.
  if (request.headers.get('Origin') !== url.origin) return json({ error: 'Forbidden.' }, 403);

  const body = await readJson(request);
  if (!body) return json({ error: 'Bad request.' }, 400);

  // A short reference (HF-XXXXXX) that ties the payment to the booking email, when there is one.
  const ref = typeof body.ref === 'string' && /^HF-[A-Z0-9]{6}$/.test(body.ref) ? body.ref : '';
  if (!ref) return json({ error: 'Bad request.' }, 400);

  return body.kind === 'catalog' ? catalogCheckout(body, ref, env, url) : bookingCheckout(body, ref, env, url);
}

// A product from the "Pay online" section. The page names the price; this checks it's one the
// section lists and that the total matches what the page showed.
async function catalogCheckout(body, ref, env, url) {
  const priceId = typeof body.price === 'string' && /^price_[A-Za-z0-9]{8,}$/.test(body.price) ? body.price : '';
  if (!priceId) return json({ error: 'Bad request.' }, 400);

  const s = stripe(env);
  let price;
  try {
    price = await s.prices.retrieve(priceId, { expand: ['product'] });
  } catch (err) {
    if (err?.code === 'resource_missing') return json({ error: 'price_changed' }, 409);
    throw err;
  }
  const product = price.product;
  const listed = product && typeof product === 'object' && !product.deleted && showOnSite(product)
    && product.default_price === price.id && catalogItem({ ...product, default_price: price });
  if (!listed) return json({ error: 'price_changed' }, 409);

  const quantity = body.quantity;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > listed.maxQuantity) return json({ error: 'Bad request.' }, 400);
  if (listed.amount !== null && body.expectedTotal !== listed.amount * quantity) {
    return json({ error: 'price_changed', total: listed.amount * quantity }, 409);
  }

  // "Moving × 3 hours"; a product without a unit label counts in items, and one of it is just its name.
  const unit = listed.unit || 'item';
  const what = listed.unit || quantity > 1 ? `${product.name} × ${quantity} ${quantity === 1 ? unit : `${unit}s`}` : product.name;
  const metadata = { booking_ref: ref, service: product.name, paid_from: 'Pay online section' };
  const session = await s.checkout.sessions.create({
    mode: 'payment',
    allowed_payment_method_types: PAYMENT_METHODS,
    wallet_options: NO_LINK,
    line_items: [{ price: price.id, quantity }],
    // No booking form came first, so ask for what the team needs to do the job.
    ...ASK_WHERE,
    client_reference_id: ref,
    metadata,
    payment_intent_data: { description: `${what}, ${ref}`, metadata },
    success_url: `${siteOrigin(url)}/?checkout=success&from=pay&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteOrigin(url)}/?checkout=cancel&from=pay`,
    integration_identifier: INTEGRATION_ID,
  });
  return json({ url: session.url });
}

// "Pay now" in a bin-cleaning booking's confirmation, or the Monticello Special's: in its pop-up, or
// on its card in "Pay online" (from: 'pay'). The price comes from pricing.js, not the page.
async function bookingCheckout(body, ref, env, url) {
  const order = { kind: body.kind, bins: body.bins, binTypes: body.binTypes, code: body.code };
  const priced = quote(order);
  if (!priced.ok) return json({ error: priced.error }, 400);
  // The page sends the total it showed. If the prices here have changed since, stop rather than
  // charge a different amount.
  if (body.expectedTotal !== priced.total) return json({ error: 'price_changed', total: priced.total }, 409);

  const promo = order.kind === 'monticello';
  // The card in "Pay online" has no form before it: Stripe's page asks for the details instead, and
  // the customer comes back to that section.
  const fromPay = body.from === 'pay';
  const back = fromPay ? '&from=pay' : '';
  const service = promo ? 'Monticello Special bin cleaning' : 'Bin cleaning';
  const name = clean(body.name, 100);
  const email = clean(body.email, 254);
  const date = promo ? PROMO.serviceDate : /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : '';
  const bins = `${order.bins} ${order.bins === 1 ? 'bin' : 'bins'}`;

  // Shown with the payment in the Dashboard and the Stripe app, so it can be matched to the
  // booking email (which carries the same reference).
  const metadata = compact({
    booking_ref: ref,
    service,
    paid_from: fromPay ? 'Pay online section' : promo ? 'Monticello Special pop-up' : 'Booking form',
    bins: String(order.bins),
    bin_types: promo ? order.binTypes.join(', ') : '',
    service_date: date,
    customer_name: name,
    customer_phone: clean(body.phone, 40),
    service_address: clean(body.address, 200),
  });

  const session = await stripe(env).checkout.sessions.create({
    mode: 'payment',
    allowed_payment_method_types: PAYMENT_METHODS,
    wallet_options: NO_LINK,
    line_items: priced.lineItems.map((item) => ({
      quantity: item.quantity,
      price_data: { currency: 'usd', unit_amount: item.unitAmount, product_data: { name: item.name } },
    })),
    ...(fromPay ? ASK_WHERE : {}),
    customer_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
    client_reference_id: ref,
    metadata,
    payment_intent_data: {
      description: `${service}: ${bins}, ${ref}${name ? `, ${name}` : ''}`,
      metadata,
    },
    success_url: `${siteOrigin(url)}/?checkout=success${back}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteOrigin(url)}/?checkout=cancel${back}`,
    integration_identifier: INTEGRATION_ID,
  });
  return json({ url: session.url });
}

/* ---- After paying ---- */

async function checkoutSession(url, env) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Online payment is not set up yet.' }, 503);
  const id = url.searchParams.get('id') || '';
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,}$/.test(id)) return json({ error: 'Bad request.' }, 400);

  let session;
  try {
    session = await stripe(env).checkout.sessions.retrieve(id);
  } catch (err) {
    if (err?.code === 'resource_missing') return json({ error: 'Not found.' }, 404);
    throw err;
  }
  // Only what the page needs to word its message: no names, addresses or emails.
  return json({
    status: session.status, // open | complete | expired
    paymentStatus: session.payment_status, // paid | unpaid | no_payment_required
    amountTotal: session.amount_total,
    ref: session.client_reference_id,
  });
}

async function webhook(request, env) {
  const signature = request.headers.get('Stripe-Signature');
  if (!env.STRIPE_WEBHOOK_SECRET || !signature) return json({ error: 'Bad request.' }, 400);

  // The signature covers the exact bytes Stripe sent, so check it against the raw body.
  const payload = await request.text();
  let event;
  try {
    event = await Stripe.webhooks.constructEventAsync(payload, signature, env.STRIPE_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    return json({ error: 'Invalid signature.' }, 400);
  }

  const session = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      // With slower payment methods (bank debits) the session completes before the money
      // arrives, and async_payment_succeeded follows. Only a paid session is a paid booking.
      if (session.payment_status !== 'unpaid') logBooking('booking paid', event, session);
      break;
    case 'checkout.session.async_payment_failed':
      logBooking('booking payment failed', event, session);
      break;
  }
  return json({ received: true });
}

// The paid-booking record: Workers Logs in the Cloudflare dashboard. The team hears about each
// payment from Stripe (its payment emails and app), with the booking details in the metadata.
// To have the site email the team itself, add that here: this is the one place every payment
// passes through. Stripe may send an event more than once, so whatever goes here must cope with that.
function logBooking(msg, event, session) {
  console.log(JSON.stringify({
    msg,
    event: event.id,
    session: session.id,
    ref: session.client_reference_id,
    amountTotal: session.amount_total,
    paymentStatus: session.payment_status,
    livemode: event.livemode,
  }));
}

/* ---- Helpers ---- */

// Where Stripe sends the customer back to: this site over HTTPS, even if the request came in over
// plain HTTP. Local testing (`npm run dev`) keeps its own http://127.0.0.1 address.
function siteOrigin(url) {
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  return local ? url.origin : `https://${url.host}`;
}

function stripe(env) {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
}

async function readJson(request) {
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function clean(value, max) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// Stripe metadata takes strings only, so leave out what's empty.
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value));
}

function json(data, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl },
  });
}
