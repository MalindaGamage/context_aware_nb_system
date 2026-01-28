from fastapi import FastAPI

app = FastAPI(title="NBA Recommender", version="1.0.0")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/v1/recommendations")
def recommendations(user_id: str):
    # Placeholder: rule-based scoring to be implemented
    return []