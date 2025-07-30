import asyncio
from http.client import responses
from pyexpat.errors import messages

from mcp import ClientSession,StdioServerParameters,stdio_client
from typing import Dict,List,Any
from anthropic import Anthropic

from mcp_client import server_params


class ChatBotP3:
    def __init__(self):
        self.avaliable_tools:List[Dict[str:Any]] = []
        self.session:ClientSession = None
        self.client:Anthropic = Anthropic()

    async def process_query(self,query:str):
        messages = [{
            "role":"user",
            "content":query,
        }]
        response = self.client.messages.create(messages=messages,
                                               tools=self.avaliable_tools,
                                               model="",
                                               max_tokens=2024)
        _process_query_flag = True
        while _process_query_flag:
            assistant_content = []
            user_content = []
            for content in response.content:
                if content.type == "text":
                    assistant_content.append(content)
                    if len(assistant_content) == 1:
                        _process_query_flag = False
                elif content.type == "tool_use":
                    assistant_content.append(content)
                    tool_id = content.id
                    tool_name = content.name
                    tool_args = content.input
                    result = await self.session.call_tool(tool_name,tool_args)
                    user_content.append({
                        "type":"tool_result",
                        "tool_id":tool_id,
                        "content":result,
                    })
            messages.append({
                "role":"assistant",
                "content":assistant_content,
            })
            messages.append({
                "role":"user",
                "content":user_content,
            })
            response = self.client.messages.create(model="", messages=messages, tools=self.avaliable_tools, max_tokens=2024)

    async def chat_loop(self):

        while True:
            try:
                query = input("\nQuery：").strip()
                if query == "exit":
                    break
                await self.process_query(query)

            except Exception as e:
                print(e)

    async def connect_server_and_run(self):
        server_params = StdioServerParameters(
            command="uv",
            args=["run","mcp_server.py"]
        )
        async with stdio_client(server_params) as (reader, writer):
            async with ClientSession(reader,writer) as session:
                self.session = session
                await session.initialize()
                tools_response = await session.list_tools()
                tools = tools_response.tools
                self.avaliable_tools = [
                    {
                        "name":tool.name,
                        "description":tool.description,
                        "parameters":tool.inputSchema,
                    }
                    for tool in tools
                ]
                await self.chat_loop()


if __name__ == "__main__":
    chat_bot = ChatBotP3()
    asyncio.run(chat_bot.connect_server_and_run())
