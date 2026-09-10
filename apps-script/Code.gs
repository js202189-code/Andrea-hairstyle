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

// Scheduling rules:
//  - No bookings at all on Sundays, for any plan.
//  - The solo "Hair or Makeup Only" plan can have multiple bookings per
//    day, but needs at least SOLO_BUFFER_HOURS between them.
//  - Every other plan (Signature Duo, Quinceañera, Bridal, Bridal Party
//    Add-On, Custom/Large Group) is limited to ONE such booking per day,
//    regardless of time — these are treated as taking up the whole day.
// SOLO_PLAN_NAME must exactly match that package's `name` in
// assets/config.js (PACKAGES).
const SOLO_PLAN_NAME = "Hair or Makeup Only";
const SOLO_BUFFER_HOURS = 3;

// Google Drive folder inspiration photos get saved into (created
// automatically the first time someone attaches a photo).
const INSPIRATION_FOLDER_NAME = "Andrea Site - Inspiration Photos";
const MAX_INSPIRATION_PHOTOS = 3;

// Shown in the client confirmation email. Keep in sync with the contact
// info / SOCIAL handles in assets/config.js and index.html.
const BUSINESS_PHONE = "(915) 251-9682";
const BUSINESS_INSTAGRAM_HANDLE = "@andreaaa.b_";
const BUSINESS_TIKTOK_HANDLE = "@andrea.bencomo26";

// ------------------------------------------------------------------------

const BOOKINGS_SHEET = "Bookings";
const CONTENT_SHEET = "Content";
const DASHBOARD_SHEET = "Dashboard";

const BOOKINGS_HEADERS = [
  "Timestamp", "Name", "Contact", "Event Date", "Time", "Event Type",
  "Plan", "Price", "Price (numeric est.)", "Services Requested", "Message", "Status",
  "Inspiration Photos",
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
  let result;
  if (e.parameter.action === "content") {
    result = getActiveContent();
  } else if (e.parameter.action === "checkAvailability") {
    const check = checkBookingRules(e.parameter.date, e.parameter.time, e.parameter.plan);
    result = { available: !check.blocked, reason: check.reason || "" };
  } else {
    result = { ok: true, message: "Andrea Bencomo booking backend is running." };
  }
  // Browsers reading a Web App's GET response cross-origin (real fetch,
  // not no-cors) is unreliable in practice. JSONP sidesteps that entirely
  // by returning JS that calls back into a <script> tag instead of JSON
  // read via fetch — used whenever the caller passes ?callback=...
  return jsonOutput(result, e.parameter.callback);
}

function handleBooking(data) {
  const sheet = ensureSheet(BOOKINGS_SHEET, BOOKINGS_HEADERS);
  const priceNumeric = extractNumber(data.price);
  const check = checkBookingRules(data.date, data.time, data.plan, sheet);
  const conflict = check.blocked;
  const photoLinks = saveInspirationPhotos(data.photos, data.name);

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
    conflict ? `CONFLICT — ${check.reason}` : "New",
    photoLinks.join("\n"),
  ]);

  createCalendarEvent(data, conflict);
  sendBookingEmail(data, conflict, check.reason, photoLinks);
  sendClientConfirmationEmail(data);

  return jsonOutput({ ok: true, conflict, reason: check.reason || "" });
}

/**
 * Decodes any base64 inspiration photos the client attached and saves
 * them into a shared Drive folder, returning their view URLs. Never
 * throws — a photo-saving problem shouldn't block the booking itself.
 */
function saveInspirationPhotos(photos, clientName) {
  if (!Array.isArray(photos) || photos.length === 0) return [];
  try {
    const folder = getInspirationFolder();
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HHmmss");
    return photos.slice(0, MAX_INSPIRATION_PHOTOS).map((photo, i) => {
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(photo && photo.dataUrl || "");
      if (!match) return null;
      const bytes = Utilities.base64Decode(match[2]);
      const blob = Utilities.newBlob(bytes, match[1], `${clientName || "client"}-${stamp}-${i + 1}`);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return file.getUrl();
    }).filter(Boolean);
  } catch (err) {
    Logger.log("saveInspirationPhotos failed: " + err);
    return [];
  }
}

function getInspirationFolder() {
  const existing = DriveApp.getFoldersByName(INSPIRATION_FOLDER_NAME);
  return existing.hasNext() ? existing.next() : DriveApp.createFolder(INSPIRATION_FOLDER_NAME);
}

/**
 * Applies the scheduling rules described above. Used both for the
 * website's live availability check (doGet ?action=checkAvailability)
 * and as a server-side safety net at submit time, in case two people
 * submit around the same moment. Returns { blocked, reason }.
 */
function checkBookingRules(dateStr, timeStr, planName, sheet) {
  if (!dateStr) return { blocked: false };

  const requestedDate = new Date(`${dateStr}T00:00:00`);
  if (isNaN(requestedDate.getTime())) return { blocked: false };

  if (requestedDate.getDay() === 0) {
    return { blocked: true, reason: "Sundays are not available for booking. Please choose a different day." };
  }

  const bookingsSheet = sheet || ensureSheet(BOOKINGS_SHEET, BOOKINGS_HEADERS);
  const rows = bookingsSheet.getDataRange().getValues();
  rows.shift(); // headers

  const isSolo = planName === SOLO_PLAN_NAME;

  if (isSolo) {
    if (!timeStr) return { blocked: false }; // can't check the buffer without a time
    const requested = new Date(`${dateStr}T${timeStr}:00`);
    if (isNaN(requested.getTime())) return { blocked: false };
    const bufferMs = SOLO_BUFFER_HOURS * 60 * 60 * 1000;

    const tooClose = rows.some(row => {
      const rowDate = normalizeDateStr(row[3]), rowTime = normalizeTimeStr(row[4]), rowPlan = String(row[6] || "");
      if (rowPlan !== SOLO_PLAN_NAME || !rowDate || !rowTime) return false;
      const existing = new Date(`${rowDate}T${rowTime}:00`);
      if (isNaN(existing.getTime())) return false;
      return Math.abs(existing.getTime() - requested.getTime()) < bufferMs;
    });

    if (tooClose) {
      return {
        blocked: true,
        reason: `That time is too close to another Hair or Makeup Only appointment. Andrea needs at least ${SOLO_BUFFER_HOURS} hours between these — please choose a different time.`,
      };
    }
    return { blocked: false };
  }

  // Every other plan: only one such booking allowed per day.
  const dayTaken = rows.some(row => {
    const rowDate = normalizeDateStr(row[3]), rowPlan = String(row[6] || "");
    return rowDate === dateStr && rowPlan && rowPlan !== SOLO_PLAN_NAME;
  });

  if (dayTaken) {
    return {
      blocked: true,
      reason: "That date is already booked for a full appointment. Only one Quinceañera/Bridal/Party-size booking is available per day — please choose a different date.",
    };
  }
  return { blocked: false };
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

function createCalendarEvent(data, conflict) {
  if (!data.date) return; // no date given, skip calendar
  try {
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID) || CalendarApp.getDefaultCalendar();
    const title = `${conflict ? "⚠️ NEEDS ATTENTION — " : ""}${data.eventType || "Booking"} — ${data.name || "Client"}`;
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

function sendBookingEmail(data, conflict, reason, photoLinks) {
  if (!NOTIFY_EMAILS || NOTIFY_EMAILS.length === 0) return;
  const subject = `${conflict ? "⚠️ NEEDS ATTENTION — " : ""}New booking request: ${data.name || "Someone"} (${data.plan || ""})`;
  const body = [
    conflict
      ? `⚠️ ${reason || "This booking conflicts with the scheduling rules"} — please contact the client to reschedule or confirm.\n`
      : ``,
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
    photoLinks && photoLinks.length
      ? `\nInspiration photos:\n${photoLinks.join("\n")}`
      : ``,
    ``,
    `This was automatically logged in your Bookings spreadsheet and added to your calendar.`,
  ].join("\n");

  try {
    MailApp.sendEmail(NOTIFY_EMAILS.join(","), subject, body);
  } catch (err) {
    // Don't fail the whole booking if the email step has an issue — the
    // sheet row and calendar event above already succeeded regardless.
    Logger.log("sendBookingEmail failed: " + err);
  }
}

/**
 * Sends the client a friendly "we got your request" email — only when
 * their "contact" field looks like an email address (it's free text, so
 * it's often a phone number instead). Never throws — a failure here
 * shouldn't affect the booking itself, which is already saved by now.
 */
function sendClientConfirmationEmail(data) {
  const contact = String(data.contact || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return;

  try {
    const subject = "You're on the books! Your request with Andrea Bencomo Hair & Makeup";
    const body = [
      `Hi ${data.name || "there"},`,
      ``,
      `Thanks for reaching out! Here's what was received for your booking request:`,
      ``,
      `Event date: ${data.date || ""}`,
      `Preferred time: ${data.time || ""}`,
      `Event type: ${data.eventType || ""}`,
      `Plan selected: ${data.plan || ""} (${data.price || ""})`,
      ``,
      `Andrea will follow up shortly to confirm your appointment and go over next steps, including deposit details.`,
      ``,
      `Questions in the meantime? Reach out at ${BUSINESS_PHONE} or on Instagram/TikTok (${BUSINESS_INSTAGRAM_HANDLE} / ${BUSINESS_TIKTOK_HANDLE}).`,
      ``,
      `Talk soon!`,
      `Andrea Bencomo Hair & Makeup`,
    ].join("\n");
    MailApp.sendEmail(contact, subject, body);
  } catch (err) {
    Logger.log("sendClientConfirmationEmail failed: " + err);
  }
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

// Sheet cells can end up holding either the plain "YYYY-MM-DD"/"HH:MM"
// text we write, or (depending on how a row was entered) a real Date
// object — these normalize either form back to a comparable string so
// checkBookingRules() never silently mismatches.
function normalizeDateStr(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value || "").trim();
}

function normalizeTimeStr(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm");
  }
  return String(value || "").trim();
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
  if (name === BOOKINGS_SHEET) {
    // Keep Event Date (D) and Time (E) as plain text so Sheets never
    // auto-converts them — checkBookingRules() depends on reading back
    // the exact "YYYY-MM-DD"/"HH:MM" strings that were written. Applied
    // every call (not just on creation) so it also fixes a sheet made
    // earlier.
    sheet.getRange("D:E").setNumberFormat("@");
  }
  return sheet;
}

function jsonOutput(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(`${callback}(${json})`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
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
  getInspirationFolder(); // creates the Drive folder + grants Drive access now

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
    `=QUERY(${BOOKINGS_SHEET}!A:M,"select F, count(F), sum(I) where F is not null and F <> '' group by F label count(F) 'Bookings', sum(I) 'Est. Revenue ($)'",1)`
  );

  dash.getRange("D6").setValue("By Plan").setFontWeight("bold");
  dash.getRange("D7").setFormula(
    `=QUERY(${BOOKINGS_SHEET}!A:M,"select G, count(G), sum(I) where G is not null and G <> '' group by G label count(G) 'Bookings', sum(I) 'Est. Revenue ($)'",1)`
  );

  dash.autoResizeColumns(1, 6);
  Logger.log("Setup complete! Bookings, Content, and Dashboard sheets are ready.");
}
