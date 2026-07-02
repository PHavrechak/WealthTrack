from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import get_current_user
from routers import categories, dashboard, monthly_goals, transactions

app = FastAPI(title="WealthTrack API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(monthly_goals.router)
app.include_router(dashboard.router)


@app.get("/health")
def health(user: dict = Depends(get_current_user)):
    return {"status": "ok", "user_id": user.get("sub")}
