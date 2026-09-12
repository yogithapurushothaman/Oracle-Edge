"""
Root entrypoint for ORACLE Edge FastAPI application.
Re-exports app and logic from backend.main.
"""

from backend.main import *

if __name__ == "__main__":
    import uvicorn
    from backend.models import init_db
    init_db()
    print("Starting ORACLE Edge Backend on http://0.0.0.0:8000 ...")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
