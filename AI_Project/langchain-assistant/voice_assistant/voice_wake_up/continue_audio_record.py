import sounddevice as sd
import numpy as np

# 配置录音参数
sample_rate = 16000  # 16kHz 采样率
duration = 1  # 每次录音的时长（秒）

def callback(indata, frames, time, status):
    if status:
        print(f"Audio stream status: {status}")

    # 打印录音时长（以秒为单位）
    duration_sec = frames / sample_rate
    # 打印每段音频的时长
    # print(f"Received {frames} frames of audio")
    # print(f"Recording duration: {duration_sec:.4f} seconds")

    # 将音频数据传递给 Docker 容器中的 precise-engine
    process_audio(indata)

pipe_name = "/tmp/pipe"
def process_audio(audio_data):
    # 这里需要将音频数据传递给 Docker 容器
    with open(pipe_name,"wb") as pipe:
        pipe.write(audio_data)
        print(f"音频数据写入管道：{len(audio_data)} 字节")

# # 开始录音，持续运行
# with sd.InputStream(callback=callback, channels=1, samplerate=sample_rate):
#     print("录音中... 按Ctrl+C退出")
#     while True:
#         pass  # 持续执行，等待音频流输入
