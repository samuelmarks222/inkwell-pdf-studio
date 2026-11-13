"""Vercel FastAPI entrypoint — re-exports the application from api/index.py.

Vercel's FastAPI zero-config detection looks for `main:app` at the project
root. The application itself lives in api/index.py (same module the local
tooling and connector deploys use).
"""

from api.index import app

__all__ = ["app"]
