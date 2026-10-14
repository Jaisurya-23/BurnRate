"""Pure calculation functions. No Flask, no web stuff in this file.

Because these are plain functions, you can test them without a server.
BurnRate's safe-to-spend formula should live in a file just like this one.
"""


class InputError(ValueError):
    """Raised when the numbers we receive don't make sense (e.g. buy price = 0)."""


def profit_percent(buy: float, sell: float, quantity: float = 1) -> dict:
    if buy <= 0:
        raise InputError("Buy price must be greater than 0.")
    if sell < 0:
        raise InputError("Sell price cannot be negative.")
    if quantity <= 0:
        raise InputError("Quantity must be greater than 0.")

    invested = buy * quantity
    final = sell * quantity
    profit = final - invested
    return {
        "invested": round(invested, 2),
        "final_value": round(final, 2),
        "profit": round(profit, 2),
        "percent": round(profit / invested * 100, 2),
    }


def cagr(start: float, end: float, years: float) -> dict:
    """Compound Annual Growth Rate: the steady yearly return that turns
    `start` into `end` over `years`."""
    if start <= 0:
        raise InputError("Starting value must be greater than 0.")
    if end <= 0:
        raise InputError("Ending value must be greater than 0.")
    if years <= 0:
        raise InputError("Years must be greater than 0.")

    rate = (end / start) ** (1 / years) - 1
    return {
        "cagr_percent": round(rate * 100, 2),
        "total_return_percent": round((end - start) / start * 100, 2),
    }


def future_value(lump_sum: float, monthly_sip: float,
                 annual_rate_percent: float, years: float) -> dict:
    if lump_sum < 0 or monthly_sip < 0:
        raise InputError("Amounts cannot be negative.")
    if lump_sum == 0 and monthly_sip == 0:
        raise InputError("Enter a lump sum, a monthly SIP, or both.")
    if years <= 0 or years > 100:
        raise InputError("Years must be between 0 and 100.")
    if annual_rate_percent <= -100 or annual_rate_percent > 1000:
        raise InputError("Annual return must be between -100% and 1000%.")

    annual = annual_rate_percent / 100
    months = round(years * 12)
    # Effective monthly rate: compounding it 12 times equals exactly one year
    # of `annual` growth. (annual/12 would slightly overstate the result.)
    monthly = (1 + annual) ** (1 / 12) - 1

    lump_growth = lump_sum * (1 + annual) ** years
    if monthly == 0:
        sip_growth = monthly_sip * months
    else:
        # Ordinary annuity: each SIP is paid at the END of the month.
        sip_growth = monthly_sip * (((1 + monthly) ** months - 1) / monthly)

    invested = lump_sum + monthly_sip * months
    total = lump_growth + sip_growth
    return {
        "invested": round(invested, 2),
        "final_value": round(total, 2),
        "gain": round(total - invested, 2),
    }
