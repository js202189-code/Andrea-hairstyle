// Shared front-end logic for the public site (packages, booking form, content feed).
// Relies on constants defined in config.js, loaded before this file.

const PAGE_LOADED_AT = Date.now();

function backendReady() {
  return typeof APPS_SCRIPT_URL === "string" && APPS_SCRIPT_URL.trim().length > 0;
}

// ---- Pricing / package cards -----------------------------------------------

function renderPackages() {
  const grid = document.getElementById("packages-grid");
  const select = document.getElementById("plan-select");
  if (!grid) return;

  grid.innerHTML = PACKAGES.map((pkg, i) => `
    <label class="pkg-card" for="pkg-${pkg.id}">
      <input type="radio" name="pkg-radio" id="pkg-${pkg.id}" value="${pkg.id}" ${i === 0 ? "checked" : ""}>
      <div class="pkg-name">${pkg.name}</div>
      <div class="pkg-price">${pkg.price}</div>
      <div class="pkg-tagline">${pkg.tagline}</div>
      <p>${pkg.description}</p>
    </label>
  `).join("");

  if (select) {
    select.innerHTML = PACKAGES.map(pkg => `<option value="${pkg.id}">${pkg.name} — ${pkg.price}</option>`).join("");
  }

  grid.querySelectorAll('input[name="pkg-radio"]').forEach(input => {
    input.addEventListener("change", () => {
      grid.querySelectorAll(".pkg-card").forEach(card => card.classList.remove("selected"));
      input.closest(".pkg-card").classList.add("selected");
      if (select) select.value = input.value;
    });
  });
  const firstCard = grid.querySelector(".pkg-card");
  if (firstCard) firstCard.classList.add("selected");

  if (select) {
    select.addEventListener("change", () => {
      const radio = document.getElementById(`pkg-${select.value}`);
      if (radio) radio.checked = true;
      grid.querySelectorAll(".pkg-card").forEach(card => card.classList.remove("selected"));
      const card = grid.querySelector(`#pkg-${select.value}`)?.closest(".pkg-card");
      if (card) card.classList.add("selected");
    });
  }
}

function selectPackageById(id) {
  const radio = document.getElementById(`pkg-${id}`);
  if (radio) {
    radio.checked = true;
    radio.dispatchEvent(new Event("change"));
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth" });
  }
}

// ---- Booking form ------------------------------------------------------

function initBookingForm() {
  const form = document.getElementById("booking-form");
  if (!form) return;
  const statusEl = document.getElementById("booking-status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!backendReady()) {
      statusEl.textContent = "This form isn't connected to Andrea's booking system yet. For now, please reach out on Instagram or TikTok directly — see the links below.";
      statusEl.className = "form-status form-status-warn";
      return;
    }

    const fd = new FormData(form);
    const pkg = PACKAGES.find(p => p.id === fd.get("plan"));
    const payload = {
      action: "booking",
      token: SHARED_TOKEN,
      name: fd.get("name"),
      contact: fd.get("contact"),
      date: fd.get("date"),
      time: fd.get("time"),
      eventType: fd.get("event"),
      plan: pkg ? pkg.name : fd.get("plan"),
      price: pkg ? pkg.price : "",
      services: fd.get("services"),
      message: fd.get("message"),
      submittedAt: new Date().toISOString(),
      hp: fd.get("company"),
      loadedAt: PAGE_LOADED_AT,
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    try {
      // Apps Script + browser fetch requires "text/plain" + no-cors to avoid
      // a CORS preflight that Apps Script can't answer. We can't read the
      // response back, so we treat a resolved fetch as success.
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      statusEl.textContent = "Thanks! Your booking request was sent to Andrea — she'll confirm with you shortly.";
      statusEl.className = "form-status form-status-ok";
      form.reset();
      renderPackages();
    } catch (err) {
      statusEl.textContent = "Something went wrong sending your request. Please try again or reach out on Instagram/TikTok.";
      statusEl.className = "form-status form-status-warn";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Booking Request";
    }
  });
}

// ---- Featured Instagram/TikTok content feed -----------------------------

async function loadContentFeed() {
  const wrap = document.getElementById("content-feed");
  if (!wrap || !backendReady()) return;

  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=content`);
    if (!res.ok) return;
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) return;

    wrap.innerHTML = items.slice(0, 6).map(item => `
      <a class="content-card" href="${item.url}" target="_blank" rel="noopener">
        <span class="content-platform">${item.platform === "tiktok" ? "TikTok" : "Instagram"}</span>
        <strong>${item.caption || "Watch the video"}</strong>
        <span class="content-link">Watch →</span>
      </a>
    `).join("");
    document.getElementById("content-section")?.classList.remove("hidden-section");
  } catch (err) {
    // Fails silently — the static Instagram/TikTok links in the footer remain.
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderPackages();
  initBookingForm();
  loadContentFeed();
});
