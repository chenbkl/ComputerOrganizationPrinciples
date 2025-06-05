from app.user.crud import get_all_users as db_get_all_users,get_user_by_id as db_get_user_by_id,get_user_by_username as db_get_user_by_username,create_user as db_create_user
from sqlalchemy.orm import Session

def get_user_by_id(db:Session, user_id: int):
    return db_get_user_by_id(db, user_id)

def add_user(db:Session, user_data):
    return db_create_user(db, user_data)

def get_all_users(db:Session):
    return db_get_all_users(db)