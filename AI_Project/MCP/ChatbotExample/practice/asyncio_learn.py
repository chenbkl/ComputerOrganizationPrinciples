

import asyncio

async def task(name, delay):
    print(f"Task {name} started")
    await asyncio.sleep(delay)
    print(f"Task {name} finished")


if __name__ == "__main__":
    task = asyncio.run(task("A", 2))
    print("Task created:", task)