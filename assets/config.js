// ============================================================================
// SITE CONFIG — edit this file to update pricing, links, and backend wiring.
// No other file needs to change for these kinds of updates.
// ============================================================================

// After you deploy the Google Apps Script (see /apps-script/SETUP.md), paste
// the Web App URL it gives you here. Until then, forms show a friendly
// "not connected yet" message instead of failing silently.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyT4ACD43yjJ2-_0aXAhzWtL0UO6h5S4ou-tBfnb0JLkmFwwQ7eBxTx8lHEmf3sResS/exec";

// A shared secret so random bots that find the Apps Script URL can't spam
// your sheet. Change this to any phrase, then paste the SAME phrase into
// the SHARED_TOKEN constant in apps-script/Code.gs.
const SHARED_TOKEN = "AndreaGlam2026";

// Links shown on the admin dashboard (admin.html) for quick access.
// Fill these in once you've created the Google Sheet / Calendar.
const GOOGLE_SHEET_URL = "";     // e.g. https://docs.google.com/spreadsheets/d/xxxxx
const GOOGLE_CALENDAR_URL = "";  // e.g. https://calendar.google.com/calendar/u/0/r

// Social links.
const SOCIAL = {
  instagram: "https://instagram.com/andreaaa.b_",
  instagramHandle: "@andreaaa.b_",
  tiktok: "https://www.tiktok.com/@andrea.bencomo26",
  tiktokHandle: "@andrea.bencomo26",
};

// Selectable service packages. `price` is a display string (kept as
// "starting at" pricing since final quotes depend on hair length, travel,
// and group size) — edit freely.
const PACKAGES = [
  {
    id: "solo-single",
    name: "Hair or Makeup Only",
    price: "$125+",
    tagline: "One service, one person",
    description: "Hair OR makeup for a single person. Great for a quick refresh, photoshoot, or a low-key event.",
  },
  {
    id: "signature-duo",
    name: "Signature Glam Duo",
    price: "$195+",
    tagline: "Hair + makeup, one person",
    description: "Full hair and makeup for one person. Perfect for prom, parties, and special events.",
  },
  {
    id: "quince",
    name: "Quinceañera Package",
    price: "$295+",
    tagline: "The celebration look",
    description: "Complete hair & makeup for the quinceañera, styled to last through the celebration and photos.",
  },
  {
    id: "bridal",
    name: "Bridal Package",
    price: "$420+",
    tagline: "For the bride",
    description: "Bridal hair & makeup for the bride, including a trial-run consultation before the big day.",
  },
  {
    id: "bridal-party",
    name: "Bridal Party Add-On",
    price: "$150+ / person",
    tagline: "Book alongside a Bridal Package",
    description: "Additional hair & makeup for bridesmaids, mothers, or family — booked together with a Bridal Package.",
  },
  {
    id: "custom-group",
    name: "Custom / Large Group",
    price: "Let's talk",
    tagline: "3+ people or multi-day events",
    description: "Weddings with a full court, large quinceañera parties, or multi-day events — tell Andrea the details for a custom quote.",
  },
];
