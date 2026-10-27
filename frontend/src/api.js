const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TOKEN_KEY = "burnrate_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(BASE + path, { ...options, headers });
  } catch {
    throw new Error("Can't reach the server. Is the backend running?");
  }

  if (res.status === 401) {
    setToken(null);
    let msg = "Please log in to continue.";
    try {
      const body = await res.json();
      if (body.detail) msg = body.detail;
    } catch {}
    const err = new Error(msg);
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    let msg = "Something went wrong.";
    try {
      const body = await res.json();
      msg = typeof body.detail === "string" ? body.detail : msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  // Auth
  signup: async (email, password, name) => {
    const data = await request("/auth/signup", json("POST", { email, password, name }));
    if (data.token) setToken(data.token);
    return data;
  },
  login: async (email, password) => {
    const data = await request("/auth/login", json("POST", { email, password }));
    if (data.token) setToken(data.token);
    return data;
  },
  logout: async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {}
    setToken(null);
  },
  me: () => request("/auth/me"),
  getToken,
  setToken,

  // App endpoints
  dashboard: () => request("/dashboard"),
  expenses: () => request("/expenses"),
  categories: () => request("/categories"),
  budget: () => request("/budget"),
  setBudget: (b) => request("/budget", json("PUT", b)),
  parseText: (text) => request("/parse-text", json("POST", { text })),
  voice: (blob) => {
    const form = new FormData();
    form.append("audio", blob, "recording");
    return request("/voice", { method: "POST", body: form });
  },
  saveExpenses: (items, raw_transcript) =>
    request("/expenses", json("POST", { items, raw_transcript })),
  updateExpense: (id, data) => request(`/expenses/${id}`, json("PATCH", data)),
  deleteExpense: (id) => request(`/expenses/${id}`, { method: "DELETE" }),
  // Category budgets
  getCategoryBudgets: () => request("/category-budgets"),
  setCategoryBudgets: (budgets) => request("/category-budgets", json("PUT", { budgets })),
  deleteCategoryBudget: (cat) => request(`/category-budgets/${encodeURIComponent(cat)}`, { method: "DELETE" }),
};
