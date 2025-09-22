import os
from fastapi import APIRouter, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
from app.src.services.receive_ipa_and_send_ding import save_ipa_and_log_and_get_html_path
from datetime import datetime
upload_router = APIRouter()

# 上传 ipa + log
@upload_router.post("/upload")
async def upload_ipa(
    app_name: str = Form(..., description="应用名称，例如 deb"),
    env: str = Form(..., description="环境：debug/beta/prerelease/release"),
    version: str = Form(..., description="版本号，例如 3.4.39"),
    ipa_file: UploadFile = Form(...),
    log_file: UploadFile = Form(...)
):
    # 检查环境参数合法性
    if env not in ["debug", "beta", "prerelease", "release"]:
        raise HTTPException(status_code=400, detail="环境参数错误")

    # 临时存储目录
    temp_dir = Path("tmp_uploads")
    temp_dir.mkdir(parents=True, exist_ok=True)

    # 时间后缀（例如 "0916_1530"）
    timestamp = datetime.now().strftime("%m%d_%H%M")
    # 构造带后缀的文件名
    ipa_name = f"{Path(ipa_file.filename).stem}_{timestamp}{Path(ipa_file.filename).suffix}"
    log_name = f"{Path(log_file.filename).stem}_{timestamp}{Path(log_file.filename).suffix}"

    # 保存临时 ipa 和 log
    ipa_path = temp_dir / ipa_name
    log_path = temp_dir / log_name

    with open(ipa_path, "wb") as f:
        f.write(await ipa_file.read())

    with open(log_path, "wb") as f:
        f.write(await log_file.read())

    # 调用已有逻辑保存文件并生成 plist url
    html_url = save_ipa_and_log_and_get_html_path(
        env=env,
        ipa_file_path=str(ipa_path),
        log_file_path=str(log_path),
        version=version,
        ipa_name=ipa_name
    )

    return JSONResponse({
        "status": "success",
        "env": env,
        "version": version,
        "html_url": html_url
    })