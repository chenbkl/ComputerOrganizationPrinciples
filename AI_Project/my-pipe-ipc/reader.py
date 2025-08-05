# reader.py
import os
import time

fifo = "/fifo/message"  # 注意：容器内路径
if not os.path.exists(fifo):
    print(f"ERROR: {fifo} 不存在，请检查挂载")
    exit(1)

print("Container: 开始监听管道，Ctrl+C 退出")
try:
    while True:
        # open 会阻塞，直到有写端打开
        with open(fifo, "r") as f:
            for line in f:  # 读到写端 close 时，for 循环结束
                print("Container 收到:", line.rstrip())
        time.sleep(0.1)    # 小憩后，重新 open 等待下一个写端
except KeyboardInterrupt:
    print("\nContainer: 退出")

