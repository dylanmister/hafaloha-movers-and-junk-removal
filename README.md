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
install, no backend.

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

There is no backend. The booking form (moving, junk removal, labor only, bin cleaning, or extra hands — the
fields change to fit the service) validates in the browser, then opens the customer's own
email app via `mailto:` with an invoice-style summary already written out — they just hit send.
The success panel also shows the summary with a working **Copy** button, plus text/call fallbacks
in case no mail app is configured.

To send bookings straight to an inbox automatically instead, replace the `mailto:` handoff in the
form's submit handler with a POST to a form service (Formspree, Web3Forms, etc.). Keep the
existing validation and success UI — only the destination changes.

## The Monticello Special

A $20-per-bin community offer (regular price $35) for Monticello residents, for Thursday,
November 19, 2026. It's a pop-up (`<dialog id="promoDialog">`) that opens on a visitor's first page load. Once closed
it stays closed for that browsing session (`sessionStorage`). Anything marked `data-promo-open`
reopens it: the bar above the header, the "Monticello Special" nav entries, and the line under
"How many bins?" on the booking form.

The promo code, which residents get on a flyer, reveals a separate form inside the pop-up that totals bins × $20 as you choose a
number. It also asks which bins to clean (at least one); each kind ticked sets a minimum for the
bin count, so the two can't disagree. All three kinds together are a flat $55 ("$55 for all 3"),
with any further bins at $20 each. It uses the same `mailto:` hand-off as the main form, with the same validation, summary
and Copy/text/call fallbacks, and the email is labeled "Monticello Special". Nothing in the pop-up
touches the main form or the standard $35 price.

Two limits to know about:

- **The code is checked in the browser**, so anyone who reads the page source can find it. Check
  the address on each reservation; that's the real gate.
- **Nothing is reserved until the customer hits send** in their email app, and the page can't tell
  whether they did, so the last step says exactly that instead of showing a confirmation. To get
  real confirmations, replace the hand-off with a POST as described above, then update the wording
  in `#promoStepSend`.

To change the code or prices: `PROMO_CODE`, `PROMO_BIN_PRICE`, `PROMO_ALL_THREE_PRICE` and `BIN_PRICE` in the JS drive the
code check and the totals. The prices in the text are written out in the pop-up's HTML, and the
standard bin price also appears in the hero list, the booking form, the two meta descriptions and
the JSON-LD.

To change the date: it's written out in the pop-up's HTML (the offer panel, the message, the form
heading, the checkbox and How It Works) and as "Nov 19" in the bar above the header. In the JS,
`PROMO_DATE` and the subject line put it in the email. Nothing hides the promotion automatically
once the date has passed.

To end the promotion: delete the pop-up's section, its CSS and its JS block, everything marked
`data-promo-open`, the `<noscript>` line in `<head>`, and `public/monticello-aerial.webp`.

## Hosting

Live at **https://hafaloha.us** on Cloudflare Workers, which serves `public/` as static files —
free for a business site, with the domain, DNS and HTTPS certificates all in the same Cloudflare
account. `wrangler.jsonc` holds the setup, including both hostnames (Cloudflare creates their DNS
records and certificates on deploy).

To publish a change, run `npx wrangler deploy` from the project folder (the first time on a
computer, `npx wrangler login`). Only `public/` is uploaded, so the README and anything else in
the project folder stay offline.

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

No frameworks, no bundler, no npm, no backend.

## ⚑ Placeholders to replace before this is "done"

These are marked in the source with `PLACEHOLDER` comments and `data-` attributes so they're easy
to find:

1. **Hourly rates** — `$129/hr` (moving, 2 movers + truck) and `$99/hr` (labor-only). Both tagged
   `data-editable-rate` in the hero's services & prices list. Replace with the real numbers.
2. **Pricing terms** — the note under the services & prices list (`data-confirm="pricing-terms"`)
   needs real minimums, travel-time policy, and payment terms.
3. **Bin cleaning details** — the $35-per-bin price is real; the line under it ("Trash,
   recycling & green waste", `data-confirm="bin-details"`) is not, and the Monticello form offers the
   same three as choices. **Confirm** which bins you take.
4. **Website Payment** — the Monticello pop-up lists it as a payment method
   (`data-confirm="website-payment"`), but the site can't take payments online yet. Add a payment
   link or remove the option.
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
