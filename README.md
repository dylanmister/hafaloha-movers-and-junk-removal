# Hafaloha Moving & Junk Removal

Marketing and booking site for **Hafaloha Moving & Junk Removal** — moving, junk removal,
labor-only (load/unload) help, trash bin cleaning ($35 per bin), and extra hands for personal projects
across Orange County, California.

The page is deliberately short: the hero lists every service with its price, each one a tap away
from the booking form, and the About section tells the name's story — two of the crew are from
Saipan, where hello is *hafa adai*, and one is from Hawaiʻi, where it's *aloha* — together,
**Hafaloha** — and that they're roommates and Orange Coast College (OCC) students. Then a short FAQ and the booking form. The whole site carries an island look
(sunset colors, palms, flowers, waves between sections).

The whole site is one self-contained page, **`public/index.html`**, plus `public/og-image.jpg`
(the picture link previews show) and `public/monticello-aerial.webp` (the community photo in the
Monticello pop-up, kept out of the page so nobody downloads it until the pop-up shows). Open the page in a browser and it works — no build step, no
install. The one exception is online payment, which goes through a small Worker in `src/` (see
"Payments").

## Contact details used throughout the site

| | |
|---|---|
| Website | https://hafaloha.us (www.hafaloha.us works too) |
| Phone | (949) 731-4378 — in code as `tel:+19497314378` |
| Text | same number — `sms:+19497314378` |
| Email | hafalohamovers@gmail.com |
| Hours | By appointment (no fixed hours) |
| Area | Orange County, CA (service-only, no street address) |

## How booking works

Both forms validate in the browser, then send an invoice-style summary to
[Web3Forms](https://web3forms.com), which emails it to the inbox the access key was created with.
That covers the main booking form (moving, junk removal, labor only, bin cleaning, or extra hands;
the fields change to fit the service) and the Monticello pop-up. The key is `WEB3FORMS_KEY` in the
JS. Web3Forms keys are meant to be public, since one can only send to its own inbox. The customer's
email, when they give one, becomes the reply-to address.

The page says "Form submitted!" only after Web3Forms confirms it has the request. If it can't be sent (offline, blocked,
an error, or no answer within 15 seconds), the customer stays on the form with everything still
filled in and a message to try again or call or text. Nothing ever opens their email app.
Submissions arrive from a `notify+…@web3forms.com` address, so check the spam and Promotions
folders if one seems to be missing.

## The Monticello Special

A $20-per-bin community offer (regular price $35) for Monticello residents, for Thursday,
November 19, 2026. It's a pop-up (`<dialog id="promoDialog">`) that opens on a visitor's first page load. Once closed
it stays closed for that browsing session (`sessionStorage`). Anything marked `data-promo-open`
reopens it: the bar above the header, the "Monticello Special" nav entries, and the line under
"How many bins?" on the booking form.

The promo code, which residents get on a flyer, reveals a separate form inside the pop-up that totals bins × $20 as you choose a
number. It also asks which bins to clean (at least one); each kind ticked sets a minimum for the
bin count, so the two can't disagree. All three kinds together are a flat $55 ("$55 for all 3"),
with any further bins at $20 each. It sends the same way as the main form (see above), with the same validation and error handling, and
the email is labeled "Monticello Special". Nothing in the pop-up
touches the main form or the standard $35 price.

The special also has a card of its own in "Pay online" (see "Payments"), first in line, for paying
without the reservation form. It stays locked until the same code is typed in. Then the customer
ticks which bins (Trash, Recycling, Green waste, plus any extra bins of a kind), sees the special's
price next to the regular one struck through, and pays it on Stripe's page. One code opens both:
typed into the pop-up, it unlocks the card as well, and the other way round.

Two limits to know about:

- **The code is checked in the browser**, so anyone who reads the page source can find it. Check
  the address on each reservation; that's the real gate.
- **Reservations arrive by email through Web3Forms.** If one can't be sent, the customer stays on
  the form with a message to try again or call or text.

To change the code or prices: `PROMO_CODE`, `PROMO_BIN_PRICE`, `PROMO_ALL_THREE_PRICE` and `BIN_PRICE` at the top of the JS drive the
code check and the totals, in the pop-up and on the card. `src/pricing.js` holds the same values for online payment; change them
there too (`npm test` fails if the two disagree, and also checks the bin kinds and the 10-bin limit, `PROMO_KINDS` and `PROMO_MAX_BINS`). The card's text is built from these values. The prices in the pop-up's text are written out in its HTML, and the
standard bin price also appears in the hero list, the booking form, the two meta descriptions and
the JSON-LD.

To change the date: it's written out in the pop-up's HTML (the offer panel, the message, the form
heading, the checkbox and How It Works) and as "Nov 19" in the bar above the header. In the JS,
`PROMO_DATE` puts it on the card, and with the subject line in the email. Nothing hides the pop-up automatically
once the date has passed, but online payment for the special stops by itself after November 19
(`PROMO.payableUntil` in `src/pricing.js`), and its card in "Pay online" goes with it.

To end the promotion: delete the pop-up's section, its CSS and its JS block, everything marked
`data-promo-open`, the `<noscript>` line in `<head>`, and `public/monticello-aerial.webp`. The card
in "Pay online" is gone by itself after November 19; to remove its code too, delete the "Pay online:
the Monticello Special" block in the JS and the lines that call it in the catalog code. In Stripe,
archive its two products (Product catalog).

## Payments (Stripe)

Customers pay on **Stripe Checkout**, Stripe's own secure payment page (checkout.stripe.com). The
site asks a small Worker to open a checkout and sends the customer there, and Stripe sends them back
afterwards. Card details never touch this site. Paying online is optional: Zelle, Venmo and cash
still work.

**Ways to pay: Apple Pay and cards, nothing else.** Stripe's page shows an Apple Pay button at the
top, then the card form. The code enforces this: `PAYMENT_METHODS` in `src/worker.js` (Stripe's
`allowed_payment_method_types`) narrows what's turned on in the Dashboard (Settings → Payment
methods) down to cards, and Apple Pay counts as a card payment. So Cash App Pay, Amazon Pay, bank
payments and the rest never show on the site, even when they're on in the Dashboard for invoices.
Each checkout also switches off Link, Stripe's saved-details wallet, which would otherwise bring its
own bank and Klarna options. **Google Pay** is a card wallet as well, which the code can't hold back,
so keep it off in the Dashboard. To offer another method, add it to `PAYMENT_METHODS` and to the
page's "ways to pay" row.

There are two ways in:

- **Pay now**, in the confirmation after a bin-cleaning booking (1–5 bins) or a Monticello
  reservation. The amount comes from `src/pricing.js`, not from Stripe's product catalog, and the
  payment carries the booking's details. "6 or more" bins, moving, junk removal, labor and extra
  hands don't get it.
- **Pay online** (`#pay`, also in the menu), for paying without booking first. Its cards follow one
  pricing-card design: the name (with a badge, if any), the price, a rule, a checklist, then the pay
  button, with − / + to pick how many bins or hours. First comes the Monticello Special's card (see
  "The Monticello Special"; it's priced from `src/pricing.js`), then one card per product in the
  Stripe **product catalog**. Products
  priced as "Customer chooses price" (Junk removal, Extra hands) say "Quoted per job", and the
  customer types in the quoted amount on Stripe's page. Stripe's page also asks where the job is, in
  its address form, which takes the name and phone number too, and which Apple Pay can fill in.
  Stripe labels it "Shipping address", so a note under it says it's the address where we'll do the
  job. It shows on the payment in the Dashboard as the shipping address. Don't swap it for a custom
  field on Stripe's page: any custom field makes Stripe leave Apple Pay off. No booking email goes out
  for these, so you hear about them from Stripe only (its app or the Dashboard).

Above the cards, a "ways to pay" row reads Apple Pay, then Credit or debit card. The area and its
menu links stay hidden until the Worker has the catalog, so the page never shows a dead button.

**The catalog drives the cards.** Add, edit or archive a product in the Dashboard (Product catalog)
and the site follows within 5 minutes. A product shows when it's active and its default price is a
one-off price in USD. Its card's checklist is the product's **Marketing feature list** (its page →
Edit → Marketing feature list, up to 6 shown). Without one, the five services use the site's own
lists (`FEATURES` in the JS, worded from the rest of the page), and any other product shows its
description instead. Four optional metadata keys on a product (its page → Metadata) change the rest:

| Key | Value | Effect |
|---|---|---|
| `website` | `hide` | Keeps it off the site. Both Monticello Special products have this: the special is for code holders, so it has its own card and pop-up. |
| `website_order` | a number, e.g. `1` | Sorts the cards, lowest first. Without it, the oldest product comes first. |
| `website_max_quantity` | 1 to 99 | The most a customer can pick. Without it: 5 bins (6 or more needs a count first), 12 hours, otherwise 1. |
| `website_badge` | short text, e.g. `Most popular` | A badge by the name, and a bolder ring around the card. Up to 24 characters. Without it, no badge. |

The prices written in the page (the hero's list, the booking form, the Monticello pop-up) don't come
from Stripe, and **Pay now** charges from `src/pricing.js`. A price changed in Stripe changes only the
"Pay online" cards, so change the others to match.

How it fits together:

- **`src/worker.js`** is a small Cloudflare Worker that runs only for `/api/` paths; the static
  files are served without it.
  - `GET /api/catalog` gives the page the catalog, cached for 5 minutes, and says whether the
    Monticello Special can still be paid for (its card shows only then).
  - `POST /api/checkout` opens a Checkout Session and returns its address. For a catalog product it
    checks that the price is one the site lists, and that the total matches what the page showed.
    For a booking or the Monticello card it works out the amount itself (`src/pricing.js`) and
    refuses if that differs. Either way, nobody is charged a number they didn't see.
  - `GET /api/checkout/session` tells the page whether a payment went through.
  - `POST /api/stripe/webhook` takes Stripe's events.
- **`src/pricing.js`** holds the prices **Pay now** charges. Change a price here *and* in the page's
  JS; `npm test` fails if they disagree.
- Each payment gets a reference like `HF-7K3Q2X`. For a booking it's in the booking email too, so the
  two match up. In the Dashboard it's in the payment's description and metadata (`booking_ref`),
  next to `paid_from`: Booking form, Monticello Special pop-up, or Pay online section.
- After paying, Stripe sends the customer back to the site (`/?checkout=success&…`). The page asks
  the Worker what happened and says "Payment received!" only once Stripe confirms the payment.
- **The webhook** is the dependable record of a payment, since a customer can pay and never make it
  back to the site. For now it writes each one to the Worker's logs (Cloudflare dashboard → Workers
  → hafaloha → Logs). If the site should email the team, that goes in `logBooking` in
  `src/worker.js`.
- **Pay now** shows only when the Worker says Stripe's key is set. Publishing before the key is in
  is safe: nobody sees a button that doesn't work.

**Keys.** The repo is public, so a key never goes in a file that's committed, or in the page.

- `STRIPE_SECRET_KEY` is a *restricted* key (`rk_…`). Create it under Developers → API keys →
  Create restricted key, with these permissions and everything else left at None:
  - Checkout Sessions: Write
  - Products: Read
  - Prices: Read
- `STRIPE_WEBHOOK_SECRET` is the signing secret (`whsec_…`) of the webhook endpoint.
- Online they're Worker secrets: `npx wrangler secret put STRIPE_SECRET_KEY` (and the same for the
  other) asks for the value and stores it encrypted at Cloudflare. For local testing they go in
  `.dev.vars`, which git ignores.

**Testing locally** (test mode, so nothing is charged):

1. `npm install` once. Put a test-mode key in `.dev.vars` as `STRIPE_SECRET_KEY=…`, and
   `STRIPE_WEBHOOK_SECRET=…` from `stripe listen --print-secret`. Test mode has its own product
   catalog, so give it the same products, with the same `website` metadata.
2. `npm run dev`, then open http://127.0.0.1:8787. The script's flag keeps Stripe's return links
   pointed at your computer instead of hafaloha.us.
3. In a second terminal: `stripe listen --forward-to http://127.0.0.1:8787/api/stripe/webhook`.
4. Pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.
   `4000 0025 0000 3155` asks for a bank check (3D Secure) first, and `4000 0000 0000 9995` is
   declined. The Apple Pay button shows in some desktop browsers too: it pays by scanning a code
   with an iPhone.

Until November 18, 2026, `.dev.vars` holds the key of a temporary Stripe test sandbox with copies of
the live products.

**Going live**, in this order:

1. `npx wrangler deploy`. Nothing changes for customers yet: without the key there's no "Pay
   online" and no **Pay now**.
2. Make the restricted live key (above), then `npx wrangler secret put STRIPE_SECRET_KEY`. Within
   seconds, "Pay online" and **Pay now** appear.
3. Developers → Webhooks → Add endpoint `https://hafaloha.us/api/stripe/webhook`, with the events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded` and
   `checkout.session.async_payment_failed`. Copy its signing secret, then
   `npx wrangler secret put STRIPE_WEBHOOK_SECRET`.
4. Make one small real payment from the site and refund it from the Dashboard.

Refunds are made from the payment in the Dashboard or the Stripe app.

## Hosting

Live at **https://hafaloha.us** on Cloudflare Workers, which serves `public/` as static files and
runs `src/worker.js` for the payment paths. It's free for a business site, with the domain, DNS and
HTTPS certificates all in the same Cloudflare account. `wrangler.jsonc` holds the setup, including
both hostnames (Cloudflare creates their DNS records and certificates on deploy).

To publish a change, run `npx wrangler deploy` from the project folder (the first time on a
computer, `npm install` and `npx wrangler login`). Only `public/` and the bundled worker are
uploaded, so the README, `.dev.vars` and everything else in the project folder stay offline.

Wrangler runs through `npx` from its cache on purpose. Installed into this folder, its Windows
launcher breaks on the `&` in the folder's name, and `npx wrangler` stops working.

## Tech

HTML5 + Tailwind CSS via the Play CDN (configured inline in `<head>`) + vanilla JS in a single
IIFE at the bottom of `<body>`. Fonts are Bricolage Grotesque (headings), Plus Jakarta Sans
(body), Caveat (the handwritten greetings like "Hafa adai!"), and the system Georgia for the
dictionary-style italics in the About section. The logo, truck art, team photos and iOS icon are embedded
as base64 data-URIs so the file stays self-contained; the favicon is an inline SVG of the leaf mark.

The island artwork (palm frond, palm tree, hibiscus, plumeria, latte stone, wheelie bin, sparkle)
is an inline SVG sprite right after `<body>`. Reuse a piece with
`<svg viewBox="0 0 W H"><use href="#i-name"/></svg>` — the viewBox must start at `0 0` and use
the symbol's own width/height, or the art gets clipped. Color comes from `currentColor`; the
`--eye`, `--stamen` and `--wheel` CSS variables tint the details.

No frameworks and no build step for the page. The only server code is the payment Worker in
`src/`, whose one dependency is Stripe's library (`stripe`), bundled by Wrangler on deploy.

## ⚑ Placeholders to replace before this is "done"

These are marked in the source with `PLACEHOLDER` comments and `data-` attributes so they're easy
to find:

1. **Hourly rates** — `$129/hr` (moving, 2 movers + truck) and `$99/hr` (labor-only). Both tagged
   `data-editable-rate` in the hero's services & prices list. Replace with the real numbers.
2. **Pricing terms** — the note under the services & prices list (`data-confirm="pricing-terms"`)
   needs real minimums, travel-time policy, and payment terms.
3. **Bin cleaning details** — the $35-per-bin price is real; the line under it ("Trash,
   recycling & green waste", `data-confirm="bin-details"`) is not, and the Monticello form offers the
   same three as choices. So do the "Pay online" cards: the bin cleaning card's checklist
   (`FEATURES.bins` in the JS) and the Monticello card's choices (`PROMO_KINDS`). **Confirm** which
   bins you take.
4. **Online payment** — built and tested against a Stripe test sandbox (see "Payments"), but it
   only switches on once Stripe's live key is set. Until then, the pop-up's "Website Payment" has no
   button behind it.
5. **Extra hands rate** — the hero's list says "Get a quote" (`data-confirm="extra-hands-rate"`)
   because there's no rate for this service yet.

## What is deliberately NOT here

No reviews, testimonials, star ratings, awards, certifications, license numbers, years in
business, employee counts, or response-time promises — none of that was verified, so none of it
was invented. There's no reviews section until there are genuine reviews to put in it.

## Editing

Sections are marked with `<!-- SECTION -->` comments: ICON SPRITE, HEADER/NAV, HERO (with the
services & prices list), ABOUT (ending with MEET THE TEAM), FAQ, BOOKING, FOOTER, then the sticky
mobile bar, the MONTICELLO SPECIAL POP-UP, structured data and the JS block. Between sections sits a `.wave` divider: its background is the section above
and its path color is the section below, so change both if you recolor a section.

Keep it short: each thing is said in one place. Standard prices live in the hero's list (the bin
price also shows under "How many bins?" on the booking form), the Monticello price in its pop-up,
the satisfaction guarantee in About, the service area in the FAQ. If you add an FAQ, add it to the
JSON-LD too, word for word.

The team photos (all 14 from the team folder: five of Dylan, four of Kaimana, five of Casey) are
shown whole: scaled down to 420px tall, saved as WebP, never cropped, with the originals' location
data removed. On phones each person's row swipes sideways; wider screens wrap it. Keep them as
plain `<img>` at a set height with `width: auto` — not `object-cover` in a fixed box — so a
swapped-in photo can't get cropped either.

Design tokens (brand colors, fonts, shadows) live in the `tailwind.config` block in `<head>`.
Teal `#0B8C8C` is the action color — every primary CTA uses it, except in the Monticello pop-up, whose
buttons use the darker `teal-dark` so their white text reaches 4.5:1 contrast. The island accents (`coral`,
`sun`, `lagoon`, `hibiscus`) are for decoration and big type; for small text use `coral-dark`,
which keeps 4.5:1 contrast on white and sand.

The desktop nav appears at the `lg` breakpoint (1024px); below that the menu button takes over.
