import yfinance as yf

# 下载 SPY 的历史数据，从 2000 年到今天
spy = yf.download("SPY", start="2000-01-01", end="2025-12-31")

# 打印前5行数据
print(spy.head())

# 保存为 CSV 文件
spy.to_csv("SPY_history.csv")
