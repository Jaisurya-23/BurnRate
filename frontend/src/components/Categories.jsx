import { iconFor, money } from "../format";

export default function Categories({ data, categoryBudgets = {} }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
      <h2 className="font-display text-lg font-bold">Where it went</h2>
      {data.length === 0 ? (
        <p className="mt-3 text-xs sm:text-sm text-ink/60">Nothing spent yet this month.</p>
      ) : (
        <ul className="mt-4 space-y-3.5">
          {data.map((c) => {
            const limit = categoryBudgets[c.category] || c.budget || 0;
            const budgetPct = limit > 0 ? Math.min(Math.round((c.total / limit) * 100), 100) : 0;
            const isOver = limit > 0 && c.total >= limit;
            const isWarning = limit > 0 && c.total >= limit * 0.8 && !isOver;

            return (
              <li key={c.category} className="flex items-center gap-3">
                <img src={iconFor(c.category)} alt="" className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="font-semibold text-ink flex items-center gap-1.5">
                      {c.category}
                      {isOver && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-coral/15 px-1.5 py-0.5 text-[10px] font-bold text-coral animate-pulse">
                          🚨 Over
                        </span>
                      )}
                      {isWarning && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                          ⚠️ Near
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-ink/70">
                      {money(c.total)}
                      {limit > 0 && (
                        <span className={`ml-1 text-[10px] ${isOver ? "text-coral" : "text-ink/40"}`}>
                          / {money(limit)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-mint">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOver ? "bg-coral" : isWarning ? "bg-amber-400" : "bg-leaf"
                      }`}
                      style={{ width: `${limit > 0 ? budgetPct : Math.min(c.percent, 100)}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
