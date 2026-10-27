import { useState, useEffect } from "react";
import { CATEGORIES, iconFor } from "../format";
import { api } from "../api";

const todayIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Used for "confirm what I heard", "manual add expense", and "edit one expense".
export default function ConfirmSheet({
  title,
  subtitle,
  transcript,
  initialItems,
  onSave,
  onClose,
  allowAdd = true,
  categories: propCategories,
}) {
  const [categories, setCategories] = useState(propCategories || CATEGORIES);
  const [customMode, setCustomMode] = useState({}); // { [idx]: true/false }
  const [items, setItems] = useState(
    initialItems.map((i) => ({
      amount: i.amount ?? "",
      category: i.category || "Food",
      note: i.note || "",
      spent_on: i.spent_on || todayIso(),
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!propCategories) {
      api.categories()
        .then((cats) => {
          if (cats && cats.length) {
            setCategories(Array.from(new Set([...cats, ...CATEGORIES])));
          }
        })
        .catch(() => {});
    }
  }, [propCategories]);

  const change = (idx, patch) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  async function save() {
    const clean = items
      .filter((i) => Number(i.amount) > 0)
      .map((i) => ({
        amount: Number(i.amount),
        category: (i.category || "Other").trim(),
        note: (i.note || "").trim(),
        spent_on: i.spent_on || todayIso(),
      }));

    if (!clean.length) return setError("Add at least one amount greater than 0.");
    setSaving(true);
    setError("");
    try {
      await onSave(clean);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 backdrop-blur-sm p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl flex flex-col overflow-hidden rounded-t-[2rem] bg-paper shadow-2xl sm:rounded-3xl"
      >
        {/* Mobile drag handle & Header */}
        <div className="relative overflow-hidden bg-ink pt-2 pb-4 px-5">
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-white/30 sm:hidden" />
          <img src="/img/receipt.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="relative flex items-center justify-between text-white">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold">{title}</h2>
              {subtitle && <p className="text-xs sm:text-sm text-white/70 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3.5 p-4 sm:p-5">
          {transcript && (
            <div className="rounded-2xl bg-mint/90 p-3 text-xs sm:text-sm text-ink/75 ring-1 ring-leaf/20">
              <span className="font-semibold text-leaf">You said:</span> “{transcript}”
            </div>
          )}

          {items.map((it, idx) => {
            const isCustom = customMode[idx] || (!categories.includes(it.category) && it.category !== "");

            return (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-black/5"
              >
                <img src={iconFor(it.category)} alt="" className="h-10 w-10 shrink-0 rounded-xl mt-1" />
                <div className="min-w-0 flex-1 space-y-2">
                  {/* Note / Description */}
                  <input
                    value={it.note}
                    onChange={(e) => change(idx, { note: e.target.value })}
                    placeholder="Note / Description (e.g. Lunch with team)"
                    className="w-full rounded-xl bg-mint px-3 py-2 text-sm font-medium placeholder:text-ink/40 focus:ring-2 focus:ring-leaf/30"
                  />

                  {/* Category Selection + Custom Category */}
                  <div className="space-y-1.5">
                    {isCustom ? (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={it.category}
                          onChange={(e) => change(idx, { category: e.target.value })}
                          placeholder="Type custom category name…"
                          className="flex-1 rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-forest focus:ring-2 focus:ring-leaf/30"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setCustomMode({ ...customMode, [idx]: false });
                            change(idx, { category: "Food" });
                          }}
                          className="rounded-xl bg-mint px-2.5 py-1 text-xs font-semibold text-ink/60 hover:text-ink"
                        >
                          List
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <select
                          value={it.category}
                          onChange={(e) => {
                            if (e.target.value === "__CUSTOM__") {
                              setCustomMode({ ...customMode, [idx]: true });
                              change(idx, { category: "" });
                            } else {
                              change(idx, { category: e.target.value });
                            }
                          }}
                          className="flex-1 rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-ink"
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          <option value="__CUSTOM__">+ Custom Category…</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Amount and Date */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Amount */}
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink/40 font-bold">
                        ₹
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={it.amount}
                        onChange={(e) => change(idx, { amount: e.target.value })}
                        placeholder="0"
                        className="w-full rounded-xl bg-mint pl-7 pr-3 py-2 text-sm font-bold text-ink focus:ring-2 focus:ring-leaf/30"
                      />
                    </div>

                    {/* Date Picker */}
                    <input
                      type="date"
                      value={it.spent_on}
                      onChange={(e) => change(idx, { spent_on: e.target.value })}
                      className="w-full rounded-xl bg-mint px-2.5 py-2 text-xs sm:text-sm font-semibold text-ink focus:ring-2 focus:ring-leaf/30"
                    />
                  </div>
                </div>

                {items.length > 1 && (
                  <button
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    aria-label="Remove item"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/30 hover:bg-coral/10 hover:text-coral active:scale-95"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {allowAdd && (
            <button
              onClick={() =>
                setItems([...items, { amount: "", category: "Food", note: "", spent_on: todayIso() }])
              }
              className="inline-flex items-center gap-1.5 py-1 text-sm font-semibold text-leaf hover:underline active:scale-95"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-mint text-xs">+</span>
              Add another item
            </button>
          )}

          {error && (
            <p className="rounded-xl bg-coral/10 p-3 text-xs sm:text-sm text-coral leading-relaxed">{error}</p>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-black/5 bg-paper p-4 pb-safe flex items-center justify-between gap-3 shadow-lg">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-ink/65 hover:bg-black/5 active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-2xl bg-forest py-3.5 px-6 text-sm sm:text-base font-bold text-white shadow-md shadow-forest/20 hover:bg-leaf active:scale-98 disabled:opacity-50"
          >
            {saving ? "Saving…" : `Confirm & Save ₹${Math.round(total).toLocaleString("en-IN")}`}
          </button>
        </div>
      </div>
    </div>
  );
}
