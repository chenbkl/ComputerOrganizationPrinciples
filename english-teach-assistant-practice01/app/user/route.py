

from app.user.services import get_user_by_id, get_all_users, add_user
from app.user.schema import User_Register_Schema
from app.user.schema import User_Response_Schema
from fastapi import APIRouter, Depends
from app.config.database import get_db
from sqlalchemy.orm import Session

router = APIRouter()

@router.get("/users/{user_id}", response_model=User_Response_Schema)
def get_user_by_id_route(user_id: int,db: Session = Depends(get_db)):
    user = get_user_by_id(db,user_id)
    if not user:
        return {"error": "User not found"}, 404
    return User_Response_Schema.from_orm(user)

@router.get("/users", response_model=list[User_Response_Schema])
def get_all_users_route(db: Session = Depends(get_db)):
    users = get_all_users(db)
    return [User_Response_Schema.from_orm(user) for user in users]


@router.post("/add", response_model=User_Response_Schema)
def create_user_route(user_data: User_Register_Schema,db: Session = Depends(get_db)):
    try:
        user = add_user(db,user_data)
        return User_Response_Schema.from_orm(user), 201
    except ValueError as e:
        return {"error": str(e)}, 400
    