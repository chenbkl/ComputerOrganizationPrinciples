from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker,declarative_base
import sys


SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:123456@localhost:3306/testdb"

engine = create_engine(SQLALCHEMY_DATABASE_URL,echo=True)

SessionLocal = sessionmaker(autocommit=False,autoflush=False,bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
