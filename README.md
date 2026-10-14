# Trade Calculator

A small Flask web app with three calculators for traders and investors:

- **Profit or loss:** percentage and amount for a single trade.
- **CAGR:** the steady yearly return between a starting and ending value.
- **Future value:** a lump sum plus a monthly SIP, compounded yearly.

**Live demo:** _add your Render link here after deploying_

## Project structure

```
trading-calculator/
├── app.py               # Flask routes and input validation
├── calculators.py       # Pure calculation functions (no Flask)
├── test_calculators.py  # Unit tests for the calculations
├── requirements.txt     # Python dependencies
├── .gitignore
└── templates/
    └── index.html       # Page and JavaScript (calls the API with fetch)
```

The calculations live in `calculators.py` with no web code, so they can be tested without a server and reused anywhere.

## Run locally

Requires Python 3.9 or newer.

```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py                     # dev server at http://127.0.0.1:5000
```

To run it the way production does:

```bash
gunicorn app:app                  # http://127.0.0.1:8000
```

## Run the tests

```bash
pip install pytest
python -m pytest
```

## Formulas

| Calculator | Formula |
| --- | --- |
| Profit % | (sell − buy) ÷ buy × 100 |
| CAGR | (end ÷ start)^(1 ÷ years) − 1 |
| Lump-sum growth | P × (1 + r)^years |
| SIP growth | SIP × ((1 + m)^months − 1) ÷ m, with SIP paid at the end of each month |

The monthly rate `m` is `(1 + r)^(1/12) − 1`, so twelve months of compounding equals exactly one year at the yearly rate `r`.

## API

All endpoints accept and return JSON. Invalid input returns HTTP 400 with `{"error": "..."}`.

### `GET /health`
Returns `{"status": "ok"}`. Used to check the app is running.

### `POST /api/profit`
```json
{ "buy": 100, "sell": 125, "quantity": 10 }
```
Response:
```json
{ "invested": 1000.0, "final_value": 1250.0, "profit": 250.0, "percent": 25.0 }
```
`quantity` is optional and defaults to 1.

### `POST /api/cagr`
```json
{ "start": 100000, "end": 200000, "years": 5 }
```
Response:
```json
{ "cagr_percent": 14.87, "total_return_percent": 100.0 }
```

### `POST /api/future-value`
```json
{ "lump_sum": 0, "monthly_sip": 5000, "rate": 12, "years": 10 }
```
Response:
```json
{ "invested": 600000.0, "final_value": 1109650.21, "gain": 509650.21 }
```
`lump_sum` and `monthly_sip` default to 0, but at least one must be greater than 0. `rate` is the expected yearly return in percent.

Example with curl:

```bash
curl -X POST http://127.0.0.1:5000/api/cagr \
  -H "Content-Type: application/json" \
  -d '{"start": 100000, "end": 200000, "years": 5}'
```

## Validation rules

- Buy price, starting value and ending value must be greater than 0.
- Years must be greater than 0 (and at most 100 for future value).
- Yearly return must be between -100% and 1000%.
- Values that are not real numbers (text, `nan`, `inf`) are rejected.

## Deploy on Render

1. Push this project to a GitHub repository.
2. On Render, create a new **Web Service** and connect the repository.
3. Set the build command to `pip install -r requirements.txt`.
4. Set the start command to `gunicorn app:app`.
5. Deploy, then open the service URL and check `/health`.

Free-tier services may sleep when idle, so the first request after a pause can be slow.

## Disclaimer

This tool is for learning and rough estimates. Returns are not guaranteed, and the results are not financial advice.
