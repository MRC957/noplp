FROM node:16 AS client_builder

WORKDIR /app
COPY client/package.json client/package-lock.json ./
RUN npm install

COPY client/ .
RUN npm run build


FROM python:3.10-slim

WORKDIR /app

# Install PostgreSQL client, dependencies and clean up
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    postgresql-client \
    gcc \
    python3-dev \
    libpq-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy Python requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python backend
COPY python-backend/ ./python-backend/

# Copy built React app from client_builder
COPY --from=client_builder /app/build ./client/public

# Copy data files
COPY *.json ./
COPY *.csv ./

# Set environment variables
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/karaoke
ENV FLASK_APP=python-backend/app.py
ENV REACT_APP_WEBSOCKET_SERVER=0.0.0.0:4001

EXPOSE 4001

# Command to run the Flask app
CMD ["python", "python-backend/app.py"]
