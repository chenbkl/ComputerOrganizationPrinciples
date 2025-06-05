from app.core核心配置.database import Base,engine
from app.user用户模块.model import User

Base.metadata.create_all(bind=engine)

print("数据库初始化完成")