import asyncio
import time


async def task_created(name,delay):
    print(f"Task {name} started")
    # await asyncio.sleep(delay)
    for i in range(1000):
        if i % 100 == 0:
            print(f"Task {name} execute at {i}")

    print(f"Task {name} completed after {delay} seconds")
    return f"{name} is done"


async def gather_main():
    await asyncio.gather(
        task_created("A", 2),
        task_created("B", 1)
    )


async def main():
    task_obj1 = asyncio.create_task(task_created("A", 1))
    task_obj2 = asyncio.create_task(task_created("B", 2))
    print(task_obj1)
    print(task_obj2)
    print("task_obj1 and task_obj2 都放进时间循环了")
    # result1 = await task_obj1
    # result2 = await task_obj2
    print("task_obj1 and task_obj2 都执行完了")
    time.sleep(2)
    print("睡完觉了")

    # print(task_obj1)
    # print(task_obj2)
    # print(result1)
    # print(result2)

asyncio.run(main())
# asyncio.run(gather_main())
print("All tasks completed")