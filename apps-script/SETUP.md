# Booking backend setup (Google Sheets + Apps Script)

This connects the website's booking form and Andrea's content-upload page to a
real Google Sheet, Google Calendar, and email notifications — all free, using
a Google account (Andrea's, ideally, so the calendar and sheet belong to her).

Takes about 10 minutes. Do this once.

## 1. Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank
   spreadsheet.
2. Name it something like **"Andrea Bencomo — Bookings"**.
3. Keep this tab open — you'll come back to it.

## 2. Add the script

1. In the spreadsheet, click **Extensions → Apps Script**.
2. Delete any placeholder code in the editor.
3. Open [`Code.gs`](./Code.gs) from this folder, copy its entire contents,
   and paste it into the Apps Script editor.
4. Open **Project Settings → Script properties** and create a property named
   `NOTIFY_EMAILS`. Set its value to the business notification addresses,
   separated by commas. This keeps notification addresses out of public code.
5. Leave `CALENDAR_ID` as `"primary"` to use the calendar of whichever Google
   account deploys the script.
6. Click the **Save** icon (or Ctrl/Cmd+S).

## 3. Run the one-time setup

1. In the Apps Script editor toolbar, use the function dropdown (next to the
   Run/Debug buttons) and select **`setupSheets`**.
2. Click **Run**.
3. The first time, Google will ask you to authorize the script — click
   through **Review permissions → (choose your account) → Advanced →
   Go to (project name) → Allow**. This is expected for any script you write
   yourself; it only touches this spreadsheet, your calendar, and your email.
4. You should see a popup: "Setup complete!" — check your spreadsheet, it now
   has **Bookings**, **Content**, and **Dashboard** tabs.

## 4. Deploy as a Web App

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in:
   - Description: `Andrea site backend v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**, authorize again if asked.
5. Copy the **Web app URL** it gives you (ends in `/exec`).

## 5. Connect the website

1. Open `assets/config.js` in this repository.
2. Paste the Web app URL into `APPS_SCRIPT_URL`.
3. Commit and push the website changes. Do not place Google Sheet or Calendar
   links, email addresses, or administrative passwords in the public site.

## 6. Test it

1. Open the live site, scroll to the booking form, select a plan, and submit
   a test request.
2. Check: a new row appears in the **Bookings** sheet, a new event appears on
   the calendar, and an email arrives at the notify address(es).
3. Confirm the notification goes only to the addresses stored in the private
   `NOTIFY_EMAILS` Script Property.

## Updating later

- **Change pricing/plans:** edit `PACKAGES` in `assets/config.js`.
- **Change the script's behavior** (e.g. add SMS, change email wording): edit
  `Code.gs` in the Apps Script editor, then **Deploy → Manage deployments →
  edit (pencil) → New version → Deploy**. The Web App URL stays the same.
- **Who gets notified:** edit the private `NOTIFY_EMAILS` Script Property.

## Limitations (so there are no surprises)

- This is a lightweight, no-cost setup — not a payment processor. It does not
  collect deposits or run payments. Andrea confirms and handles payment
  directly with clients.
- Administrative actions are not accepted from the public website. Manage
  bookings and featured-content rows directly in the private Google Sheet.
- "Who has access: Anyone" on the Web App deployment is required so the
  public site (visitors aren't logged into Google) can reach it — but it
  does NOT expose your Bookings sheet, calendar, or email. It only lets
  people submit a validated booking request or fetch the public "Content"
  list. The script has a honeypot, bot-speed check, strict field validation,
  duplicate protection, and a conservative submission cap.
- If you outgrow this (need SMS reminders, online deposits, staff logins),
  the natural next step is a dedicated booking platform (e.g. Square
  Appointments, Vagaro) — the site's booking form can be swapped to point at
  one of those instead.
