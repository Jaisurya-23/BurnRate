import { useEffect, useState } from "react";
import { api } from "./api";
import { money } from "./format";
import Recorder from "./components/Recorder";
import ConfirmSheet from "./components/ConfirmSheet";
import BudgetForm from "./components/BudgetForm";
import Categories from "./components/Categories";
import ExpenseList from "./components/ExpenseList";
import AuthView from "./components/AuthView";

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

  async function refresh() {
    if (!api.getToken()) {
      setHasToken(false);
      return;
    }
    try {
      const [d, e] = await Promise.all([api.dashboard(), api.expenses()]);
      setDash(d);
      setExpenses(e);
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
    return (
      <div className="grid min-h-screen place-items-center bg-ink p-6 text-center text-white">
        <div className="max-w-xs animate-fade-in">
          <img src="/img/logo.png" alt="BurnRate" className="mx-auto h-20 w-20 rounded-2xl shadow-xl shadow-leaf/20" />
          {error ? (
            <>
              <p className="mt-4 text-sm text-coral">{error}</p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={refresh}
                  className="rounded-xl bg-leaf px-4 py-2 text-sm font-semibold active:scale-95 transition"
                >
                  Try again
                </button>
                <button
                  onClick={async () => {
                    await api.logout();
                    setHasToken(false);
                    setDash(null);
                  }}
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold active:scale-95 transition"
                >
                  Log In
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-5 flex justify-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-glow animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-glow animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full bg-glow animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="mt-3 text-sm text-white/70">
                {slow ? "Connecting to backend engine…" : "Loading BurnRate…"}
              </p>
            </>
          )}
        </div>
      </div>
    );
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
      <header className="sticky top-0 z-30 border-b border-black/5 bg-paper/90 backdrop-blur-md px-4 sm:px-6 py-3 pt-safe">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/img/logo.png" alt="BurnRate" className="h-9 w-9 rounded-xl shadow-sm" />
            <div>
              <span className="font-display text-lg font-bold tracking-tight text-ink">BurnRate</span>
              {dash.month && (
                <span className="ml-2 hidden sm:inline-block rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-leaf">
                  {dash.month}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Custom Expense Button */}
            <button
              onClick={() => setAddingCustom(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm transition active:scale-95 hover:bg-leaf"
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
