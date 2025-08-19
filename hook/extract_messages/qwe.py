import base64
import plistlib

b64 = """BAtzdHJlYW10eXBlZIHoA4QBQISEhBlOU011dGFibGVBdHRyaWJ1dGVkU3RyaW5nAISEEk5TQXR0cmlidXRlZFN0cmluZwCEhAhOU09iamVjdACFkoSEhA9OU011dGFibGVTdHJpbmcBhIQITlNTdHJpbmcBlYQBKwFBhoQCaUkBAZKEhIQMTlNEaWN0aW9uYXJ5AJWEAWkBkoSYmB1fX2tJTU1lc3NhZ2VQYXJ0QXR0cmlidXRlTmFtZYaShISECE5TTnVtYmVyAISEB05TVmFsdWUAlYQBKoSbmwCGhoY="""

raw = base64.b64decode(b64)

# 这里先用 plistlib 解析归档的最外层 plist
plist = plistlib.loads(raw, fmt=plistlib.FMT_BINARY)

# 归档结构通常是 $objects 数组，里面混着 NSString、NSNumber 等
objects = plist.get("$objects", [])

for i, obj in enumerate(objects):
    if isinstance(obj, str):
        print(f"[{i}] {obj}")


https://github.com/frida/frida/issues/2673