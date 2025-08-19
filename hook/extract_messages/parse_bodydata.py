import plistlib
import base64

# 读取 XML 格式的 inv.xml
with open("inv.xml", "rb") as f:
    data = f.read()

# 解析 plist
plist = plistlib.loads(data)

# 获取 bodyData
body_data = plist.get("bodyData")
if not body_data:
    raise ValueError("没有找到 bodyData")

# 写成二进制 bplist
with open("body.bplist", "wb") as f:
    f.write(body_data)

print("已写入 body.bplist")
