import math
import os

from flask import Flask, jsonify, render_template, request

import calculators
from calculators import InputError

app = Flask(__name__)


def read_number(data: dict, key: str, default=None) -> float:
    """Get one number from the request body, or raise InputError.

    Never trust the frontend: anyone can send requests with curl, so the
    backend must validate every input itself.
    """
    value = data.get(key, default)
    if value is None or value == "":
        raise InputError(f"'{key}' is required.")
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise InputError(f"'{key}' must be a number.")
    if not math.isfinite(number):  # blocks "nan" and "inf"
        raise InputError(f"'{key}' must be a real number.")
    return number


def body() -> dict:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise InputError("Send a JSON object in the request body.")
    return data


@app.errorhandler(InputError)
def handle_bad_input(error):
    # Bad input is the caller's fault -> 400, not a 500 crash.
    return jsonify({"error": str(error)}), 400


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/health")
def health():
    # Hosting platforms ping a route like this to know your app is alive.
    return jsonify({"status": "ok"})


@app.post("/api/profit")
def api_profit():
    d = body()
    return jsonify(calculators.profit_percent(
        read_number(d, "buy"), read_number(d, "sell"),
        read_number(d, "quantity", 1)))


@app.post("/api/cagr")
def api_cagr():
    d = body()
    return jsonify(calculators.cagr(
        read_number(d, "start"), read_number(d, "end"), read_number(d, "years")))


@app.post("/api/future-value")
def api_future_value():
    d = body()
    return jsonify(calculators.future_value(
        read_number(d, "lump_sum", 0), read_number(d, "monthly_sip", 0),
        read_number(d, "rate"), read_number(d, "years")))


if __name__ == "__main__":
    # Local development only. In production, gunicorn imports `app` instead.
    app.run(debug=True, port=int(os.environ.get("PORT", 5000)))
