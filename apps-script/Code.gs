/**
 * Andrea Bencomo Hair & Makeup — website backend.
 *
 * Deploy this as a Google Apps Script Web App (see SETUP.md). It:
 *  - Receives booking requests from the website and:
 *      - Logs them as a row in the "Bookings" sheet (your spending/tracking spreadsheet)
 *      - Creates an event on your Google Calendar
 *      - Emails a notification to the addresses in NOTIFY_EMAILS
 *  - Receives new Instagram/TikTok links from admin.html and logs them in the
 *    "Content" sheet, which the website reads back to show a "latest videos" feed.
 *
 * After deploying, put the Web App URL into assets/config.js (APPS_SCRIPT_URL).
 */

// ---- EDIT THESE -------------------------------------------------------

// Must exactly match SHARED_TOKEN in assets/config.js.
const SHARED_TOKEN = "AndreaGlam2026";

// Basic spam protection: caps how many submissions of one action type
// (booking or content) can go through per minute, across all visitors.
const MAX_SUBMISSIONS_PER_MINUTE = 20;

// Who gets an email every time someone submits a booking request.
const NOTIFY_EMAILS = ["js202189@gmail.com", "Andreabencomo0907@icloud.com"];

// Which Google Calendar to add booking events to. "primary" = the calendar
// of whichever Google account this script is deployed under (Andrea's).
const CALENDAR_ID = "primary";

// ------------------------------------------------------------------------

const BOOKINGS_SHEET = "Bookings";
const CONTENT_SHEET = "Content";
const DASHBOARD_SHEET = "Dashboard";

const BOOKINGS_HEADERS = [
  "Timestamp", "Name", "Contact", "Event Date", "Time", "Event Type",
  "Plan", "Price", "Price (numeric est.)", "Services Requested", "Message", "Status",
];
const CONTENT_HEADERS = ["Timestamp", "Platform", "URL", "Caption", "Active"];

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput({ ok: false, error: "Invalid JSON" });
  }

  if (data.token !== SHARED_TOKEN) {
    return jsonOutput({ ok: false, error: "Invalid token" });
  }

  // Honeypot: a hidden field real visitors never see or fill in. Bots that
  // blindly fill every field trip this. Pretend success so they move on.
  if (data.hp) {
    return jsonOutput({ ok: true });
  }

  // Bot-speed check: the form records when it loaded; a real person takes
  // at least ~1.2s to fill it out. Also pretend success here.
  if (data.loadedAt && Date.now() - Number(data.loadedAt) < 1200) {
    return jsonOutput({ ok: true });
  }

  if (isRateLimited(data.action)) {
    return jsonOutput({ ok: false, error: "Too many submissions right now — please try again in a minute." });
  }

  if (data.action === "booking") {
    return handleBooking(data);
  }
  if (data.action === "content") {
    return handleContent(data);
  }
  return jsonOutput({ ok: false, error: "Unknown action" });
}

function doGet(e) {
  if (e.parameter.action === "content") {
    return jsonOutput(getActiveContent());
  }
  return jsonOutput({ ok: true, message: "Andrea Bencomo booking backend is running." });
}

function handleBooking(data) {
  const sheet = ensureSheet(BOOKINGS_SHEET, BOOKINGS_HEADERS);
  const priceNumeric = extractNumber(data.price);

  sheet.appendRow([
    new Date(),
    data.name || "",
    data.contact || "",
    data.date || "",
    data.time || "",
    data.eventType || "",
    data.plan || "",
    data.price || "",
    priceNumeric,
    data.services || "",
    data.message || "",
    "New",
  ]);

  createCalendarEvent(data);
  sendBookingEmail(data);

  return jsonOutput({ ok: true });
}

function handleContent(data) {
  const sheet = ensureSheet(CONTENT_SHEET, CONTENT_HEADERS);
  sheet.appendRow([new Date(), data.platform || "", data.url || "", data.caption || "", true]);
  return jsonOutput({ ok: true });
}

function getActiveContent() {
  const sheet = ensureSheet(CONTENT_SHEET, CONTENT_HEADERS);
  const rows = sheet.getDataRange().getValues();
  rows.shift(); // headers
  return rows
    .filter(r => r[4] === true || r[4] === "TRUE")
    .map(r => ({ timestamp: r[0], platform: r[1], url: r[2], caption: r[3] }))
    .reverse();
}

function createCalendarEvent(data) {
  if (!data.date) return; // no date given, skip calendar
  try {
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID) || CalendarApp.getDefaultCalendar();
    const title = `${data.eventType || "Booking"} — ${data.name || "Client"}`;
    const description = [
      `Plan: ${data.plan || ""} (${data.price || ""})`,
      `Contact: ${data.contact || ""}`,
      `Services: ${data.services || ""}`,
      `Message: ${data.message || ""}`,
    ].join("\n");

    if (data.time) {
      const start = new Date(`${data.date}T${data.time}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour placeholder
      calendar.createEvent(title, start, end, { description });
    } else {
      const day = new Date(`${data.date}T00:00:00`);
      calendar.createAllDayEvent(title, day, { description });
    }
  } catch (err) {
    // Don't fail the whole booking if calendar creation has an issue.
  }
}

function sendBookingEmail(data) {
  if (!NOTIFY_EMAILS || NOTIFY_EMAILS.length === 0) return;
  const subject = `New booking request: ${data.name || "Someone"} (${data.plan || ""})`;
  const body = [
    `New booking request from the website:`,
    ``,
    `Name: ${data.name || ""}`,
    `Contact: ${data.contact || ""}`,
    `Event date: ${data.date || ""}`,
    `Preferred time: ${data.time || ""}`,
    `Event type: ${data.eventType || ""}`,
    `Plan selected: ${data.plan || ""} (${data.price || ""})`,
    `Services requested: ${data.services || ""}`,
    `Message: ${data.message || ""}`,
    ``,
    `This was automatically logged in your Bookings spreadsheet and added to your calendar.`,
  ].join("\n");

  MailApp.sendEmail(NOTIFY_EMAILS.join(","), subject, body);
}

function isRateLimited(action) {
  const cache = CacheService.getScriptCache();
  const bucket = Math.floor(Date.now() / 60000); // one-minute window
  const key = `rl_${action}_${bucket}`;
  const current = Number(cache.get(key) || 0);
  if (current >= MAX_SUBMISSIONS_PER_MINUTE) return true;
  cache.put(key, String(current + 1), 90);
  return false;
}

function extractNumber(priceStr) {
  if (!priceStr) return "";
  const match = String(priceStr).match(/\d+/);
  return match ? Number(match[0]) : "";
}

function ensureSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run this ONCE from the Apps Script editor (select it in the function
 * dropdown, then click Run) after binding this script to a new Google Sheet.
 * It creates the Bookings and Content sheets with headers, plus a Dashboard
 * sheet with running totals so you can track spending at a glance.
 */
function setupSheets() {
  ensureSheet(BOOKINGS_SHEET, BOOKINGS_HEADERS);
  ensureSheet(CONTENT_SHEET, CONTENT_HEADERS);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dash = ss.getSheetByName(DASHBOARD_SHEET);
  if (!dash) {
    dash = ss.insertSheet(DASHBOARD_SHEET);
  }
  dash.clear();
  dash.getRange("A1").setValue("Andrea's Booking Dashboard").setFontWeight("bold").setFontSize(16);

  dash.getRange("A3").setValue("Total Bookings");
  dash.getRange("B3").setFormula(`=COUNTA(${BOOKINGS_SHEET}!B2:B)`);

  dash.getRange("A4").setValue("Total Estimated Revenue ($)");
  dash.getRange("B4").setFormula(`=SUM(${BOOKINGS_SHEET}!I2:I)`);

  dash.getRange("A6").setValue("By Event Type").setFontWeight("bold");
  dash.getRange("A7").setFormula(
    `=QUERY(${BOOKINGS_SHEET}!A:L,"select F, count(F), sum(I) where F is not null and F <> '' group by F label count(F) 'Bookings', sum(I) 'Est. Revenue ($)'",1)`
  );

  dash.getRange("D6").setValue("By Plan").setFontWeight("bold");
  dash.getRange("D7").setFormula(
    `=QUERY(${BOOKINGS_SHEET}!A:L,"select G, count(G), sum(I) where G is not null and G <> '' group by G label count(G) 'Bookings', sum(I) 'Est. Revenue ($)'",1)`
  );

  dash.autoResizeColumns(1, 6);
  Logger.log("Setup complete! Bookings, Content, and Dashboard sheets are ready.");
}
