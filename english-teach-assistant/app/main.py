from fastapi import FastAPI

from app.api路由分发层.v1.endpoints import user
from app.api路由分发层.v1.endpoints import items

app = FastAPI()

app.include_router(user.router,prefix="/api/v1/users",tags=["users"])
app.include_router(items.router,prefix="/api/v1/items",tags=["items"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)