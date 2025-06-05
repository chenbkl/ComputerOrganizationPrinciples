from fastapi import FastAPI

app = FastAPI()
from app.user.route import router as user_router

app.include_router(user_router, prefix="/user", tags=["user"])

__main__ = "main"
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
    