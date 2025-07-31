import asyncio
import edge_tts

async def show_voices():
    voices = await edge_tts.list_voices()
    for v in voices:
        print(v["ShortName"], "—", v["Locale"], v["Gender"])

asyncio.run(show_voices())

# 要生成的方言信息集合
dialects = {
    "zh-HK":    ("zh-HK-HiuMaanNeural",    "你好陈皮皮"),
    "zh-CN":    ("zh-CN-XiaoxiaoNeural",   "你好陈皮皮"),
    "zh-TW":    ("zh-TW-HsiaoChenNeural",  "你好陈皮皮"),
    "zh-CN-liaoning":("zh-CN-liaoning-XiaobeiNeural", "你好陈皮皮"),
    "zh-CN-shaanxi": ("zh-CN-shaanxi-XiaoniNeural",   "你好陈皮皮"),
}

async def gen_dialect_audio(locale, voice, text):
    tts = edge_tts.Communicate(text, voice)
    filename = f"{locale}.mp3"
    await tts.save(filename)
    print(f"✔️ 已生成：{filename}")

async def main():
    tasks = []
    for locale, (voice, chinese_name) in dialects.items():
        tasks.append(gen_dialect_audio(locale, voice, chinese_name))
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())