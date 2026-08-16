from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="Supply Chain Digital Twin — AI Service",
    description=(
        "Prediction, Sourcing Recommendation, and Contingency Plan agents "
        "for the du SME Resilience Challenge Track 1 digital twin."
    ),
    version="0.1.0",
)


class HealthResponse(BaseModel):
    status: str
    service: str


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="ai-service")
