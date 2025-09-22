from app.src.config import DEB_IPA_PATH, SERVER_HOST, SERVER_PORT, BUNDLE_ID
import os


# debs_ipa 目录下面的一级目录是时间，年月日，格式为 YYYYMMDD，例如 20231010,每天一个一级目录
# 二级目录是环境，目前共有四种环境：debug,beta,prerelease,release
# 三级目录为版本号 如3_4_39表示3.4.39版本
# 四级子目录是按照ipa打包完成的先手顺序+时分命名，例如 001_1200,002_1215
# 五级子目录下面存放的是打包完成的ipa文件和对应的plist文件，以及打包日志文件
# 例如 debs_ipa/20231010/debug/001_1200/deb.ipa,deb.plist,build.log
# 下面开始写代码吧

# 函数：入参1：环境，debug,beta,prerelease,release
#      入参2：打包完成的ipa文件
#      入参3：打包日志文件
#       入参4：版本号
# 功能：根据服务器日期和时间，生成对应的目录，并将ipa文件保存到对应的目录下面，生成plist文件

def save_ipa_and_log_and_get_html_path(env, ipa_file_path, log_file_path, version,ipa_name):
    from datetime import datetime
    import shutil

    # 获取当前日期和时间
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    time_str = now.strftime("%H%M")

    # 构建目录路径
    date_dir = os.path.join(DEB_IPA_PATH, date_str)
    env_dir = os.path.join(date_dir, env)
    version_dir = os.path.join(env_dir, version.replace('.', '_'))

    # 确保目录存在
    os.makedirs(version_dir, exist_ok=True)

    # 计算四级目录的序号
    existing_dirs = [d for d in os.listdir(version_dir) if os.path.isdir(os.path.join(version_dir, d))]
    seq_num = len(existing_dirs) + 1
    seq_str = f"{seq_num:03d}_{time_str}"
    final_dir = os.path.join(version_dir, seq_str)
    os.makedirs(final_dir, exist_ok=True)

    # 复制ipa文件和日志文件到最终目录
    ipa_filename = os.path.basename(ipa_file_path)
    log_filename = os.path.basename(log_file_path)
    final_ipa_path = os.path.join(final_dir, ipa_filename)
    final_log_path = os.path.join(final_dir, log_filename)

    shutil.copy2(ipa_file_path, final_ipa_path)
    shutil.copy2(log_file_path, final_log_path)

    # 生成plist文件
    plist_filename = str(ipa_filename.replace('.ipa', '.plist'))
    plist_path = os.path.join(final_dir, plist_filename)
    generate_plist(env,BUNDLE_ID,version,get_full_file_url(final_ipa_path),plist_path)
    # 移除原有文件
    os.remove(ipa_file_path)
    os.remove(log_file_path)


    # 删除字符串中的点后缀
    ipa_name = ipa_filename.split('.')[0]
    # 拼接 HTML 安装页 URL
    html_url = f"http://{SERVER_HOST}:{SERVER_PORT}/install/{ipa_name}/{date_str}/{seq_str}/{env}/{version.replace('.', '_')}"
    return html_url


#生成函数或者枚举，根据环境关键词，生成plist中的title，debug中文名是集成环境，beta中文名是测试环境，prerelease中文名是准生产环境，release中文名是生产环境，前面统一加上应用名称：电e宝
def plist_title_by_env(env):
    env_dict = {
        "debug": "电e宝-集成环境",
        "beta": "电e宝-测试环境",
        "prerelease": "电e宝-准生产环境",
        "release": "电e宝-生产环境"
    }
    return env_dict.get(env, "电e宝未知环境")


    # 生成plist文件
def generate_plist(env, bundle_id, version, ipa_url, save_path):
    app_title = plist_title_by_env(env)
    plist_template = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
 "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>{ipa_url}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>{bundle_id}</string>
        <key>bundle-version</key>
        <string>{version}</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>{app_title}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>"""
    with open(save_path, "w") as f:
        f.write(plist_template)
    return save_path

# 例如访问http://服务器ip:端口/debs_ipa/20231010/debug/3_4_39/001_1200/deb.ipa
# 可以下载到对应的ipa文件
# 访问http://服务器ip:端口/debs_ipa/20231010/debug/3_4_39/001_1200/deb.plist
# 可以下载到对应的plist文件
# 访问http://服务器ip:端口/debs_ipa/20231010/debug/3_4_39/001_1200/deb.plist_url.png
# 可以下载到对应的plist文件的二维码图片
# 访问http://服务器ip:端口/debs_ipa/20231010/debug/3_4_39/001_1200/build.log
# 可以下载到对应的打包日志文件
# 访问http://服务器ip:端口/debs_ipa/20231010/debug/3_4_39/001_1200/
# 可以看到对应的目录列表
# 访问http://服务器ip:端口/debs_ipa/20231010/debug

# 写一个函数，用来获取url基础路径，方便后续和文件夹路径拼接
def get_base_url():
    return f"http://{SERVER_HOST}:{SERVER_PORT}/deb_ipa"

# 写一个函数，入参file_path是ipa/plist在服务器的完整的文件路径，函数内部的功能是，需要替换掉多余路径前缀，然后拼接上基础url，返回可供外部访问的完整的url路径，注意路径中重叠的部分
def get_full_file_url(file_local_path):
    relative_path = os.path.relpath(file_local_path, DEB_IPA_PATH)
    return f"{get_base_url()}/{relative_path.replace(os.path.sep, '/')}"
