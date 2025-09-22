import fastapi

app = fastapi.FastAPI()


LOCAL_PROJECT_PATH = "/path/to/your/project"  # 替换为你的项目路径
FASTLANE_PATH = "/usr/local/bin/fastlane"  # 替换为

@app.post("/build")
async def build_app(branch:str,env: str, version: str,security:bool=False):
    """
    收到服务端的请求，调用fastlane开始打包
    :param branch:
    :param env:
    :param version:
    :param security:
    :return: 
    """


    return {"message": "Build endpoint"}