import os
import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from Orbisporte.interfaces.api.routes import router
from Orbisporte.interfaces.api.intake_routes import router as intake_router
from Orbisporte.interfaces.api.m02_routes import router as m02_router
from Orbisporte.interfaces.api.m03_routes import router as m03_router
from Orbisporte.interfaces.api.m04_routes import router as m04_router
from Orbisporte.interfaces.api.m05_routes import router as m05_router
from Orbisporte.interfaces.api.m06_routes import router as m06_router
from Orbisporte.interfaces.api.m07_routes import router as m07_router


def _warmup_gliner():
    """Load GLiNER model in background at startup so first M02 run isn't slow."""
    try:
        from Orbisporte.domain.services.m02_extraction.entity_extractor import _load_model
        _load_model()
    except Exception:
        pass  # GLiNER is optional; failure here is non-fatal

# Security scheme for Swagger UI
security = HTTPBearer()

# Create FastAPI app
app = FastAPI(
    title="Orbisporte API",
    description="AI-Powered Indian Customs Document Processing Platform",
    version="1.0.0",
    swagger_ui_parameters={"persistAuthorization": True}
)

# Configure CORS
# JWT auth uses the Authorization header (not cookies), so allow_credentials
# is not needed.  When CORS_ORIGINS is "*" (the default) every origin is
# allowed; set CORS_ORIGINS to a comma-separated list in production to
# restrict to specific domains.
_cors_env   = os.getenv("CORS_ORIGINS", "*")
_use_wildcard = _cors_env.strip() == "*"
allow_origins = ["*"] if _use_wildcard else [o.strip() for o in _cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=not _use_wildcard,  # credentials=True incompatible with wildcard
    allow_methods=["*"],
    allow_headers=["*"],
)

# Warm up GLiNER model in background so first extraction isn't slow
threading.Thread(target=_warmup_gliner, daemon=True).start()

# Include routes
app.include_router(router)
app.include_router(intake_router)
app.include_router(m02_router)
app.include_router(m03_router)
app.include_router(m04_router)
app.include_router(m05_router)
app.include_router(m06_router)
app.include_router(m07_router)


@app.get("/")
def root():
    return {
        "message": "Welcome to Orbisporte API",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    _port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=_port)
