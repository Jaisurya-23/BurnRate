import pytest
from calculators import InputError, cagr, future_value, profit_percent


def test_profit_percent():
    r = profit_percent(100, 125, 10)
    assert r["profit"] == 250 and r["percent"] == 25


def test_loss_is_negative():
    assert profit_percent(200, 150)["percent"] == -25


def test_cagr_doubling_in_5_years():
    assert cagr(100000, 200000, 5)["cagr_percent"] == 14.87


def test_future_value_lump_sum_only():
    assert future_value(100000, 0, 10, 2)["final_value"] == 121000


def test_future_value_zero_rate_sip():
    assert future_value(0, 1000, 0, 1)["final_value"] == 12000


@pytest.mark.parametrize("call", [
    lambda: profit_percent(0, 10),
    lambda: cagr(0, 10, 5),
    lambda: cagr(10, 20, 0),
    lambda: future_value(0, 0, 10, 5),
])
def test_bad_input_raises(call):
    with pytest.raises(InputError):
        call()
