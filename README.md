# Hafaloha Moving & Junk Removal

Marketing and booking site for **Hafaloha Moving & Junk Removal** — moving, junk removal, and
labor-only (load/unload) help across Orange County, California.

The entire site is one self-contained file: **`index.html`**. Open it in a browser and it works —
no build step, no install, no backend.

## Contact details used throughout the site

| | |
|---|---|
| Phone | (949) 731-4378 — in code as `tel:+19497314378` |
| Text | same number — `sms:+19497314378` |
| Email | hafalohamovers@gmail.com |
| Hours | By appointment (no fixed hours) |
| Area | Orange County, CA (service-only, no street address) |

## How booking works

There is no backend. The booking form validates in the browser, then opens the customer's own
email app via `mailto:` with an invoice-style summary already written out — they just hit send.
The success panel also shows the summary with a working **Copy** button, plus text/call fallbacks
in case no mail app is configured.

To send bookings straight to an inbox automatically instead, replace the `mailto:` handoff in the
form's submit handler with a POST to a form service (Formspree, Web3Forms, etc.). Keep the
existing validation and success UI — only the destination changes.

## Tech

HTML5 + Tailwind CSS via the Play CDN (configured inline in `<head>`) + vanilla JS in a single
IIFE at the bottom of `<body>`. Fonts are Bricolage Grotesque (headings) and Plus Jakarta Sans
(body). The logo, hero truck art, and iOS icon are embedded as base64 data-URIs so the file stays
self-contained; the favicon is an inline SVG of the leaf mark.

No frameworks, no bundler, no npm, no backend.

## ⚑ Placeholders to replace before this is "done"

These are marked in the source with `PLACEHOLDER` comments and `data-` attributes so they're easy
to find:

1. **Hourly rates** — `$129/hr` (moving, 2 movers + truck) and `$99/hr` (labor-only). Both tagged
   `data-editable-rate` in the PRICING section. Replace with the real numbers.
2. **Service details** — the "what's included" bullets on the three service cards are tagged
   `data-confirm="service-details"`. **Confirm these match what the business actually provides**
   (furniture disassembly, sweeping up, what can/can't be hauled).
3. **Pricing terms** — the note under the rate cards (`data-confirm="pricing-terms"`) needs real
   minimums, travel-time policy, and payment terms.
4. **Domain** — canonical URL, Open Graph URLs, and JSON-LD all point at a guessed
   `hafalohamovers.com`. Update to the real domain.
5. **Share image** — `og:image` needs a real absolute URL (a data-URI can't work for Open Graph).
   Upload a 1200×630 image to the domain root.
6. **Service-area cities** — the chip list is a representative sample of Orange County. Add or
   remove to match true coverage.

## What is deliberately NOT here

No reviews, testimonials, star ratings, awards, certifications, license numbers, years in
business, employee counts, or response-time promises — none of that was verified, so none of it
was invented. The reviews section says so plainly and asks for the first real one instead.
Replace it only with genuine reviews.

## Editing

Sections are marked with `<!-- SECTION -->` comments: HEADER/NAV, HERO, SERVICES, WHY, HOW,
PRICING, AREA, BOOKING, REVIEWS, FAQ, FOOTER, then structured data and the JS block.

Design tokens (brand colors, fonts, shadows) live in the `tailwind.config` block in `<head>`.
Teal `#0B8C8C` is the action color — every primary CTA uses it.
