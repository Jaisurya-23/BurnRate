import { iconFor, money, prettyDate } from "../format";

export default function ExpenseList({ expenses, onEdit, onDelete }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">This month’s expenses</h2>
        {expenses.length > 0 && (
          <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-leaf">
            {expenses.length} {expenses.length === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      {expenses.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-3 py-6 text-center">
          <img src="/img/piggy.png" alt="" className="w-40 sm:w-52 rounded-2xl opacity-90" />
          <p className="text-xs sm:text-sm text-ink/65 max-w-xs">
            No expenses recorded yet. Tap the mic or type an expense above.
          </p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-black/5">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 py-3.5 transition hover:bg-paper/50 -mx-1 px-1 rounded-xl"
            >
              <img src={iconFor(e.category)} alt="" className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm sm:text-base font-semibold text-ink">{e.note || e.category}</p>
                <div className="flex items-center gap-1.5 text-xs text-ink/50 mt-0.5">
                  <span className="font-medium text-ink/70">{e.category}</span>
                  <span>•</span>
                  <span>{prettyDate(e.spent_on)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-base sm:text-lg font-bold text-ink">{money(e.amount)}</p>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <button
                    onClick={() => onEdit(e)}
                    className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-leaf hover:bg-mint active:scale-95"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => window.confirm("Delete this expense?") && onDelete(e.id)}
                    aria-label="Delete"
                    className="grid h-6 w-6 place-items-center rounded-full text-ink/40 hover:bg-coral/10 hover:text-coral active:scale-95"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
