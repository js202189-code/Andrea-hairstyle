# Andrea Bencomo — Hair & Makeup

Mobile hair and makeup services in El Paso, Texas for quinceañeras, brides,
proms, weddings, parties and photoshoots. Andrea comes to you.

This repo is the full website plus a booking/calendar/tracking system built
around it.

## What's here

- **`index.html`** — the public website: services, portfolio, selectable
  pricing packages, a booking form, and a "fresh off Instagram/TikTok"
  section.
- **`admin.html`** — a private page for Andrea to add new Instagram/TikTok
  video links (shown on the homepage automatically) and quick-jump to her
  bookings spreadsheet and calendar. Locked behind a shared phrase (see
  `apps-script/SETUP.md` — not real security, just keeps casual visitors out).
- **`assets/config.js`** — the one file to edit for day-to-day updates:
  pricing/packages, the backend connection URL, and social/quick links.
- **`assets/site.js`** — booking form + content feed logic.
- **`assets/images/`** — portfolio and hero photos. Replace a file with a new
  photo of the same name to swap it out, or add new ones and reference them
  in `index.html`.
- **`apps-script/`** — the Google Apps Script backend (free) that turns
  booking form submissions into: a row in a Google Sheet, a Google Calendar
  event, and an email notification. **See `apps-script/SETUP.md`** for the
  one-time setup — the site works before this is done, it just shows a
  friendly "not connected yet" message on the booking form until then.

## Making changes / previewing before going live

1. Edit files as needed (pricing in `assets/config.js`, photos in
   `assets/images/`, copy in `index.html`).
2. Open `index.html` directly in a browser to preview locally, or push your
   branch and ask for a hosted preview link before merging to `main`.
3. Once you're happy, merge to `main`.

## Going live (GitHub Pages)

1. In this repo on GitHub: **Settings → Pages**.
2. Under "Build and deployment", set **Source: Deploy from a branch**.
3. Branch: **main**, folder: **/ (root)**. Save.
4. GitHub will give you a live URL shortly, usually
   `https://<owner>.github.io/andrea-hairstyle/`.
5. Optional: add a custom domain (e.g. `andreabencomo.com`) under the same
   Pages settings once you own one.

## Booking system, calendar & spending tracker

See **[`apps-script/SETUP.md`](apps-script/SETUP.md)** for the full one-time
setup (about 10 minutes). Once done:

- Every booking request becomes a row in a **Google Sheet** — name, contact,
  event date, plan/package selected, price, and status. A **Dashboard** tab
  totals bookings and estimated revenue automatically, so this doubles as
  your spending/earnings tracker.
- Andrea gets an **email** the moment someone submits a request.
- The event is added to Andrea's **Google Calendar** automatically, so she
  can manage her schedule from her phone like any other event.

## Social

- Instagram: [@andreaaa.b_](https://instagram.com/andreaaa.b_)
- TikTok: [@andrea.bencomo26](https://www.tiktok.com/@andrea.bencomo26)
