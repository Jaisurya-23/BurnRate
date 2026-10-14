// Shared helpers used by all three pages.

const fmt = n => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const sign = n => (n >= 0 ? "gain" : "loss");
const row = (label, value) => `<div class="row"><span>${label}</span><span>${value}</span></div>`;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);

// Talk to the Flask backend (same API as before).
async function post(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, data: await res.json() };
}

// Calculator button handler (used on the Calculators page).
async function calc(url, fields, outId, render) {
  const out = document.getElementById(outId);
  const payload = {};
  for (const [key, inputId] of Object.entries(fields)) {
    payload[key] = document.getElementById(inputId).value;
  }
  out.style.opacity = "0.5";
  try {
    const { ok, data } = await post(url, payload);
    out.innerHTML = ok ? render(data) : `<div class="error">${data.error}</div>`;
  } catch (err) {
    out.innerHTML = `<div class="error">Could not reach the server. Try again.</div>`;
  }
  out.style.opacity = "1";
}

// ---------- XP (saved in the browser, shown in the nav) ----------
function getXP() {
  try { return parseInt(localStorage.getItem("xp") || "0", 10); } catch (e) { return 0; }
}
function addXP(n) {
  const total = getXP() + n;
  try { localStorage.setItem("xp", total); } catch (e) {}
  showXP(true);
}
function showXP(bump) {
  const el = document.getElementById("xp");
  if (!el) return;
  el.textContent = "⭐ " + getXP() + " XP";
  if (bump) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
}
document.addEventListener("DOMContentLoaded", () => showXP(false));

// ---------- Multiple choice helper (used by all games) ----------
// options: array of strings, correct: index, onDone(wasRight)
function askChoice(box, options, correct, onDone) {
  box.innerHTML = "";
  options.forEach((text, i) => {
    const b = document.createElement("button");
    b.textContent = text;
    b.onclick = () => {
      [...box.children].forEach((btn, j) => {
        btn.disabled = true;
        if (j === correct) btn.classList.add("right");
      });
      if (i !== correct) b.classList.add("wrong");
      onDone(i === correct);
    };
    box.appendChild(b);
  });
}
