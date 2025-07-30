from app.user用户模块.crud import get_user as crud_get_user,get_users as crud_get_users,create_user as crud_create_user
from app.user用户模块.model import User
from app.user用户模块.schemas import UserCreate
from sqlalchemy.orm import Session

def get_user_by_id(user_id:int,db:Session):
    return crud_get_user(db=db,user_id=user_id)

def get_users(db:Session):
    return crud_get_users(db)

def create_user(user:UserCreate,db:Session):
    crud_create_user(db,user)