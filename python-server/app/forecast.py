import os
from concurrent.futures import ThreadPoolExecutor
from typing import List, Literal
import pandas as pd
from prophet import Prophet
from pydantic import BaseModel

FORECAST_HORIZON_MONTHS = 3
MIN_HISTORY_POINTS = 6
HIGH_RISK_THRESHOLD = -20.0
MEDIUM_RISK_THRESHOLD = -5.0


class HistoryPoint(BaseModel):
    date: str
    qty: float


class ProductHistory(BaseModel):
    product_id: int
    product_name: str
    history: List[HistoryPoint]


class ForecastRequest(BaseModel):
    products: List[ProductHistory]


class ForecastPoint(BaseModel):
    date: str
    qty: float


class ProductForecast(BaseModel):
    product_id: int
    product_name: str
    history: List[HistoryPoint]
    forecast: List[ForecastPoint]
    predicted_change_percent: float
    risk: Literal["high", "medium", "low"]


class ForecastResponse(BaseModel):
    products: List[ProductForecast]


def classify_risk(change_percent: float) -> Literal["high", "medium", "low"]:
    if change_percent <= HIGH_RISK_THRESHOLD:
        return "high"
    if change_percent <= MEDIUM_RISK_THRESHOLD:
        return "medium"
    return "low"


def forecast_product(product: ProductHistory) -> ProductForecast:
    history = sorted(product.history, key=lambda point: point.date)

    if len(history) < MIN_HISTORY_POINTS:
        last_qty = history[-1].qty if history else 0.0
        flat_forecast = [
            ForecastPoint(date=point.date, qty=last_qty) for point in history[-FORECAST_HORIZON_MONTHS:]
        ]
        return ProductForecast(
            product_id=product.product_id,
            product_name=product.product_name,
            history=history,
            forecast=flat_forecast,
            predicted_change_percent=0.0,
            risk="low",
        )

    df = pd.DataFrame({
        "ds": [point.date for point in history],
        "y": [point.qty for point in history],
    })

    model = Prophet(
        yearly_seasonality=len(history) >= 24,
        weekly_seasonality=False,
        daily_seasonality=False,
    )
    model.fit(df)

    future = model.make_future_dataframe(periods=FORECAST_HORIZON_MONTHS, freq="MS")
    prediction = model.predict(future)

    future_rows = prediction.tail(FORECAST_HORIZON_MONTHS)
    forecast_points = [
        ForecastPoint(date=row.ds.strftime("%Y-%m-%d"), qty=max(0.0, round(row.yhat, 2)))
        for row in future_rows.itertuples()
    ]

    trailing_window = history[-3:]
    trailing_avg = sum(point.qty for point in trailing_window) / len(trailing_window)
    next_month_qty = forecast_points[0].qty if forecast_points else trailing_avg

    change_percent = 0.0
    if trailing_avg > 0:
        change_percent = round(((next_month_qty - trailing_avg) / trailing_avg) * 100, 2)

    return ProductForecast(
        product_id=product.product_id,
        product_name=product.product_name,
        history=history,
        forecast=forecast_points,
        predicted_change_percent=change_percent,
        risk=classify_risk(change_percent),
    )


def run_forecast(request: ForecastRequest) -> ForecastResponse:
    # Each fit spawns its own CmdStan subprocess and releases the GIL while
    # waiting on it, so a thread pool parallelizes real wall-clock time
    # across products instead of running Prophet fits one at a time.
    max_workers = min(len(request.products) or 1, (os.cpu_count() or 4) * 2)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        products = list(executor.map(forecast_product, request.products))

    return ForecastResponse(products=products)
