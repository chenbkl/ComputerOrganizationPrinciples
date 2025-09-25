import os
from fastapi.templating import Jinja2Templates


# server info（默认值 + 环境变量覆盖）
APP_NAME = os.getenv("APP_NAME", "电e宝")
BUNDLE_ID = os.getenv("BUNDLE_ID", "com.example.myapp")
SERVER_HOST = os.getenv("SERVER_HOST", "127.0.0.1")
SERVER_PORT = int(os.getenv("SERVER_PORT", 8000))  # 注意端口转 int

# static files path
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
# 上传目录，优先使用环境变量，否则默认走 BASE_DIR/public/debs_ipa
DEB_IPA_PATH = os.getenv("DEB_IPA_PATH", os.path.join(BASE_DIR, "public/debs_ipa"))
# 确保目录存在
os.makedirs(DEB_IPA_PATH, exist_ok=True)

# 指定模板目录（这里路径要对得上）
TEMPLATES_PATH = BASE_DIR+"/static/templates/"
IMAGE_PATH = BASE_DIR+"/static/images/"
HTML_PATH = BASE_DIR+"/static/html/"
# HTML模板引擎
TEMPLATES = Jinja2Templates(directory=TEMPLATES_PATH)