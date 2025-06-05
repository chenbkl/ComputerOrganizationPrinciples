

from app.config.database import Base
from sqlalchemy import Column, Integer, String, Boolean


class User(Base):
    __tablename__ = 'users'

    user_id = Column(Integer,primary_key=True,index=True)
    username = Column(String(20),index=True)
    email = Column(String(50),unique=True,index=True)
    password = Column(String(20))
    sex = Column(String(10))
    role = Column(String(10))
    mobile = Column(String(11))
    description = Column(String(100))
    grade = Column(String(10))


