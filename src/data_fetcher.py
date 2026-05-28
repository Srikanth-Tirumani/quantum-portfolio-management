import yfinance as yf
import pandas as pd
import numpy as np
import os

# ── NSE India IT Stocks Dataset ──────────────────────────────────────
# Path to the local CSV file containing NSE Top 10 IT stock price data
NSE_CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "nse_it_stocks.csv")

# Stock metadata for NSE India IT stocks
NSE_STOCK_INFO = {
    "TCS":      {"name": "Tata Consultancy Services", "sector": "IT Services"},
    "INFY":     {"name": "Infosys",                   "sector": "IT Services"},
    "WIPRO":    {"name": "Wipro",                     "sector": "IT Services"},
    "HCLTECH":  {"name": "HCL Technologies",          "sector": "IT Services"},
    "TECHM":    {"name": "Tech Mahindra",             "sector": "IT Services"},
    "LTI":      {"name": "Larsen & Toubro Infotech",  "sector": "IT Services"},
    "MINDTREE": {"name": "MindTree",                  "sector": "IT Services"},
    "OFSS":     {"name": "Oracle Financial Services", "sector": "IT Services"},
    "MPHASIS":  {"name": "Mphasis",                   "sector": "IT Services"},
    "LTTS":     {"name": "L&T Technology Services",   "sector": "IT Services"},
}


def load_nse_csv(csv_path=NSE_CSV_PATH):
    """
    Loads the NSE India IT Stock Price CSV dataset.

    Dataset columns:
        Symbol      - Unique stock identifier (e.g., TCS, INFY)
        Series      - Market type (EQ = Equity, BL = Block)
        Date        - Trading date
        Prev Close  - Previous closing price (INR)
        Open Price  - Today's open price (INR)
        High Price  - Today's high price (INR)
        Low Price   - Today's low price (INR)
        Last Price  - Last bid price (INR)
        Close Price - Final closing price (INR)
        Average Price - Average trading price for the day (INR)

    Returns:
        pd.DataFrame: Raw multi-stock NSE dataset indexed by Date.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"NSE CSV not found at: {csv_path}")

    df = pd.read_csv(csv_path)

    # Standardize column names
    df.columns = df.columns.str.strip()

    # Parse dates — handle formats like '5-Mar-19' and 'YYYY-MM-DD'
    df['Date'] = pd.to_datetime(df['Date'], dayfirst=True)

    # Filter to equity market only (exclude block deals, etc.)
    df = df[df['Series'] == 'EQ'].copy()

    df.sort_values(['Symbol', 'Date'], inplace=True)
    df.reset_index(drop=True, inplace=True)

    print(f"[NSE CSV] Loaded {len(df)} rows | Symbols: {df['Symbol'].unique().tolist()}")
    return df


def get_nse_close_prices(symbols=None, csv_path=NSE_CSV_PATH):
    """
    Returns a pivot table of Close Prices from the NSE CSV.

    Args:
        symbols (list|None): Filter to specific tickers. None = all.
        csv_path (str): Path to the NSE CSV file.

    Returns:
        pd.DataFrame: DataFrame with Date as index, stock symbols as columns.
        pd.DataFrame: Daily returns computed from close prices.
    """
    df = load_nse_csv(csv_path)

    if symbols:
        df = df[df['Symbol'].isin(symbols)]

    prices = df.pivot_table(index='Date', columns='Symbol', values='Close Price')
    prices.sort_index(inplace=True)
    prices.dropna(inplace=True)

    returns = prices.pct_change().dropna()
    print(f"[NSE CSV] Price matrix: {prices.shape} | Returns: {returns.shape}")
    return prices, returns


def get_nse_stock_summary(csv_path=NSE_CSV_PATH):
    """
    Generates a per-stock summary from the NSE CSV with key financial metrics.

    Returns:
        dict: {symbol: {name, sector, price, change, high, low, sharpe, volatility, history}}
    """
    prices, returns = get_nse_close_prices(csv_path=csv_path)

    summary = {}
    for symbol in prices.columns:
        col_prices = prices[symbol].dropna()
        col_returns = returns[symbol].dropna()

        if len(col_prices) < 2:
            continue

        current_price = float(col_prices.iloc[-1])
        prev_price    = float(col_prices.iloc[-2])
        change        = ((current_price - prev_price) / prev_price) * 100

        info = NSE_STOCK_INFO.get(symbol, {"name": symbol, "sector": "IT Services"})

        summary[symbol] = {
            "name":       info["name"],
            "sector":     info["sector"],
            "exchange":   "NSE India",
            "currency":   "INR",
            "price":      round(current_price, 2),
            "change":     round(change, 2),
            "high_52w":   round(float(col_prices.max()), 2),
            "low_52w":    round(float(col_prices.min()), 2),
            "avg_return": round(float(col_returns.mean() * 100), 4),
            "volatility": round(float(col_returns.std() * 100), 4),
            "sharpe":     round(float((col_returns.mean() / col_returns.std()) * np.sqrt(252)), 2)
                          if col_returns.std() > 0 else 0,
            "history": {
                "dates":  col_prices.index.strftime('%Y-%m-%d').tolist()[-60:],
                "prices": [round(p, 2) for p in col_prices.values[-60:]]
            }
        }

    return summary


# ── Yahoo Finance Fetcher (existing — for US stocks) ──────────────────

def fetch_financial_data(tickers, start_date, end_date):
    """
    Fetches historical stock prices from Yahoo Finance and calculates daily returns.

    Args:
        tickers (list): List of ticker symbols (e.g., ['AAPL', 'MSFT', 'GOOGL']).
        start_date (str): Start date string (e.g., '2020-01-01').
        end_date (str): End date string (e.g., '2023-01-01').

    Returns:
        pd.DataFrame: A DataFrame of daily closing prices.
        pd.DataFrame: A DataFrame of daily returns.
    """
    print(f"Fetching data for {len(tickers)} tickers from {start_date} to {end_date}...")

    # Download adjusted closing prices
    data = yf.download(tickers, start=start_date, end=end_date, progress=False)

    # yfinance sometimes returns a MultiIndex column. Extract 'Adj Close' or 'Close'.
    if isinstance(data.columns, pd.MultiIndex):
        if 'Adj Close' in data.columns.levels[0]:
            prices = data['Adj Close']
        else:
            prices = data['Close']
    else:
        prices = data

    # Drop any rows with missing data
    prices = prices.dropna()

    # Calculate daily simple returns
    returns = prices.pct_change().dropna()

    print(f"Fetched {len(prices)} days of data.")
    return prices, returns


if __name__ == "__main__":
    # ── Test NSE CSV Loader ──────────────────────────────────────────
    print("=" * 55)
    print("  NSE India IT Stocks — Dataset Test")
    print("=" * 55)

    prices, returns = get_nse_close_prices()
    print("\n📈 Close Prices (last 5 rows):")
    print(prices.tail())

    print("\n📉 Daily Returns (last 5 rows):")
    print(returns.tail())

    summary = get_nse_stock_summary()
    for sym, info in summary.items():
        print(f"\n  {sym}: ₹{info['price']} | Change: {info['change']}% | Sharpe: {info['sharpe']}")

    # ── Test Yahoo Finance Fetcher ───────────────────────────────────
    print("\n" + "=" * 55)
    print("  Yahoo Finance — US Stocks Test")
    print("=" * 55)
    tks = ["AAPL", "MSFT", "GOOGL"]
    p, r = fetch_financial_data(tks, "2022-01-01", "2023-01-01")
    print("\nPrices head:")
    print(p.head())
    print("\nReturns head:")
    print(r.head())
