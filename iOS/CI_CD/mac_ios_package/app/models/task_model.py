
# 这个类主要负责将服务端下发的打包任务进行包装，将打包参数进行存储和解析，记录打包任务的状态，打包日志等
from enum import Enum
from typing import List, Optional
from dataclasses import dataclass, field

class TaskStatus(str, Enum):
    PENDING = "pending"     # 等待中
    RUNNING = "running"     # 进行中
    SUCCESS = "success"     # 成功
    FAILED = "failed"       # 失败
    CANCELLED = "cancelled" # 已取消

@dataclass
class BuildTask:
    id: str
    scheme: str
    configuration: str
    export_method: str
    status: TaskStatus = TaskStatus.PENDING
    log: List[str] = field(default_factory=list)
    process: Optional[int] = None  # subprocess pid