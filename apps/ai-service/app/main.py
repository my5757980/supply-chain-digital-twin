import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator

from fastapi import FastAPI
from pydantic import BaseModel

from app.config import settings
from app.sweep import run_sweep

logger = logging.getLogger(__name__)


async def _sweep_loop() -> None:
    """Drives the sweep on a timer.

    Until this existed the agents ran only when a human invoked a script, so
    a deployed system produced no alerts at all — it looked alive and warned
    nobody. Each pass runs in a worker thread because the agent and callback
    clients are synchronous, and a slow model call must not block the health
    endpoint the platform polls to decide whether this service is alive.
    """
    interval = settings.sweep_interval_seconds
    logger.info("sweep enabled, every %ss", interval)
    while True:
        await asyncio.sleep(interval)
        try:
            outcomes = await asyncio.to_thread(run_sweep)
            logger.info("sweep finished: %d candidate(s) processed", len(outcomes))
        except Exception:  # noqa: BLE001 - the loop outlives any single failure
            logger.exception("sweep pass failed")


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    if settings.sweep_interval_seconds <= 0:
        logger.info("sweep disabled (SWEEP_INTERVAL_SECONDS unset or 0)")
        yield
        return

    task = asyncio.create_task(_sweep_loop())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="Supply Chain Digital Twin — AI Service",
    description=(
        "Prediction, Sourcing Recommendation, and Contingency Plan agents "
        "for the du SME Resilience Challenge Track 1 digital twin."
    ),
    version="0.1.0",
    lifespan=lifespan,
)


class HealthResponse(BaseModel):
    status: str
    service: str
    sweep_interval_seconds: int


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="ai-service",
        sweep_interval_seconds=settings.sweep_interval_seconds,
    )
