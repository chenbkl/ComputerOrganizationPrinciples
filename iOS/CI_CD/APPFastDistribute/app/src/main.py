from fastapi import FastAPI
from starlette.staticfiles import StaticFiles

from app.src.config import HTML_PATH,IMAGE_PATH,DEB_IPA_PATH

from app.src.routers import download
from app.src.routers import upload



class PlistStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if path.endswith(".plist"):
            response.headers["Content-Type"] = "application/x-plist"
        return response

app = FastAPI()
# 设置路由
app.include_router(download.download_router)
app.include_router(upload.upload_router)
# 挂载静态文件目录
app.mount("/images",StaticFiles(directory=IMAGE_PATH),name="images")
app.mount("/static", StaticFiles(directory=HTML_PATH), name="static")
app.mount("/deb_ipa", PlistStaticFiles(directory=DEB_IPA_PATH), name="deb_ipa")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.src.main:app", host="127.0.0.1", port=8000, reload=True)