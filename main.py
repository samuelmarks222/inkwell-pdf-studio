"""FastAPI entrypoint for Vercel."""

from fastapi import FastAPI

app = FastAPI(
    title="Inkwell PDF Studio",
    description="The API for Inkwell PDF Studio.",
    version="0.1.0",
)


@app.get("/")
def read_root() -> dict[str, str]:
    """Return a small welcome response for the deployed service."""
    return {"name": "Inkwell PDF Studio", "status": "ok"}


@app.get("/health")
def health_check() -> dict[str, str]:
    """Expose a lightweight health check for deployment monitoring."""
    return {"status": "ok"}
