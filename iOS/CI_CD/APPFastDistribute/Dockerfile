
FROM docker.io/python:3.10-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
COPY . .
CMD ["uvicorn", "app.src.main:app", "--host", "0.0.0.0", "--port", "8000"]