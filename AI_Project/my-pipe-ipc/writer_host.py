# writer_host.py
import os
import sys

fifo = os.path.join(os.getcwd(), "fifo", "message")
if not os.path.exists(fifo):
    print(f"管道不存在，请先运行: mkfifo fifo/message")
    sys.exit(1)

print("Host: 请输入消息，回车发送；Ctrl+C 退出")
try:
    while True:
        line = input()
        if not line:
            continue
        with open(fifo, "w") as f:
            f.write(line + "\n")
            f.flush()
except KeyboardInterrupt:
    print("\nHost: 退出")

