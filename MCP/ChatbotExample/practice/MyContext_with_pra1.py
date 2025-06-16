import asyncio


class MyContext:

    def __init__(self, session:str):
        self.session = session
        print("MyContext被实例化")

    def __enter__(self):
        print("进入了with作用域？")


    def __exit__(self, exc_type, exc_val, exc_tb):
        print("离开了with作用域？")
        pass

    async def __aenter__(self):
        await asyncio.sleep(1)
        print("异步进入了with作用域？")

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await asyncio.sleep(1)
        print("异步离开了with作用域？")
        pass

async def createContext():
    return MyContext("")

async def main():
    async with await createContext() as session:
        print("with 第一行")
        print("with中的逻辑被执行完毕")

if __name__ == "__main__":
    asyncio.run(main())