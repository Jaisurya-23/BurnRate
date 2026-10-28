import { useEffect, useState } from "react";
import { api } from "./api";
import { money } from "./format";
import Recorder from "./components/Recorder";
import ConfirmSheet from "./components/ConfirmSheet";
import BudgetForm from "./components/BudgetForm";
import Categories from "./components/Categories";
import ExpenseList from "./components/ExpenseList";
import AuthView from "./components/AuthView";
import AnalyticsView from "./components/AnalyticsView";

const todayIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function App() {
  const [hasToken, setHasToken] = useState(!!api.getToken());
  const [dash, setDash] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false);
  const [pending, setPending] = useState(null); // { transcript, items } from voice/ai
  const [editing, setEditing] = useState(null); // an existing expense
  const [addingCustom, setAddingCustom] = useState(false); // manual custom expense modal
  const [showBudget, setShowBudget] = useState(false);
  const [mobileTab, setMobileTab] = useState("expenses"); // 'expenses' | 'insights'
  const [alerts, setAlerts] = useState([]); // category budget alerts
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window !== "undefined" && window.location.hash === "#analytics") {
      return "analytics";
    }
    return "tracker";
  });
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === "#analytics") {
        setCurrentPage("analytics");
      } else {
        setCurrentPage("tracker");
      }
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  async function refresh() {
    if (!api.getToken()) {
      setHasToken(false);
      return;
    }
    try {
      const [d, e] = await Promise.all([api.dashboard(), api.expenses()]);
      setDash(d);
      setExpenses(e);
      setAnalyticsRefreshKey((k) => k + 1);
      setError("");
    } catch (err) {
      if (err.status === 401) {
        setHasToken(false);
        setDash(null);
      } else {
        setError(err.message);
      }
    }
  }

  useEffect(() => {
    if (hasToken) {
      const t = setTimeout(() => setSlow(true), 3000);
      refresh().finally(() => clearTimeout(t));
    }
  }, [hasToken]);

  // If user is not logged in, show Auth Screen (Login / Sign Up)
  if (!hasToken) {
    return (
      <AuthView
        onAuthSuccess={async () => {
          setHasToken(true);
          await refresh();
        }}
      />
    );
  }

  if (!dash) {
    return <LoadingScreen error={error} slow={slow} onRetry={refresh} onLogout={async () => { await api.logout(); setHasToken(false); setDash(null); }} />;
  }

  // First visit for this user: ask for category budgets before showing anything else.
  if (!dash.budget_set) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center p-4 pt-safe pb-safe">
        <div className="mx-auto grid max-w-4xl w-full items-center gap-6 overflow-hidden rounded-3xl bg-paper sm:p-3 lg:grid-cols-2">
          {/* Full Illustration Panel (Desktop & Mobile) */}
          <div className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-mint/80 via-mint/40 to-forest/10 text-center">
            <img
              src="/img/hero-relax.png"
              alt="Relaxed financial tracking"
              className="w-full max-h-56 sm:max-h-80 lg:max-h-[380px] object-contain drop-shadow-lg"
            />
            <div className="mt-4 hidden lg:block">
              <p className="font-display text-lg font-bold text-forest">
                Effortless tracking, zero stress
              </p>
              <p className="mt-1 text-xs text-ink/65 max-w-xs leading-relaxed">
                Set category limits once. BurnRate automatically calculates your daily safe-to-spend limit.
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/img/logo.png" alt="BurnRate" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl" />
                <span className="font-display text-xl font-bold">BurnRate</span>
              </div>
              <button
                onClick={async () => {
                  await api.logout();
                  setHasToken(false);
                  setDash(null);
                }}
                className="text-xs font-semibold text-coral hover:underline"
              >
                Log out
              </button>
            </div>
            <h1 className="mt-4 font-display text-2xl sm:text-3xl font-bold text-ink">
              Set your category budgets
            </h1>
            <p className="mb-6 mt-2 text-sm text-ink/70 leading-relaxed">
              Welcome {dash.user?.name || "back"}! Set spending limits for your categories (e.g. Food ₹1000, Friends ₹500). BurnRate calculates your daily safe-to-spend limit and warns you when a category is running out.
            </p>
            <BudgetForm onSaved={refresh} submitLabel="Start tracking" />
          </div>
        </div>
      </div>
    );
  }

  const over = dash.safe_to_spend < 0;
  const pool = Math.max(1, dash.monthly_budget);
  const spentPct = Math.min(Math.round((dash.spent / pool) * 100), 100);

  return (
    <div className="min-h-screen pb-safe">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-paper/90 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3 pt-safe">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          {/* Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <img src="/img/logo.png" alt="BurnRate" className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl shadow-sm" />
            <div>
              <span className="font-display text-base sm:text-lg font-bold tracking-tight text-ink">BurnRate</span>
              {dash.month && (
                <span className="ml-1.5 hidden md:inline-block rounded-full bg-mint px-2 py-0.2 text-[11px] font-semibold text-leaf">
                  {dash.month}
                </span>
              )}
            </div>
          </div>

          {/* Dedicated Page Switcher (Tracker vs Analytics) */}
          <nav aria-label="Page navigation" className="flex items-center rounded-2xl bg-black/[0.05] p-1 ring-1 ring-black/5">
            <button
              type="button"
              onClick={() => {
                setCurrentPage("tracker");
                if (window.location.hash !== "#tracker") window.location.hash = "tracker";
              }}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 ${
                currentPage === "tracker"
                  ? "bg-white text-ink shadow-sm ring-1 ring-black/5"
                  : "text-ink/60 hover:text-ink hover:bg-black/[0.02]"
              }`}
            >
              <span>⚡</span>
              <span>Tracker</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentPage("analytics");
                if (window.location.hash !== "#analytics") window.location.hash = "analytics";
              }}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 ${
                currentPage === "analytics"
                  ? "bg-white text-ink shadow-sm ring-1 ring-black/5"
                  : "text-ink/60 hover:text-ink hover:bg-black/[0.02]"
              }`}
            >
              <span>📊</span>
              <span>Analytics</span>
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Custom Expense Button – hidden on mobile (FAB handles it) */}
            <button
              onClick={() => setAddingCustom(true)}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-forest px-3 py-2 text-xs sm:text-sm font-bold text-white shadow-sm transition active:scale-95 hover:bg-leaf"
            >
              <span>+ Add Expense</span>
            </button>

            {/* Budgets Button */}
            <button
              onClick={() => setShowBudget(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-ink shadow-sm ring-1 ring-black/10 transition active:scale-95 hover:bg-mint"
            >
              <img src="/img/ic-wallet.png" alt="" className="h-4 w-4" />
              <span>Budgets</span>
            </button>

            {/* User Profile & Logout */}
            {dash.user && (
              <div className="flex items-center gap-1 pl-1 sm:pl-2 border-l border-black/10">
                <span
                  className="hidden md:inline-block text-xs font-semibold text-ink/75 truncate max-w-[110px]"
                  title={dash.user.email}
                >
                  👤 {dash.user.name || dash.user.email.split("@")[0]}
                </span>
                <button
                  onClick={async () => {
                    await api.logout();
                    setHasToken(false);
                    setDash(null);
                  }}
                  className="rounded-xl px-2.5 py-2 text-xs font-bold text-coral hover:bg-coral/10 transition active:scale-95 flex items-center gap-1"
                  title="Log out"
                >
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {currentPage === "analytics" ? (
        <AnalyticsView
          key={analyticsRefreshKey}
          onBackToTracker={() => {
            setCurrentPage("tracker");
            window.location.hash = "tracker";
          }}
          onOpenBudgetModal={() => setShowBudget(true)}
          onAddExpense={() => setAddingCustom(true)}
        />
      ) : (
        <main className="mx-auto max-w-5xl px-4 sm:px-6 py-4 space-y-4 lg:grid lg:grid-cols-5 lg:gap-6 lg:space-y-0 pb-20">
          {/* Left Column (Main actions & cards) */}
          <div className="space-y-4 sm:space-y-5 lg:col-span-3">
            {/* Safe-to-Spend Hero Card */}
          <section className="relative overflow-hidden rounded-3xl bg-ink p-5 sm:p-7 text-white shadow-xl shadow-ink/10">
            <img
              src="/img/trend.png"
              alt=""
              className="pointer-events-none absolute inset-x-0 bottom-0 h-36 w-full object-cover opacity-30 mix-blend-screen"
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm">
                  <span className={`h-2 w-2 rounded-full ${over ? "bg-coral animate-ping" : "bg-glow"}`} />
                  {over ? "Over Budget" : "Safe to spend today"}
                </span>
                <span className="text-xs font-medium text-white/60">
                  {dash.days_left} {dash.days_left === 1 ? "day left" : "days left"}
                </span>
              </div>

              <div className="mt-3">
                <p
                  className={`font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight break-words ${
                    over ? "text-coral" : "text-glow"
                  }`}
                >
                  {money(dash.safe_to_spend)}
                </p>
                <p className="mt-2 text-xs sm:text-sm text-white/80 max-w-sm leading-relaxed">
                  {over
                    ? `You are ${money(-dash.remaining)} over budget this month. Avoid new expenses until the new month.`
                    : `${money(dash.remaining)} remaining for ${dash.days_left} ${dash.days_left === 1 ? "day" : "days"} (today included).`}
                </p>
              </div>

              {/* Monthly Burn Progress Bar */}
              <div className="mt-5 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-xs text-white/70 mb-1.5">
                  <span>Spent {money(dash.spent)}</span>
                  <span className="font-semibold text-white/90">{spentPct}% of monthly pool</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      over || spentPct > 90 ? "bg-coral" : spentPct > 70 ? "bg-amber-400" : "bg-leaf"
                    }`}
                    style={{ width: `${spentPct}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Voice + Text Recorder */}
          <Recorder
            onParsed={(transcript, items) => setPending({ transcript, items })}
            onManualAdd={() => setAddingCustom(true)}
          />

          {/* Mobile Tab Switcher (< lg screens) */}
          <div className="lg:hidden">
            <div className="grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/5">
              <button
                onClick={() => setMobileTab("expenses")}
                className={`rounded-xl py-2.5 text-xs sm:text-sm font-bold transition active:scale-95 ${
                  mobileTab === "expenses"
                    ? "bg-forest text-white shadow-sm"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                Expenses ({expenses.length})
              </button>
              <button
                onClick={() => setMobileTab("insights")}
                className={`rounded-xl py-2.5 text-xs sm:text-sm font-bold transition active:scale-95 ${
                  mobileTab === "insights"
                    ? "bg-forest text-white shadow-sm"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                Stats & Categories
              </button>
            </div>
          </div>

          {/* Mobile View: Tab Content */}
          <div className="lg:hidden">
            {mobileTab === "expenses" ? (
              <ExpenseList
                expenses={expenses}
                onEdit={setEditing}
                onDelete={async (id) => {
                  await api.deleteExpense(id);
                  refresh();
                }}
              />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat icon="/img/ic-wallet.png" label={`Spent in ${dash.month.split(" ")[0]}`} value={money(dash.spent)} />
                  <Stat icon="/img/ic-chart.png" label="Spent today" value={money(dash.spent_today)} />
                  <Stat icon="/img/ic-growth.png" label="Total budget" value={money(dash.monthly_budget)} />
                  <Stat icon="/img/ic-secure.png" label="Remaining" value={money(dash.remaining)} />
                </div>
                <Categories data={dash.categories} categoryBudgets={dash.category_budgets || {}} />
              </div>
            )}
          </div>

          {/* Desktop View: Expense list always shows in column 1 */}
          <div className="hidden lg:block">
            <ExpenseList
              expenses={expenses}
              onEdit={setEditing}
              onDelete={async (id) => {
                await api.deleteExpense(id);
                refresh();
              }}
            />
          </div>
        </div>

        {/* Right Column / Desktop Sidebar */}
        <aside className="hidden lg:block space-y-5 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <Stat icon="/img/ic-wallet.png" label={`Spent in ${dash.month.split(" ")[0]}`} value={money(dash.spent)} />
            <Stat icon="/img/ic-chart.png" label="Spent today" value={money(dash.spent_today)} />
            <Stat icon="/img/ic-growth.png" label="Total budget" value={money(dash.monthly_budget)} />
            <Stat icon="/img/ic-secure.png" label="Remaining" value={money(dash.remaining)} />
          </div>
          <Categories data={dash.categories} categoryBudgets={dash.category_budgets || {}} />
        </aside>
      </main>
      )}

      {/* Floating Action Button (FAB) on Mobile */}
      <button
        onClick={() => setAddingCustom(true)}
        className="lg:hidden fixed bottom-6 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-forest text-white shadow-xl shadow-forest/40 active:scale-95 transition hover:bg-leaf"
        aria-label="Add custom expense"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Voice/AI Confirmation Bottom Sheet */}
      {pending && (
        <ConfirmSheet
          title="Does this look right?"
          subtitle="Review, pick date, and edit before saving."
          transcript={pending.transcript}
          initialItems={pending.items}
          onClose={() => setPending(null)}
          onSave={async (items) => {
            const result = await api.saveExpenses(items, pending.transcript);
            setPending(null);
            if (result.alerts && result.alerts.length > 0) {
              setAlerts(result.alerts);
              setTimeout(() => setAlerts([]), 8000);
            }
            refresh();
          }}
        />
      )}

      {/* Manual / Custom Expense Modal */}
      {addingCustom && (
        <ConfirmSheet
          title="Add Expense"
          subtitle="Select date, category, amount and note."
          allowAdd={true}
          initialItems={[
            {
              amount: "",
              category: "Food",
              note: "",
              spent_on: todayIso(),
            },
          ]}
          onClose={() => setAddingCustom(false)}
          onSave={async (items) => {
            const result = await api.saveExpenses(items, "Manual entry");
            setAddingCustom(false);
            if (result.alerts && result.alerts.length > 0) {
              setAlerts(result.alerts);
              setTimeout(() => setAlerts([]), 8000);
            }
            refresh();
          }}
        />
      )}

      {/* Edit Expense Modal */}
      {editing && (
        <ConfirmSheet
          title="Edit Expense"
          subtitle="Update date, amount, category or note."
          allowAdd={false}
          initialItems={[
            {
              amount: editing.amount,
              category: editing.category,
              note: editing.note,
              spent_on: editing.spent_on ? editing.spent_on.split("T")[0] : todayIso(),
            },
          ]}
          onClose={() => setEditing(null)}
          onSave={async ([item]) => {
            const res = await api.updateExpense(editing.id, item);
            setEditing(null);
            if (res.alerts && res.alerts.length > 0) {
              setAlerts(res.alerts);
              setTimeout(() => setAlerts([]), 8000);
            }
            refresh();
          }}
        />
      )}

      {/* Category Budgets Bottom Sheet Modal */}
      {showBudget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/70 backdrop-blur-sm p-0 sm:p-5"
          onClick={() => setShowBudget(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-[2rem] sm:rounded-3xl bg-paper shadow-2xl pb-safe"
          >
            {/* Top mobile handle */}
            <div className="relative overflow-hidden bg-ink pt-2">
              <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-white/30 sm:hidden" />
              <img src="/img/coins.png" alt="" className="h-28 sm:h-32 w-full object-cover opacity-80" />
              <div className="absolute top-3 right-3">
                <button
                  onClick={() => setShowBudget(false)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 active:scale-95"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <h2 className="mb-1 font-display text-xl sm:text-2xl font-bold text-ink">Category Budgets</h2>
              <p className="mb-4 text-xs sm:text-sm text-ink/60">
                Set limits for each category. You'll get an alert when any category crosses its limit.
              </p>
              <BudgetForm
                initial={dash}
                onSaved={async () => {
                  setShowBudget(false);
                  await refresh();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Category Budget Alert Toast */}
      {alerts.length > 0 && (
        <div className="fixed top-4 right-4 z-[60] space-y-2 animate-fade-in max-w-sm w-full">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-2xl p-4 shadow-xl backdrop-blur-md ring-1 ${
                a.severity === "over"
                  ? "bg-coral/95 text-white ring-coral/30"
                  : "bg-amber-50 text-amber-900 ring-amber-200"
              }`}
            >
              <span className="text-2xl">{a.severity === "over" ? "🚨" : "⚠️"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {a.severity === "over"
                    ? `${a.category} limit exceeded!`
                    : `${a.category} limit almost reached`}
                </p>
                <p className={`text-xs mt-0.5 ${a.severity === "over" ? "text-white/80" : "text-amber-700"}`}>
                  {a.severity === "over"
                    ? `Spent ₹${a.spent.toLocaleString("en-IN")} / ₹${a.budget.toLocaleString("en-IN")} (₹${a.over_by.toLocaleString("en-IN")} over)`
                    : `Spent ₹${a.spent.toLocaleString("en-IN")} / ₹${a.budget.toLocaleString("en-IN")} (₹${a.remaining.toLocaleString("en-IN")} left)`}
                </p>
              </div>
              <button
                onClick={() => setAlerts((prev) => prev.filter((_, j) => j !== i))}
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm ${
                  a.severity === "over" ? "bg-white/20 hover:bg-white/30" : "bg-amber-200 hover:bg-amber-300"
                } active:scale-95`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm ring-1 ring-black/5 flex flex-col justify-between">
      <img src={icon} alt="" className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl" />
      <div className="mt-2.5">
        <p className="text-[11px] sm:text-xs font-medium text-ink/55 truncate">{label}</p>
        <p className="font-display text-lg sm:text-xl font-bold text-ink mt-0.5">{value}</p>
      </div>
    </div>
  );
}

const FINANCE_TIPS = [
  {
    emoji: "🍕",
    tag: "Budgeting 101",
    title: "The 50/30/20 Rule",
    fact: "50% Needs, 30% Wants, 20% Savings. If your 'Needs' column secretly includes daily artisan lattes and late-night food deliveries, your wallet is crying.",
  },
  {
    emoji: "🛒",
    tag: "Impulse Control",
    title: "The 48-Hour Rule",
    fact: "About to buy something online after midnight? Put it in the cart and wait 48 hours. 70% of the time, tomorrow's sane brain asks: 'Why did I need an avocado slicer?'",
  },
  {
    emoji: "🧮",
    tag: "Mental Math",
    title: "The Magical 'Rule of 72'",
    fact: "Divide 72 by your annual interest return to see when your money doubles. At 12% returns? 72 ÷ 12 = 6 years! In a 3% savings account? 24 years. Inflation says hello.",
  },
  {
    emoji: "☕",
    tag: "Compound Growth",
    title: "The Coffee Paradox",
    fact: "Skipping coffee won't make you a millionaire. But investing ₹3,000/month at 12% turns into ~₹30 Lakhs in 20 years. Enjoy the coffee, just make sure you invest too!",
  },
  {
    emoji: "📉",
    tag: "Money Physics",
    title: "Cash in a cupboard loses weight",
    fact: "With 6% inflation, ₹1,00,000 hidden in your closet only has the purchasing power of ₹55,000 in 10 years. Cash doesn't rust, but inflation eats it alive.",
  },
  {
    emoji: "🛡️",
    tag: "Peace of Mind",
    title: "Emergency Funds > Therapy",
    fact: "Stashing 3 to 6 months of living expenses in a liquid fund turns life's sudden emergencies from full-blown panic attacks into minor inconveniences.",
  },
  {
    emoji: "💳",
    tag: "Credit Smarts",
    title: "Reward points aren't free money",
    fact: "Spending ₹5,000 on things you didn't need just to earn ₹150 in reward points is how credit card companies buy skyscrapers. Pay the full bill every month!",
  },
  {
    emoji: "⏳",
    tag: "Mindset Shift",
    title: "Price in hours, not rupees",
    fact: "That ₹6,000 jacket isn't ₹6,000. If you take home ₹500/hour, it costs 12 hours of your life. Ask yourself: 'Am I willing to work all of Tuesday just for this?'",
  },
  {
    emoji: "📈",
    tag: "Wealth Killer",
    title: "Beware of Lifestyle Creep",
    fact: "Got a 20% raise? Try not to increase your spending by 30%. The fastest hack to building wealth is pretending you're still on your old salary for one more year.",
  },
  {
    emoji: "🌱",
    tag: "Simple Wealth",
    title: "Boring investing wins the marathon",
    fact: "Over 85% of professional fund managers fail to beat simple broad index funds over 15 years. You don't need stock-picking superpowers—just steady consistency.",
  },
];

function LoadingScreen({ error, slow, onRetry, onLogout }) {
  const [tipIdx, setTipIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (error) return;
    const timer = setInterval(() => {
      setElapsed((s) => s + 1);
      setTipIdx((i) => (i + 1) % FINANCE_TIPS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [error, tipIdx]);

  const tip = FINANCE_TIPS[tipIdx];

  const handleNextTip = () => {
    setTipIdx((i) => (i + 1) % FINANCE_TIPS.length);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ink p-4 sm:p-6 text-center text-white">
      <div className="max-w-md w-full animate-fade-in space-y-5">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center">
          <div className="relative mb-3 h-16 w-16 sm:h-20 sm:w-20">
            <img
              src="/img/logo.png"
              alt="BurnRate"
              className="h-full w-full rounded-2xl sm:rounded-3xl shadow-xl shadow-leaf/25"
            />
            {!error && (
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-forest text-xs shadow-md">
                {tip.emoji}
              </span>
            )}
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">BurnRate</h1>
          <p className="text-xs text-white/50 mt-0.5">Connecting to your secure financial vault…</p>
        </div>

        {error ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-center">
            <p className="text-sm text-coral leading-relaxed">{error}</p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={onRetry}
                className="rounded-xl bg-leaf px-5 py-2.5 text-sm font-bold active:scale-95 transition hover:bg-forest"
              >
                Try again
              </button>
              <button
                onClick={onLogout}
                className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold active:scale-95 transition hover:bg-white/20"
              >
                Log In
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Informative & Humorous Personal Finance Card */}
            <div className="relative overflow-hidden rounded-2xl bg-white/[0.07] border border-white/10 p-5 text-left shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between text-xs mb-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-glow/15 px-2.5 py-0.5 text-[11px] font-bold text-glow">
                  <span>{tip.emoji}</span>
                  <span>{tip.tag}</span>
                </span>
                <span className="text-[11px] font-medium text-white/40">
                  Tip {tipIdx + 1} of {FINANCE_TIPS.length}
                </span>
              </div>

              <h2 className="font-display text-base sm:text-lg font-bold text-white mb-1.5">
                {tip.title}
              </h2>
              <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
                {tip.fact}
              </p>

              {/* Next tip interactive button */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-white/40">Auto-cycles every 5s</span>
                <button
                  type="button"
                  onClick={handleNextTip}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-glow hover:text-white transition active:scale-95"
                >
                  <span>Next tip</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            {/* Connection Status & Progress Bar */}
            <div className="space-y-2 pt-1">
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-glow transition-all duration-[4000ms] ease-linear"
                  style={{ width: `${Math.min(15 + (elapsed / 45) * 80, 92)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-white/45">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-glow animate-ping" />
                  {slow ? "Warming up engine (hang tight!)" : "Syncing server…"}
                </span>
                <span>{slow ? "~1-2 min" : "Almost ready"}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
