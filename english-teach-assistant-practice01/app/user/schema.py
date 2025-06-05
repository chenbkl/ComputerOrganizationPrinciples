from app.user.model import User
from pydantic import BaseModel, EmailStr, Field

class User_Register_Schema(BaseModel):
    username: str
    password: str
    email: str
    mobile: str
    nickname: str = ''
    avatar: str = ''

class User_Response_Schema(BaseModel):
    id: int
    username: str
    email: str
    mobile: str
    nickname: str
    avatar: str
    is_active: bool
    role: str

    class Config:
        orm_mode = True