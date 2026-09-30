FROM python:3.12-slim

# System libs required by opencv/onnxruntime/insightface in many environments
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/app

# Install python deps first (better build caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# InsightFace models cache path (persist via volume)
ENV INSIGHTFACE_HOME=/models
ENV PYTHONUNBUFFERED=1

# Expose container port
EXPOSE 8888

# Production server
CMD ["gunicorn", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", "--bind", "0.0.0.0:8888", "--timeout", "120"]

