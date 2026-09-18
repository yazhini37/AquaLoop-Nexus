from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.health import router as health_router
from app.routes.analysis import router as analysis_router
from app.routes.recovery import router as recovery_router
from app.routes.simulator import router as simulator_router

app = FastAPI(title="AquaLoop Nexus API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(simulator_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(recovery_router, prefix="/api")
