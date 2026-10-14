# Trade Calculator

A small Flask website that helps people understand returns, yearly growth and long-term investing. It has three pages:

| Page | URL | What it does |
|---|---|---|
| Calculators | `/` | Profit or loss, CAGR, and future value (lump sum + monthly SIP) |
| Learn | `/learn` | Six flip cards on key ideas, plus a "time machine" with sliders |
| Play | `/play` | Three mini games: quiz, guess the growth, Rule of 72 |

Right answers and flipped cards earn XP, shown in the nav bar. XP is saved in the visitor's browser (localStorage). There is no database or login.

> For learning only. Not financial advice. Real returns are never guaranteed.

## Project structure

```
app.py            Flask routes: 3 pages, 3 API endpoints, /health
calculators.py    Pure calculation functions (no Flask in this file)
requirements.txt  flask, gunicorn
templates/
  base.html       Shared layout and nav
  index.html      Calculators page
  learn.html      Learn page (flip cards + time machine)
  play.html       Play page (games)
static/
  style.css       Shared styles (light and dark mode)
  common.js       Shared helpers: formatting, API calls, XP, answer buttons
```

## Run locally

```bash
pip install -r requirements.txt
python app.py
```

Open http://localhost:5000

## Deploy

Use the same setup as before. The start command is:

```bash
gunicorn app:app
```

`/health` returns `{"status": "ok"}` for hosting platforms that check whether the app is alive.

## API

All endpoints take a JSON body with `POST` and return JSON. Bad input returns `400` with `{"error": "..."}`.

| Endpoint | Body | Returns |
|---|---|---|
| `/api/profit` | `buy`, `sell`, `quantity` (default 1) | `invested`, `final_value`, `profit`, `percent` |
| `/api/cagr` | `start`, `end`, `years` | `cagr_percent`, `total_return_percent` |
| `/api/future-value` | `lump_sum`, `monthly_sip`, `rate`, `years` | `invested`, `final_value`, `gain` |

Example:

```bash
curl -X POST http://localhost:5000/api/future-value \
  -H "Content-Type: application/json" \
  -d '{"lump_sum":0,"monthly_sip":5000,"rate":10,"years":10}'
```

The backend validates every input itself and never trusts the frontend. The SIP calculation assumes payments at the end of each month, with a monthly rate equivalent to the yearly rate.

## How to change things

- **Add or edit a learning card:** edit the `CARDS` list in `templates/learn.html`.
- **Add or edit a quiz question:** edit the `QUIZ` list in `templates/play.html`. Each item has `q` (question), `o` (options), `a` (index of the correct option, starting at 0) and `why` (explanation).
- **Change colours:** edit the variables at the top of `static/style.css`. Dark mode values are in the `prefers-color-scheme: dark` block.
- **Change XP rewards:** search for `addXP(` in the templates.
- **Add a new page:** add a route in `app.py`, create a template that extends `base.html`, and add a link in the nav in `base.html`.
- **Add a new calculation:** write a function in `calculators.py`, add a route in `app.py` that validates with `read_number`, and call it from the page with `post()` or `calc()`.

## Tech

Flask, plain HTML/CSS/JavaScript (no build step, no frameworks), Inter font from Google Fonts.