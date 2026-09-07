// Shared front-end logic for the public site (packages, booking form, content feed).
// Relies on constants defined in config.js, loaded before this file.

const PAGE_LOADED_AT = Date.now();

function backendReady() {
  return typeof APPS_SCRIPT_URL === "string" && APPS_SCRIPT_URL.trim().length > 0;
}

// Reading a GET response from Apps Script via a real cross-origin fetch()
// is unreliable in practice on a real domain (the browser can block it
// even though it worked in local testing). JSONP sidesteps that entirely:
// a <script> tag isn't subject to CORS, so the server just returns
// JS that calls straight into our callback instead of a JSON body we'd
// have to read via fetch.
let jsonpCounter = 0;
function jsonpRequest(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `__jsonp_cb_${Date.now()}_${jsonpCounter++}`;
    const script = document.createElement("script");
    let settled = false;

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };
    window[callbackName] = (data) => {
      settled = true;
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      if (!settled) {
        cleanup();
        reject(new Error("JSONP request failed"));
      }
    };
    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${callbackName}`;
    document.body.appendChild(script);

    setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error("JSONP request timed out"));
      }
    }, 8000);
  });
}

// ---- Pricing / package cards -----------------------------------------------
// Packages are multi-select: a client can combine plans (e.g. a Bridal
// Package plus a Bridal Party Add-On) by checking more than one card.

function getSelectedPackages() {
  return PACKAGES.filter(pkg => document.getElementById(`pkg-${pkg.id}`)?.checked);
}

// Combines however many packages are selected into one display name and
// one price: if every selected price is a plain "$NNN+"-style number, add
// them up into a single estimate; otherwise (e.g. "Let's talk" is in the
// mix) fall back to asking Andrea for a custom quote.
function combineSelectedPackages(selected) {
  if (selected.length === 0) return { name: "", price: "" };
  const name = selected.map(p => p.name).join(" + ");
  const numbers = selected.map(p => {
    const m = String(p.price).match(/\d+/);
    return m ? Number(m[0]) : null;
  });
  const price = numbers.every(n => n !== null)
    ? `$${numbers.reduce((a, b) => a + b, 0)}+ combined`
    : "Custom quote (multiple services selected)";
  return { name, price };
}

function renderPackages() {
  const grid = document.getElementById("packages-grid");
  if (!grid) return;

  grid.innerHTML = PACKAGES.map(pkg => `
    <label class="pkg-card" for="pkg-${pkg.id}">
      <input type="checkbox" name="pkg-checkbox" id="pkg-${pkg.id}" value="${pkg.id}">
      <div class="pkg-name">${pkg.name}</div>
      <div class="pkg-price">${pkg.price}</div>
      <div class="pkg-tagline">${pkg.tagline}</div>
      <p>${pkg.description}</p>
    </label>
  `).join("");

  grid.querySelectorAll('input[name="pkg-checkbox"]').forEach(input => {
    input.addEventListener("change", () => {
      input.closest(".pkg-card").classList.toggle("selected", input.checked);
      grid.dispatchEvent(new Event("selectionchange"));
    });
  });
}

function selectPackageById(id) {
  const checkbox = document.getElementById(`pkg-${id}`);
  if (checkbox) {
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth" });
  }
}

// ---- Booking form ------------------------------------------------------

async function checkAvailability(date, time, planName) {
  if (!backendReady() || !date) return { available: true };
  try {
    const params = new URLSearchParams({ action: "checkAvailability", date });
    if (time) params.set("time", time);
    if (planName) params.set("plan", planName);
    const data = await jsonpRequest(`${APPS_SCRIPT_URL}?${params.toString()}`);
    return { available: data.available !== false, reason: data.reason || "" };
  } catch (err) {
    return { available: true }; // don't block the user if the check itself fails
  }
}

function initBookingForm() {
  const form = document.getElementById("booking-form");
  if (!form) return;
  const statusEl = document.getElementById("booking-status");
  const availabilityEl = document.getElementById("availability-status");
  const summaryEl = document.getElementById("selected-plans-summary");
  const dateInput = form.querySelector('input[name="date"]');
  const timeInput = form.querySelector('input[name="time"]');
  const packagesGrid = document.getElementById("packages-grid");

  function updateSummary() {
    if (!summaryEl) return;
    const selected = getSelectedPackages();
    if (selected.length === 0) {
      summaryEl.textContent = "No plan selected yet — pick one or more in the Pricing section above.";
      return;
    }
    const { name, price } = combineSelectedPackages(selected);
    summaryEl.textContent = `${name} — ${price}`;
  }
  packagesGrid?.addEventListener("selectionchange", () => {
    updateSummary();
    updateAvailability();
  });
  updateSummary();

  async function updateAvailability() {
    const date = dateInput.value;
    if (!date || !availabilityEl) {
      if (availabilityEl) availabilityEl.textContent = "";
      return;
    }
    availabilityEl.textContent = "Checking availability...";
    availabilityEl.className = "form-status";
    const { name } = combineSelectedPackages(getSelectedPackages());
    const result = await checkAvailability(date, timeInput.value, name);
    if (!result.available) {
      availabilityEl.textContent = result.reason || "That date/time isn't available. Please choose a different one.";
      availabilityEl.className = "form-status form-status-warn";
    } else {
      availabilityEl.textContent = "";
      availabilityEl.className = "form-status";
    }
  }
  dateInput?.addEventListener("change", updateAvailability);
  timeInput?.addEventListener("change", updateAvailability);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!backendReady()) {
      statusEl.textContent = "This form isn't connected to Andrea's booking system yet. For now, please reach out on Instagram or TikTok directly — see the links below.";
      statusEl.className = "form-status form-status-warn";
      return;
    }

    const selected = getSelectedPackages();
    if (selected.length === 0) {
      statusEl.textContent = "Please select at least one plan above before booking.";
      statusEl.className = "form-status form-status-warn";
      return;
    }
    const { name: planName, price: planPrice } = combineSelectedPackages(selected);

    const fd = new FormData(form);

    const result = await checkAvailability(fd.get("date"), fd.get("time"), planName);
    if (!result.available) {
      statusEl.textContent = result.reason || "That date/time isn't available. Please choose a different one.";
      statusEl.className = "form-status form-status-warn";
      return;
    }

    const payload = {
      action: "booking",
      token: SHARED_TOKEN,
      name: fd.get("name"),
      contact: fd.get("contact"),
      date: fd.get("date"),
      time: fd.get("time"),
      eventType: fd.get("event"),
      plan: planName,
      price: planPrice,
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
      updateSummary();
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
    const items = await jsonpRequest(`${APPS_SCRIPT_URL}?action=content`);
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
