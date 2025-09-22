from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi import APIRouter
from app.src.config import SERVER_HOST, SERVER_PORT,TEMPLATES

download_router = APIRouter()

@download_router.get(
    "/install/{ipa_name}/{date}/{time}/{env}/{version}",
    response_class=HTMLResponse
)
def install_page(
    request: Request,
    ipa_name: str,
    date: str,
    time: str,
    env: str,
    version: str
):
    # 拼接 plist 路径
    plist_url = f"http://{SERVER_HOST}:{SERVER_PORT}/deb_ipa/{date}/{env}/{version}/{time}/{ipa_name}.plist"
    icon_url = "/images/debicon-"+env+".png"

    return TEMPLATES.TemplateResponse("install.html", {
        "request": request,
        "app_name": ipa_name,
        "version": version.replace("_", "."),
        "env": env,
        "plist_url": plist_url,
        "icon_url": icon_url
    })