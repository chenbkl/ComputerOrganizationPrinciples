

import time
from langchain.tools import tool

@tool
def set_timer(minutes: int) -> str:
    """
    设置一个计时器，指定分钟数后提醒用户。

    Args:
        minutes (int): 计时器的分钟数。

    Returns:
        str: 提示用户计时器已设置。
    """
    if minutes <= 0:
        return "对不起，我没有听清你在说什么。您要倒计时多久?"
    print(f"计时器已设置，{minutes} 分钟后提醒您。")
    time.sleep(minutes*10)
    return "时间到！请注意查看您的计时器。"

