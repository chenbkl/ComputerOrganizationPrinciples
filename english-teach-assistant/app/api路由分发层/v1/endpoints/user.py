from fastapi import APIRouter

router = APIRouter()

@router.get("/list")
def get_users():
    return [{"username": "user1"}, {"username": "user2"}]