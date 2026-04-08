#!/bin/bash

echo "--- Running startup.sh ---"

# Build venv if it doesn't have gunicorn
if [ ! -f /home/site/wwwroot/antenv/bin/gunicorn ]; then
    echo "Building virtual environment..."
    python3 -m venv /home/site/wwwroot/antenv
    /home/site/wwwroot/antenv/bin/pip install --upgrade pip
    /home/site/wwwroot/antenv/bin/pip install -r /home/site/wwwroot/requirements.txt
    echo "Virtual environment built."
fi

echo "Starting gunicorn..."
exec /home/site/wwwroot/antenv/bin/gunicorn \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  app.main:app \
  --bind 0.0.0.0:8181 \
  --timeout 120