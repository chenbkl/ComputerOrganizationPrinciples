from threading import Event
from precise_runner import PreciseRunner, PreciseEngine
import os
import argparse

class PipeStream:
    """从指定的管道读取音频数据流"""
    def __init__(self, pipe_name='/tmp/pipe', chunk_size=2048):
        self.chunk_size = chunk_size
        self.pipe_name = pipe_name
        self.write_event = Event()
        self.buffer = b''  # 用来存储从管道中读取的数据

        # 检查管道是否存在
        if not os.path.exists(self.pipe_name):
            raise FileNotFoundError(f"管道 {self.pipe_name} 不存在!")

    def __len__(self):
        return len(self.buffer)

    def read(self, n=-1, timeout=None):
        """
        从指定管道读取数据，直到达到 chunk_size。
        需要确保数据格式符合 PreciseEngine 的要求。
        """
        if n == -1:
            n = self.chunk_size

        # 如果缓冲区里没有足够的数据，阻塞直到读取到足够的字节
        while len(self.buffer) < n:
            with open(self.pipe_name, 'rb') as pipe:
                data = pipe.read(n - len(self.buffer))  # 从管道读取数据
                if not data:
                    return b''  # 如果没有数据，返回空字节流
                self.buffer += data

        # 返回所需大小的数据
        chunk = self.buffer[:n]
        self.buffer = self.buffer[n:]
        return chunk

    def write(self, s):
        """从管道中写入数据（这里没有用到）"""
        self.buffer += s
        self.write_event.set()


parse = argparse.ArgumentParser(description="从命名管道读取音频数据流并进行唤醒词检测")
parse.add_argument("pipe_name", help="命名管道的路径")
args = parse.parse_args()
pipeName = args.pipe_name


# 创建 PipeStream 实例，准备从管道中读取数据
stream = PipeStream(pipe_name=pipeName,chunk_size=2048)

# 初始化 PreciseEngine 和 PreciseRunner
model_file = "/opt/precise/mike-test.pb"  # 替换为你自己的模型文件路径
exe_file = "/opt/precise/precise-engine/precise-engine"  # 替换为 precise-engine 路径
engine = PreciseEngine(exe_file, model_file)

def on_activation():
    print("唤醒词检测到！")

# 使用自定义的 PipeStream 作为音频源
runner = PreciseRunner(engine, stream=stream, on_activation=on_activation)
# 启动唤醒词检测
runner.start()
