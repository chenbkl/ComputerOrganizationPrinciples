from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.user用户模块.schemas import UserCreate
from app.user用户模块.service import get_user_by_id,get_users,create_user
from app.core核心配置.database import get_db


router = APIRouter()

@router.get("/query_by_id")
def query_by_id(user_id:int,db:Session=Depends(get_db)):
    return get_user_by_id(user_id=user_id,db=db)

@router.get("/all")
def all_users(db:Session=Depends(get_db)):
    return get_users(db=db)

@router.post("/add")
def add_user(user:UserCreate,db:Session=Depends(get_db)):
    return create_user(user,db=db)