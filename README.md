# Inkwell PDF Studio

The FastAPI application entrypoint is `main.py` (`main:app`), which Vercel detects automatically.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The service responds at `/`, and `/health` provides a lightweight health check. Interactive API documentation is available at `/docs`.
