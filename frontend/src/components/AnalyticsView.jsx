import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { money, iconFor } from "../format";

const CATEGORY_COLORS = {
  Food: "#FF6B6B",
  Groceries: "#20BF6B",
  Transport: "#2D9CDB",
  Rent: "#8854D0",
  Fun: "#F7B731",
  Bills: "#FA8231",
  Shopping: "#EB3B5A",
  Health: "#05C46B",
  Friends: "#FD79A8",
  Other: "#778CA3",
};

const EXTRA_COLORS = [
  "#4B7BEC",
  "#3867D6",
  "#0FB9B1",
  "#2BCBBA",
  "#FED330",
  "#FC5C65",
  "#45AAF2",
  "#26DE81",
  "#A55EEA",
  "#D1D8E0",
];

function getCategoryColor(cat, idx = 0) {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  return EXTRA_COLORS[idx % EXTRA_COLORS.length];
}

export default function AnalyticsView({ onBackToTracker, onOpenBudgetModal, onAddExpense }) {
  const [timeframe, setTimeframe] = useState("monthly"); // 'weekly' | 'monthly' | 'yearly'
  const [offset, setOffset] = useState(0); // 0 = current, -1 = previous, etc.
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredCat, setHoveredCat] = useState(null);
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'over' | 'within'

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      const res = await api.analytics(timeframe, offset);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, [timeframe, offset]);

  // Handle timeframe change (resets offset to 0 for present)
  const handleTimeframeChange = (tf) => {
    if (tf === timeframe) return;
    setTimeframe(tf);
    setOffset(0);
    setHoveredCat(null);
  };

  // Process pie chart slices
  const { slices, totalSpent } = useMemo(() => {
    if (!data || !data.categories) return { slices: [], totalSpent: 0 };

    const activeCats = data.categories.filter((c) => c.spent > 0);
    const sum = activeCats.reduce((acc, c) => acc + c.spent, 0);

    if (sum === 0) return { slices: [], totalSpent: 0 };

    let cumulativeAngle = 0;
    const computedSlices = activeCats.map((cat, idx) => {
      const fraction = cat.spent / sum;
      const angle = fraction * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle = endAngle;

      return {
        ...cat,
        color: cat.color || getCategoryColor(cat.category, idx),
        startAngle,
        endAngle,
        fraction,
        percentage: (fraction * 100).toFixed(1),
      };
    });

    return { slices: computedSlices, totalSpent: sum };
  }, [data]);

  // Active highlighted slice (either hovered or top category)
  const activeSlice = useMemo(() => {
    if (hoveredCat) {
      return slices.find((s) => s.category === hoveredCat) || null;
    }
    return null;
  }, [hoveredCat, slices]);

  // Filtered categories for list
  const displayCategories = useMemo(() => {
    if (!data || !data.categories) return [];
    if (filterMode === "over") {
      return data.categories.filter((c) => c.status === "over");
    }
    if (filterMode === "within") {
      return data.categories.filter((c) => c.status === "within");
    }
    return data.categories;
  }, [data, filterMode]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 space-y-6 animate-fade-in pb-24">
      {/* Top Header / View Controller */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/10 px-3 py-1 text-xs font-bold text-forest">
              <span className="h-2 w-2 rounded-full bg-leaf animate-pulse" />
              Live Insights
            </span>
            <span className="text-xs text-ink/50">• Category vs Budget</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink mt-1">
            Spending & Budget Analytics
          </h1>
          <p className="text-xs sm:text-sm text-ink/65 mt-0.5">
            Visualize category distribution, identify top spending areas, and track limits.
          </p>
        </div>

        {/* Timeframe Switcher Tabs (Weekly / Monthly / Yearly) */}
        <div className="flex items-center rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleTimeframeChange("weekly")}
            className={`rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold transition active:scale-95 ${
              timeframe === "weekly"
                ? "bg-forest text-white shadow-md shadow-forest/20"
                : "text-ink/65 hover:text-ink hover:bg-mint/50"
            }`}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => handleTimeframeChange("monthly")}
            className={`rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold transition active:scale-95 ${
              timeframe === "monthly"
                ? "bg-forest text-white shadow-md shadow-forest/20"
                : "text-ink/65 hover:text-ink hover:bg-mint/50"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => handleTimeframeChange("yearly")}
            className={`rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold transition active:scale-95 ${
              timeframe === "yearly"
                ? "bg-forest text-white shadow-md shadow-forest/20"
                : "text-ink/65 hover:text-ink hover:bg-mint/50"
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      {/* Date Navigation Bar */}
      <div className="flex items-center justify-between rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-black/5">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-ink/80 hover:bg-mint transition active:scale-95 ring-1 ring-black/5"
          title="Previous period"
        >
          <span>←</span>
          <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="flex items-center gap-2 text-center">
          <span className="font-display text-sm sm:text-base font-bold text-ink">
            {data ? data.label : "Loading timeframe…"}
          </span>
          {offset !== 0 && (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="rounded-full bg-leaf/10 px-2.5 py-0.5 text-[11px] font-bold text-leaf hover:bg-leaf/20 transition active:scale-95"
            >
              Current
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          disabled={!data || !data.has_next}
          className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold transition active:scale-95 ring-1 ring-black/5 ${
            data && data.has_next
              ? "text-ink/80 hover:bg-mint cursor-pointer"
              : "text-ink/30 bg-black/[0.02] cursor-not-allowed opacity-60"
          }`}
          title="Next period"
        >
          <span className="hidden sm:inline">Next</span>
          <span>→</span>
        </button>
      </div>

      {loading && !data ? (
        <div className="grid place-items-center rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-leaf border-t-transparent" />
          <p className="mt-3 text-xs text-ink/60">Crunching spending numbers…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-coral/10 p-5 text-center text-coral ring-1 ring-coral/20">
          <p className="font-bold text-sm">Failed to load analytics</p>
          <p className="text-xs mt-1">{error}</p>
          <button
            onClick={loadAnalytics}
            className="mt-3 rounded-xl bg-coral px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Executive Overview Stat Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Total Spent */}
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink/55">Total Spent</span>
                <span className="text-lg">💸</span>
              </div>
              <div className="mt-2">
                <p className="font-display text-xl sm:text-2xl font-extrabold text-ink">
                  {money(data.total_spent)}
                </p>
                <p className="text-[11px] text-ink/50 mt-0.5">
                  {data.expense_count} {data.expense_count === 1 ? "expense" : "expenses"}
                </p>
              </div>
            </div>

            {/* Budget Pool */}
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink/55">Timeframe Budget</span>
                <span className="text-lg">🎯</span>
              </div>
              <div className="mt-2">
                <p className="font-display text-xl sm:text-2xl font-extrabold text-ink">
                  {money(data.total_budget)}
                </p>
                <button
                  type="button"
                  onClick={onOpenBudgetModal}
                  className="text-[11px] font-semibold text-leaf hover:underline mt-0.5 block"
                >
                  Edit limits →
                </button>
              </div>
            </div>

            {/* Remaining / Buffer */}
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink/55">Net Balance</span>
                <span className="text-lg">{data.remaining >= 0 ? "🛡️" : "⚠️"}</span>
              </div>
              <div className="mt-2">
                <p
                  className={`font-display text-xl sm:text-2xl font-extrabold ${
                    data.remaining >= 0 ? "text-leaf" : "text-coral"
                  }`}
                >
                  {data.remaining >= 0 ? money(data.remaining) : `-${money(Math.abs(data.remaining))}`}
                </p>
                <p className="text-[11px] text-ink/50 mt-0.5">
                  {data.remaining >= 0 ? "Available buffer" : "Over total budget"}
                </p>
              </div>
            </div>

            {/* Budget Health Indicator */}
            <div
              className={`rounded-2xl p-4 shadow-sm ring-1 flex flex-col justify-between ${
                data.status === "over"
                  ? "bg-coral/10 ring-coral/30"
                  : data.status === "warning"
                  ? "bg-amber-500/10 ring-amber-500/30"
                  : "bg-leaf/10 ring-leaf/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink/70">Health Status</span>
                <span>
                  {data.status === "over" ? "🚨" : data.status === "warning" ? "⚠️" : "✅"}
                </span>
              </div>
              <div className="mt-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      data.status === "over"
                        ? "bg-coral"
                        : data.status === "warning"
                        ? "bg-amber-500"
                        : "bg-leaf"
                    }`}
                  />
                  <p className="font-display text-lg sm:text-xl font-extrabold text-ink">
                    {data.status === "over"
                      ? "Over Limit"
                      : data.status === "warning"
                      ? "Near Limit"
                      : "Healthy"}
                  </p>
                </div>
                <p className="text-[11px] font-semibold text-ink/65 mt-0.5">
                  {data.total_budget > 0
                    ? `${data.budget_percent}% of budget spent`
                    : "No budget configured"}
                </p>
              </div>
            </div>
          </div>

          {/* Top Spending Category Highlight ("Where you spend most") */}
          {data.top_category && data.top_category.spent > 0 && (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-ink via-forest to-ink p-5 sm:p-6 text-white shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold text-glow backdrop-blur-sm">
                      <span>🏆</span>
                      <span>Top Expense Category</span>
                    </span>
                    <span className="text-xs text-white/60">
                      Highest drain in this timeframe
                    </span>
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
                    <span>{data.top_category.category}</span>
                    <span className="text-glow text-xl sm:text-2xl font-bold">
                      {money(data.top_category.spent)}
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-white/80 max-w-xl">
                    You spent{" "}
                    <strong className="text-glow font-bold">
                      {data.top_category.percent_of_total}%
                    </strong>{" "}
                    of your total expenditure on {data.top_category.category}.
                    {data.top_category.budget > 0 ? (
                      data.top_category.status === "over" ? (
                        <span className="text-coral ml-1 font-semibold">
                          Exceeded limit by {money(data.top_category.over_by)}!
                        </span>
                      ) : (
                        <span className="text-white/80 ml-1">
                          Within budget ({money(data.top_category.remaining)} left).
                        </span>
                      )
                    ) : (
                      <span className="text-white/60 ml-1">
                        (No specific category budget set).
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-6 shrink-0">
                  <span className="text-xs text-white/60">Category Share</span>
                  <div className="font-display text-3xl font-black text-glow">
                    {data.top_category.percent_of_total}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Visuals Section: Pie Chart & Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Interactive Pie / Donut Chart Card (Lg: 5 columns) */}
            <div className="lg:col-span-5 rounded-3xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-black/5 flex flex-col items-center justify-between">
              <div className="w-full flex items-center justify-between mb-2">
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-ink">
                    Spend Distribution
                  </h2>
                  <p className="text-xs text-ink/55">
                    Hover or tap slices to inspect
                  </p>
                </div>
                <span className="text-xs font-bold text-ink/40">
                  {slices.length} active
                </span>
              </div>

              {/* SVG Donut Chart */}
              {slices.length === 0 ? (
                <div className="my-8 flex flex-col items-center justify-center p-6 text-center">
                  <div className="h-28 w-28 rounded-full bg-mint flex items-center justify-center text-4xl">
                    🌱
                  </div>
                  <p className="font-display text-base font-bold text-ink mt-3">
                    No Expenses Recorded
                  </p>
                  <p className="text-xs text-ink/55 max-w-xs mt-1">
                    There are no logged expenses for {data.label}. Try selecting another period or add one!
                  </p>
                  {onAddExpense && (
                    <button
                      type="button"
                      onClick={onAddExpense}
                      className="mt-4 rounded-xl bg-forest px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-leaf transition active:scale-95"
                    >
                      + Add Expense
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative my-4 flex items-center justify-center">
                  <DonutChart
                    slices={slices}
                    hoveredCat={hoveredCat}
                    onHoverCat={setHoveredCat}
                  />

                  {/* Dynamic Center Badge */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    {activeSlice ? (
                      <div className="animate-fade-in">
                        <span
                          className="inline-block h-2 w-2 rounded-full mb-1"
                          style={{ backgroundColor: activeSlice.color }}
                        />
                        <p className="text-xs font-bold text-ink/60 truncate max-w-[120px]">
                          {activeSlice.category}
                        </p>
                        <p className="font-display text-xl sm:text-2xl font-extrabold text-ink leading-tight">
                          {money(activeSlice.spent)}
                        </p>
                        <p className="text-xs font-bold" style={{ color: activeSlice.color }}>
                          {activeSlice.percentage}% of spend
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[11px] font-semibold text-ink/50 uppercase tracking-wider">
                          Total Spend
                        </p>
                        <p className="font-display text-2xl sm:text-3xl font-extrabold text-ink leading-tight">
                          {money(totalSpent)}
                        </p>
                        <p className="text-[11px] font-semibold text-leaf">
                          {slices.length} categories
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Donut Legend */}
              <div className="w-full mt-3 pt-3 border-t border-black/5 grid grid-cols-2 gap-2 text-xs">
                {slices.slice(0, 6).map((s) => (
                  <button
                    key={s.category}
                    type="button"
                    onMouseEnter={() => setHoveredCat(s.category)}
                    onMouseLeave={() => setHoveredCat(null)}
                    onClick={() =>
                      setHoveredCat(hoveredCat === s.category ? null : s.category)
                    }
                    className={`flex items-center gap-2 p-1.5 rounded-xl transition text-left ${
                      hoveredCat === s.category
                        ? "bg-mint ring-1 ring-leaf/30"
                        : "hover:bg-black/[0.02]"
                    }`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink leading-none">
                        {s.category}
                      </p>
                      <p className="text-[11px] text-ink/50 mt-0.5">
                        {s.percentage}% ({money(s.spent)})
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Spend vs Budget Comparison Cards (Lg: 7 columns) */}
            <div className="lg:col-span-7 rounded-3xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-black/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-black/5">
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-ink">
                    Budget Comparison & Indicators
                  </h2>
                  <p className="text-xs text-ink/55">
                    Green = within budget • Red = over budget
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 self-start sm:self-auto bg-paper p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      filterMode === "all"
                        ? "bg-white text-ink shadow-sm"
                        : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    All ({data.categories.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("over")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      filterMode === "over"
                        ? "bg-coral text-white shadow-sm"
                        : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    Over Limit
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("within")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      filterMode === "within"
                        ? "bg-leaf text-white shadow-sm"
                        : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    Within Budget
                  </button>
                </div>
              </div>

              {/* Categories Comparison List */}
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {displayCategories.length === 0 ? (
                  <p className="text-center py-8 text-xs text-ink/50">
                    No categories match the "{filterMode}" filter.
                  </p>
                ) : (
                  displayCategories.map((cat, idx) => {
                    const hasBudget = cat.budget > 0;
                    const percentBar = hasBudget
                      ? Math.min(cat.budget_percent, 100)
                      : 0;
                    const isHovered = hoveredCat === cat.category;

                    return (
                      <div
                        key={cat.category}
                        onMouseEnter={() => setHoveredCat(cat.category)}
                        onMouseLeave={() => setHoveredCat(null)}
                        className={`rounded-2xl p-3.5 transition-all ring-1 ${
                          isHovered
                            ? "bg-mint/40 ring-leaf shadow-sm"
                            : "bg-paper/70 ring-black/5 hover:bg-paper"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          {/* Left: Icon, Category Name, Share % */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative">
                              <img
                                src={iconFor(cat.category)}
                                alt=""
                                className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl object-contain bg-white p-1 ring-1 ring-black/5"
                              />
                              <span
                                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white"
                                style={{
                                  backgroundColor:
                                    cat.color || getCategoryColor(cat.category, idx),
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-display text-sm font-bold text-ink truncate">
                                  {cat.category}
                                </p>
                                {cat.percent_of_total > 0 && (
                                  <span className="rounded-full bg-black/5 px-2 py-0.2 text-[10px] font-semibold text-ink/60">
                                    {cat.percent_of_total}%
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-ink/50">
                                Spent {money(cat.spent)}
                                {hasBudget ? ` of ${money(cat.budget)}` : " (No limit)"}
                              </p>
                            </div>
                          </div>

                          {/* Right: Status Pill */}
                          <div className="text-right shrink-0">
                            {hasBudget ? (
                              <div>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                    cat.status === "over"
                                      ? "bg-coral text-white shadow-sm"
                                      : cat.status === "warning"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-leaf/15 text-forest"
                                  }`}
                                >
                                  <span>
                                    {cat.status === "over"
                                      ? "🚨 Over"
                                      : cat.status === "warning"
                                      ? "⚠️ Warning"
                                      : "✅ Healthy"}
                                  </span>
                                  <span>• {cat.budget_percent}%</span>
                                </span>
                                <p className="text-[11px] font-medium text-ink/50 mt-0.5">
                                  {cat.status === "over"
                                    ? `+${money(cat.over_by)} over`
                                    : `${money(cat.remaining)} left`}
                                </p>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={onOpenBudgetModal}
                                className="text-xs font-semibold text-leaf hover:underline"
                              >
                                + Set budget
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar (if budget is set) */}
                        {hasBudget && (
                          <div className="mt-2.5 space-y-1">
                            <div className="h-2 w-full rounded-full bg-black/5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  cat.status === "over"
                                    ? "bg-coral"
                                    : cat.status === "warning"
                                    ? "bg-amber-400"
                                    : "bg-leaf"
                                }`}
                                style={{ width: `${percentBar}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Floating Return Button */}
      <div className="pt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToTracker}
          className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-forest transition active:scale-95"
        >
          <span>← Back to Daily Tracker</span>
        </button>

        <button
          type="button"
          onClick={onOpenBudgetModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-ink shadow-sm ring-1 ring-black/10 hover:bg-mint transition active:scale-95"
        >
          <span>⚙️ Adjust Category Limits</span>
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Interactive SVG Donut Chart Component
// -------------------------------------------------------------
function DonutChart({ slices, hoveredCat, onHoverCat }) {
  const size = 260;
  const radius = 95;
  const strokeWidth = 32;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Render SVG arcs using stroke-dasharray & stroke-dashoffset
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="transform -rotate-90 drop-shadow-sm transition-all"
    >
      {/* Background Track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke="#EAEAEA"
        strokeWidth={strokeWidth}
      />

      {/* Slices */}
      {slices.map((slice) => {
        const strokeLength = (slice.fraction * circumference);
        const spaceLength = circumference - strokeLength;
        const offset = -((slice.startAngle / 360) * circumference);
        const isHovered = hoveredCat === slice.category;

        return (
          <circle
            key={slice.category}
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke={slice.color}
            strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
            strokeDasharray={`${strokeLength} ${spaceLength}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
            className="cursor-pointer transition-all duration-200"
            style={{
              filter: isHovered ? "brightness(1.1) drop-shadow(0 2px 6px rgba(0,0,0,0.2))" : "none",
            }}
            onMouseEnter={() => onHoverCat(slice.category)}
            onMouseLeave={() => onHoverCat(null)}
            onClick={() => onHoverCat(isHovered ? null : slice.category)}
          />
        );
      })}
    </svg>
  );
}
