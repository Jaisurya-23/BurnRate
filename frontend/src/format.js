export const CATEGORIES = ["Food", "Groceries", "Transport", "Rent", "Fun", "Bills", "Shopping", "Health", "Friends", "Other"];

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const money = (n) => (n < 0 ? "-₹" : "₹") + inr.format(Math.abs(Math.round(n || 0)));

const ICONS = {
  Food: "/img/cat-food.png",
  Groceries: "/img/cat-groceries.png",
  Transport: "/img/cat-transport.png",
  Rent: "/img/cat-rent.png",
  Fun: "/img/cat-fun.png",
};
export const iconFor = (cat) => ICONS[cat] || "/img/ic-wallet.png";

export function prettyDate(iso) {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
