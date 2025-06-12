

import asyncio

async def task(name, delay):
    print(f"Task {name} started")
    await asyncio.sleep(delay)
    print(f"Task {name} finished")

async def main():
    # await asyncio.gather(
    #     task("A", 2),
    #     task("B", 1)
    # )
    print("准备开始")
    await task("A", 2),
    await task("B", 1)
    print("结束")

asyncio.run(main())