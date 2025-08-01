from voice_assistant.voice_wake_up.continue_audio_record import duration
import os
import subprocess
import sounddevice as sd
import numpy as np
import time
import sys

pipe_name = "/tmp/pipe"
docker_container_name = "precise-engine"
docker_image = "mycroft-precise:arm64"

model_file = "mike-test.pb"
sample_rate = 16000
duration=1

# 1. 检查并创建命名管道
def create_pipe():
    # 获取管道所在的目录
    pipe_dir = os.path.dirname(pipe_name)

    # 如果目录不存在，先创建目录
    if not os.path.exists(pipe_dir):
        try:
            os.makedirs(pipe_dir)  # 创建目录
            print(f"目录 {pipe_dir} 创建成功。")
        except OSError as e:
            print(f"创建目录失败: {e}")
            return

    # 创建命名管道
    if not os.path.exists(pipe_name):
        try:
            os.mkfifo(pipe_name)  # 创建命名管道
            print(f"命名管道 {pipe_name} 创建成功。")
        except OSError as e:
            print(f"创建命名管道失败: {e}")
    else:
        print(f"命名管道 {pipe_name} 已存在。")

# 2. 检查并启动 Docker 容器
def start_docker_container():
    try:
        result = subprocess.run(
            ["docker", "ps", "-q", "-f", f"name={docker_container_name}"],
            capture_output=True,
            text=True
        )
        if result.stdout.strip():  # 如果容器已经在运行
            print("Docker 容器已经在运行，跳过启动。")
        else:
            print("启动 Docker 容器...")
            container_run = subprocess.run([
                "docker", "run", "-d", "--name", docker_container_name,
                "-v", f"{pipe_name}:{pipe_name}",
                docker_image,
                "/opt/precise/precise-engine/precise-engine",
                "/opt/precise/mike-test.pb", "0.5",
                "<", pipe_name  # 从管道读取音频数据
            ], capture_output=True, text=True)

            if container_run.returncode != 0:
                print(f"启动 Docker 容器失败：{container_run.stderr}")
                sys.exit(1)  # 如果启动失败，立即退出
            else:
                print(f"Docker 容器启动成功! 容器 ID: {container_run.stdout.strip()}")
                print("正在监视 Docker 容器日志...")
                monitor_container_logs(docker_container_name)

    except Exception as e:
        print(f"启动 Docker 容器失败: {e}")
        sys.exit(1)  # 出现错误，立即退出程序



# 监听容器日志并检查容器是否正常运行
def monitor_container_logs(container_name):
    try:
        while True:
            # 获取容器的最新日志
            logs = subprocess.check_output(
                ["docker", "logs", "--tail", "10", container_name],  # 获取容器最后 10 行日志
                text=True
            )
            if logs:
                print(logs)  # 打印容器日志
            time.sleep(5)  # 每 5 秒获取一次日志
    except subprocess.CalledProcessError as e:
        print(f"获取容器日志时出错: {e}")
        sys.exit(1)  # 如果获取日志出错，退出程序

# 3. 录音并传输音频数据到管道
def process_audio(audio_data):
    with open(pipe_name, 'wb') as pipe:
        pipe.write(audio_data.tobytes())
        print(f"音频数据写入管道：{len(audio_data)} 字节")

def callback(indata, frames, time, status):
    if status:
        print(status)
    process_audio(indata)

# 4. 启动录音并自动传输数据
def start_recording():
    with sd.InputStream(callback=callback, channels=1, samplerate=sample_rate):
        print("录音中... 按Ctrl+C退出")
        while True:
            time.sleep(0.1)  # 程序持续运行，避免 CPU 占用过高

# 运行自动化流程
def main():
    create_pipe()  # 创建管道
    start_recording()  # 启动录音并传输音频数据
    start_docker_container()  # 启动 Docker 容器

if __name__ == "__main__":
    main()