import Foundation

// 你的 base64 数据
let base64 = """
BAtzdHJlYW10eXBlZIHoA4QBQISEhBlOU011dGFibGVBdHRyaWJ1dGVkU3RyaW5nAISEEk5TQXR0cmlidXRlZFN0cmluZwCEhAhOU09iamVjdACFkoSEhA9OU011dGFibGVTdHJpbmcBhIQITlNTdHJpbmcBlYQBKwFBhoQCaUkBAZKEhIQMTlNEaWN0aW9uYXJ5AJWEAWkBkoSYmB1fX2tJTU1lc3NhZ2VQYXJ0QXR0cmlidXRlTmFtZYaShISECE5TTnVtYmVyAISEB05TVmFsdWUAlYQBKoSbmwCGhoY=
"""

// 解 Base64
guard let data = Data(base64Encoded: base64) else {
    fatalError("Base64 decode failed")
}

// 用 NSKeyedUnarchiver 反序列化
do {
    let obj = try NSKeyedUnarchiver.unarchiveTopLevelObjectWithData(data)
    print("解码结果：\(obj ?? "nil")")
} catch {
    print("解码失败: \(error)")
}
