# 🔥 BurnRate

> **Voice-first, intelligent daily expense tracker with real-time category budgeting and safe-to-spend pacing.**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB.svg?style=flat&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF.svg?style=flat&logo=vite)](https://vitejs.dev)
[![TailwindCSS](https://img.shields.io/badge/Styling-TailwindCSS-38B2AC.svg?style=flat&logo=tailwind-css)](https://tailwindcss.com)
[![Neon](https://img.shields.io/badge/Database-Neon_PostgreSQL-00E599.svg?style=flat&logo=postgresql)](https://neon.tech)
[![Groq](https://img.shields.io/badge/Speech--to--Text-Groq_Whisper-F05A28.svg?style=flat)](https://groq.com)

---

## 🌟 Key Features

* **🎙️ Voice-First AI Logging**: Tap and speak naturally in English (e.g., *"120 on lunch, 50 auto and 499 for Netflix"*). Transcribed with **Groq Whisper** and parsed instantly into structured JSON.
* **⚡ Ultra-Fast Local Parser**: Zero-latency regex and keyword extraction (~0ms) eliminates slow API fallbacks and network retries.
* **📊 Per-Category Budgets**: Set spending caps on individual categories (e.g., Food: ₹3,000, Friends: ₹1,000, Transport: ₹1,500).
* **🚨 Real-Time Budget Alerts**: Automatic warnings when spending reaches **80%** (⚠️ near limit) and alerts when exceeded (🚨 over budget).
* **➕ Custom Categories & Manual Entry**: Add custom category names on the fly, pick or edit specific dates (`spent_on`), and update past expenses easily.
* **🎯 Safe-to-Spend Pacing**: Know exactly what's safe to spend today without running out before the end of the month:
  $$\text{Safe-to-Spend} = \frac{\sum(\text{Category Budgets}) - \text{Total Spent}}{\text{Days Left in Month}}$$
* **👥 Multi-User & Secure Auth**: Multi-tenant architecture with user registration, secure session tokens, and passwords hashed with `PBKDF2-HMAC-SHA256`.
* **🐘 Neon Serverless PostgreSQL**: Production-ready cloud database with connection pooling and schema isolation per user.

---

## 🏗️ Architecture & Data Flow

```text
       User Input (Voice or Text)
                  │
        [Groq Whisper API]
                  │ (transcript)
     [Local Keyword Parser (0ms)]
                  │ (JSON items)
     [Interactive Confirm Sheet] (Edit amount, category, date, note)
                  │
          [FastAPI Engine]
                  │ (scoped by user_id)
      [Neon PostgreSQL Cloud]
                  │
  [Real-Time Safe-to-Spend & Alerts]
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TailwindCSS |
| **Backend** | FastAPI, Uvicorn, SQLAlchemy 2.0, Pydantic |
| **Database** | Neon Serverless PostgreSQL (`psycopg2-binary`) |
| **Audio AI** | Groq Cloud (`whisper-large-v3-turbo`) |
| **Security** | PBKDF2-HMAC-SHA256 password hashing, Bearer Token sessions |
| **Deployment**| Frontend on Vercel, Backend on Render |

---

## 📂 Repository Structure

```text
burnrate/
├── backend/
│   ├── ai.py            # Groq Whisper integration & fast local expense parser
│   ├── auth.py          # Password hashing, token creation & get_current_user dependency
│   ├── db.py            # SQLAlchemy models (User, Expense, CategoryBudget, Session)
│   ├── main.py          # FastAPI application & API endpoints
│   ├── requirements.txt # Python dependencies
│   └── .env             # Backend secrets (DATABASE_URL, GROQ_API_KEY)
├── frontend/
│   ├── public/img/      # Premium illustration assets & icons
│   ├── src/
│   │   ├── components/  # AuthView, BudgetForm, ConfirmSheet, Recorder, Categories, ExpenseList
│   │   ├── api.js       # API client with token injection & error handling
│   │   ├── format.js    # Currency formatters, date helpers, category icons
│   │   ├── App.jsx      # Main application state & dashboard layout
│   │   └── main.jsx     # React entrypoint
│   ├── package.json     # Node dependencies
│   └── vercel.json      # Vercel SPA routing rewrites
└── .gitignore           # Protects secrets, node_modules, and virtual environments
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
* Python 3.10+
* Node.js 18+
* A free [Groq Cloud API Key](https://console.groq.com)
* A free [Neon PostgreSQL database](https://neon.tech)

---

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Copy your Neon connection string and Groq API key into backend/.env:
```

Create/update `backend/.env`:
```env
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
GROQ_API_KEY=gsk_your_groq_api_key_here
```

Start the FastAPI backend:
```bash
uvicorn main:app --reload --port 8000
```
Interactive API documentation will be live at: **[http://localhost:8000/docs](http://localhost:8000/docs)**

---

### 2. Frontend Setup

In a new terminal window:

```bash
cd frontend

# Install packages
npm install

# Start Vite dev server
npm run dev
```

Visit **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🌐 Production Deployment

### Backend (Render)
1. Go to [Render Dashboard](https://dashboard.render.com) → **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Settings:
   * **Root Directory**: `backend`
   * **Runtime**: `Python 3`
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add **Environment Variables**:
   * `DATABASE_URL`: `postgresql://...` (your Neon connection string)
   * `GROQ_API_KEY`: `gsk_...` (your Groq API key)
5. Copy your assigned Render service URL (e.g. `https://burnrate-backend.onrender.com`).

---

### Frontend (Vercel)
1. Go to [Vercel Dashboard](https://vercel.com) → **Add New…** → **Project**.
2. Import your GitHub repository.
3. Settings:
   * **Root Directory**: `frontend`
   * **Framework Preset**: `Vite`
4. Add **Environment Variable**:
   * `VITE_API_URL`: Your live Render URL (e.g. `https://burnrate-backend.onrender.com` without trailing slash).
5. Click **Deploy**.

---

## 🔒 Security Best Practices

* Passwords are never stored in plaintext. They are salted and hashed using NIST-compliant `PBKDF2-HMAC-SHA256`.
* Endpoints require authenticated Bearer tokens.
* All user queries are strictly scoped using foreign-key user constraints (`user_id`).
* Secrets (`.env`) are excluded from version control via `.gitignore`.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
