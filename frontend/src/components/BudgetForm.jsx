import { useState, useEffect } from "react";
import { api } from "../api";
import { CATEGORIES, iconFor } from "../format";

export default function BudgetForm({ initial, onSaved, submitLabel = "Save budgets" }) {
  const [catBudgets, setCatBudgets] = useState({});
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatAmount, setNewCatAmount] = useState("");
  const [showAddCustom, setShowAddCustom] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [budgets, allCats] = await Promise.all([
          api.getCategoryBudgets(),
          api.categories().catch(() => CATEGORIES),
        ]);
        setCatBudgets(budgets || {});

        // Unique categories: combine fetched categories and any existing budget keys
        const unique = Array.from(new Set([...allCats, ...Object.keys(budgets || {})]));
        setCategories(unique);
      } catch {
        setCategories(CATEGORIES);
      }
    }
    load();
  }, []);

  const totalBudget = Object.values(catBudgets).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const activeCount = Object.values(catBudgets).filter((val) => Number(val) > 0).length;

  const setCatLimit = (cat, val) => {
    setCatBudgets((prev) => ({ ...prev, [cat]: val }));
  };

  const removeCat = (cat) => {
    setCatBudgets((prev) => {
      const copy = { ...prev };
      delete copy[cat];
      return copy;
    });
  };

  const handleAddCustomCategory = (e) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    const amount = Number(newCatAmount) || 0;

    if (!categories.includes(name)) {
      setCategories((prev) => [...prev, name]);
    }
    setCatBudgets((prev) => ({ ...prev, [name]: amount }));
    setNewCatName("");
    setNewCatAmount("");
    setShowAddCustom(false);
  };

  async function submit(e) {
    e.preventDefault();
    if (totalBudget <= 0) {
      return setError("Please set a budget for at least one category (e.g. Food: ₹1000).");
    }
    setSaving(true);
    setError("");
    try {
      // Build clean payload with all numbers
      const payload = {};
      for (const cat of categories) {
        const val = Number(catBudgets[cat]) || 0;
        payload[cat] = val; // 0 removes from backend
      }
      await api.setCategoryBudgets(payload);
      await onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Total Budget Card */}
      <div className="rounded-2xl bg-forest p-4 text-white flex items-center justify-between shadow-sm">
        <div>
          <span className="text-xs text-white/70 font-medium">Total Monthly Budget</span>
          <p className="text-2xl sm:text-3xl font-display font-extrabold text-glow">
            ₹{Math.round(totalBudget).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/90">
            {activeCount} {activeCount === 1 ? "category" : "categories"}
          </span>
          <p className="text-[11px] text-white/50 mt-1">Sum of all category limits</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <label className="text-xs sm:text-sm font-bold text-ink/80 uppercase tracking-wider">
          Category Limits
        </label>
        <button
          type="button"
          onClick={() => setShowAddCustom(!showAddCustom)}
          className="text-xs font-semibold text-leaf hover:underline flex items-center gap-1 active:scale-95"
        >
          <span>{showAddCustom ? "✕ Close" : "+ Custom category"}</span>
        </button>
      </div>

      {/* Add Custom Category Inline Form */}
      {showAddCustom && (
        <div className="rounded-2xl bg-mint/70 p-3.5 ring-1 ring-leaf/20 space-y-2 animate-fade-in">
          <p className="text-xs font-bold text-forest">Add a new custom category & limit</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g. Friends, Gym, Petrol"
              className="flex-1 rounded-xl bg-white px-3 py-2 text-sm font-medium placeholder:text-ink/35 ring-1 ring-black/10 focus:ring-2 focus:ring-leaf/40"
            />
            <div className="relative w-28">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink/40 font-bold">₹</span>
              <input
                type="number"
                inputMode="decimal"
                value={newCatAmount}
                onChange={(e) => setNewCatAmount(e.target.value)}
                placeholder="500"
                className="w-full rounded-xl bg-white pl-6 pr-2 py-2 text-sm font-bold ring-1 ring-black/10 focus:ring-2 focus:ring-leaf/40"
              />
            </div>
            <button
              type="button"
              onClick={handleAddCustomCategory}
              disabled={!newCatName.trim()}
              className="rounded-xl bg-forest px-3.5 py-2 text-xs font-bold text-white hover:bg-leaf disabled:opacity-40 active:scale-95 transition"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 -mr-1">
        {categories.map((cat) => {
          const val = catBudgets[cat] ?? "";
          return (
            <div
              key={cat}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 hover:ring-leaf/30 transition"
            >
              <img src={iconFor(cat)} alt="" className="h-8 w-8 rounded-xl shrink-0" />
              <span className="min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm font-semibold text-ink truncate">
                {cat}
              </span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-ink/40 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={val}
                  onChange={(e) => setCatLimit(cat, e.target.value)}
                  placeholder="0 (no limit)"
                  className="w-full rounded-xl bg-mint pl-7 pr-3 py-2 text-sm font-bold placeholder:text-ink/25 transition focus:ring-2 focus:ring-leaf/30"
                />
              </div>
              {Number(val) > 0 && (
                <button
                  type="button"
                  onClick={() => setCatLimit(cat, "")}
                  title="Clear limit"
                  className="grid h-7 w-7 place-items-center rounded-lg text-ink/30 hover:bg-coral/10 hover:text-coral active:scale-95 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl bg-coral/10 p-3 text-xs sm:text-sm text-coral leading-relaxed">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-2xl bg-forest py-4 font-bold text-white shadow-md shadow-forest/20 transition active:scale-98 hover:bg-leaf disabled:opacity-50"
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
