from sqlalchemy.orm import Session
from app.user用户模块.model import User
from app.user用户模块.schemas import UserCreate

def get_user(db:Session,user_id:int):
    return db.query(User).filter(User.user_id == user_id).first()

def get_users(db:Session,skip:int=0,limit:int=10):
    return db.query(User).offset(skip).limit(limit).all()

def create_user(db:Session,user:UserCreate):
    db_user = User(username=user.username,email=user.email,password=user.password,sex=user.sex,role=user.role,mobile=user.mobile,description=user.description,grade=user.grade)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user