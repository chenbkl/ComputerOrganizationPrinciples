from pydantic import BaseModel,EmailStr

class UserCreate(BaseModel):
    username:str
    email:EmailStr
    password:str
    sex:str
    role:str
    mobile:str
    description:str
    grade:str

class UserResponse(BaseModel):
    user_id:int
    username:str
    email:EmailStr
    sex:str
    role:str
    mobile:str
    description:str
    grade:str
    is_active:bool