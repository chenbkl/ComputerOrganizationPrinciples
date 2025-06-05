from app.user.model import User
from app.user.schema import User_Register_Schema

def get_all_users(db):
    return db.query(User).all()

def get_user_by_id(db, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_username(db, username: str):
    return db.query(User).filter(User.username == username).first()

def create_user(db, user: User_Register_Schema):
    db_user = get_user_by_username(db, user.username)
    if db_user:
        raise ValueError("Username already exists")
    db_email = db.query(User).filter(User.email == user.email).first()
    if db_email:
        raise ValueError("Email already exists")
    db_mobile = db.query(User).filter(User.mobile == user.mobile).first()
    if db_mobile:
        raise ValueError("Mobile number already exists")
    hashed_password = user.password  # In a real application, hash the password here
    db_user = User(
        username=user.username,
        password=hashed_password,
        email=user.email,
        mobile=user.mobile,
        nickname=user.nickname,
        avatar=user.avatar
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user