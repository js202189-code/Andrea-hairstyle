// ============================================================================
// SITE CONFIG — edit this file to update pricing, links, and backend wiring.
// No other file needs to change for these kinds of updates.
// ============================================================================

// After you deploy the Google Apps Script (see /apps-script/SETUP.md), paste
// the Web App URL it gives you here. Until then, forms show a friendly
// "not connected yet" message instead of failing silently.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyT4ACD43yjJ2-_0aXAhzWtL0UO6h5S4ou-tBfnb0JLkmFwwQ7eBxTx8lHEmf3sResS/exec";

// Scheduling rules (must match apps-script/Code.gs):
//  - No bookings on Sundays, for any plan.
//  - Single Hair Only/Makeup Only choices use the legacy SOLO_PLAN_NAME
//    booking value and can have multiple bookings per day, but need at
//    least SOLO_BUFFER_HOURS between them.
//  - Every other plan is limited to one booking per day.
const SOLO_PLAN_NAME = "Hair or Makeup Only";
const SOLO_BUFFER_HOURS = 3;

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
    id: "hair-only",
    name: "Hair Only",
    bookingPlan: SOLO_PLAN_NAME,
    price: "$145+",
    tagline: "One service, one person",
    description: "Hairstyling for one person. Great for a photoshoot or special event.",
  },
  {
    id: "makeup-only",
    name: "Makeup Only",
    bookingPlan: SOLO_PLAN_NAME,
    price: "$125+",
    tagline: "One service, one person",
    description: "Makeup for one person. Great for a photoshoot or special event.",
  },
  {
    id: "signature-duo",
    name: "Signature Glam Duo",
    price: "$195+",
    tagline: "Hair + makeup, one person",
    description: "Full hair and makeup for one person. Perfect for prom, parties, and special events.",
  },
  {
    id: "quince-signature",
    name: "Signature Quinceañera Experience",
    price: "$425+",
    tagline: "Includes a hair & makeup trial",
    description: "The full quinceañera experience: professional hair & makeup techniques, lashes, a curated touch-up kit, and a personalized trial one month before your big day. Extensions application +$20.",
  },
  {
    id: "quince-basic",
    name: "Basic Quinceañera Package",
    price: "$285+",
    tagline: "Budget-friendly, no trial",
    description: "Hair & makeup using a blend of modern and timeless techniques, high-quality products, and a look designed to last 8+ hours. Includes a complimentary touch-up kit and a pre-event consultation via message. Does not include a hair & makeup trial.",
  },
  {
    id: "photo-session",
    name: "Pre-Quinceañera Photo Session",
    price: "$285+",
    tagline: "A separate day before the big day",
    description: "Customized hairstyle and long-lasting makeup for your pre-quinceañera photo session, plus false lash application and a consultation to coordinate the look with your dress and style. Booked as a separate date/reservation from the quinceañera day.",
  },
  {
    id: "bridal",
    name: "Luxury Bridal",
    bookingPlan: "Bridal Package",
    price: "$420+",
    tagline: "For the bride",
    description: "Bridal hair & makeup for the bride, including a trial-run consultation before the big day.",
  },
  {
    id: "bridal-basic",
    name: "Basic Bridal",
    price: "$285+",
    tagline: "Budget-friendly, no trial",
    description: "Bridal hair & makeup using a blend of modern and timeless techniques, high-quality products, and a look designed to last 8+ hours. Includes a complimentary touch-up kit and a pre-event consultation via message. Does not include a hair & makeup trial.",
  },
  {
    id: "bridal-party",
    name: "Bridal Party Add-On",
    price: "$195+ / person",
    tagline: "Book alongside a Bridal Package",
    description: "Additional hair & makeup for bridesmaids, mothers, or family — booked together with a Bridal Package.",
    quantity: true,
    quantityMin: 1,
    quantityLabel: "Number of people being added",
  },
  {
    id: "custom-group",
    name: "Custom / Large Group",
    price: "Let's talk",
    tagline: "3+ people or multi-day events",
    description: "Weddings with a full court, large quinceañera parties, or multi-day events — tell Andrea the details for a custom quote.",
    quantity: true,
    quantityMin: 3,
    quantityLabel: "Number of people in this package",
  },
];
