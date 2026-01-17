# --------- Build stage ---------
FROM python:3.11-slim-bullseye AS builder
WORKDIR /app

# Instalar dependencias de compilación
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libgl1-mesa-glx \
    libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

# Crear wheels para instalación rápida
COPY requirements.txt ./
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# --------- Production stage ---------
FROM python:3.11-slim-bullseye
WORKDIR /app

# Solo dependencias de runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    tesseract-ocr && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

# Instalar wheels pre-compilados
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Copiar código de la aplicación
COPY main.py ./

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
