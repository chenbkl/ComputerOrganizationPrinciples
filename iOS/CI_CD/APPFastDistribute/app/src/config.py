import os
from fastapi.templating import Jinja2Templates


# server info
APP_NAME = "电e宝"
BUNDLE_ID = "com.example.myapp"
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8000

# static files path
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# 指定模板目录（这里路径要对得上）
DEB_IPA_PATH = os.path.join(BASE_DIR, 'public/debs_ipa')
TEMPLATES_PATH = BASE_DIR+"/static/templates/"
IMAGE_PATH = BASE_DIR+"/static/images/"
HTML_PATH = BASE_DIR+"/static/html/"
# HTML模板引擎
TEMPLATES = Jinja2Templates(directory=TEMPLATES_PATH)