from http.client import responses

from anthropic import Anthropic
from mcp import ClientSession,StdioServerParameters,types
from mcp.client.stdio import stdio_client
from typing import List, Dict, Any
import asyncio
import nest_asyncio


nest_asyncio.apply()


class MCPChatBot:

    def __init__(self):
        self.session:ClientSession = None
        self.anthropic = Anthropic()
        self.available_tools: List[Dict[str, Any]] = []


    async def process_query(self,query):
        messages = {
            "role": "user",
            "content": query
        }
        response = self.anthropic.messages.create(
            model="claude-3-7-sonnet-20250219",
            messages=messages,
            tools=self.available_tools,
            tool_choice="auto",
        )
        process_query_flag = True
        while process_query_flag:
            assistant_content = []
            user_tools_content = []
            for content in response.content:
                if content.type == "text":
                    assistant_content.append(content.text)
                    if len(response.content) == 1:
                        process_query_flag = False
                elif content.type == "tool_user":
                    user_tools_content.append(content)

                    tool_id = content.id
                    tool_name = content.name
                    tool_args = content.args

                    result = execute_tool(tool_name, tool_args)
                    user_tools_content.append({"type": "tool_result", "id": tool_id, "result": result})

            messages = messages.append({
                "role": "assistant",
                "content": assistant_content,
            })
            messages = messages.append({
                "role": "tool_user",
                "content": user_tools_content,
            })
            response = self.anthropic.messages.create(
                model="claude-3-7-sonnet-20250219",
                messages=messages,
                tools=self.available_tools,
                tool_choice="auto",
            )


    async def chat_loop(self):
        print("Welcome to the MCP Client! Type 'exit' to quit.")
        while True:
            try:
                user_input = input("Query: ")
                if user_input.lower() == "exit":
                    break
                await self.process_query(user_input)
            except Exception as e:
                print("An error occurred:", str(e))

    async def connect_to_server_and_run(self):
        server_params = StdioServerParameters(
            command="uv",
            args=["run", "mcp_server.py"],
        )

        async with stdio_client(server_params) as (read,write):
            async with ClientSession(read,write) as session:
                self.session = session

                await session.initialize()

                response = await session.list_tools()
                tools = response.tools

                self.available_tools = [{
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.inputSchema
                } for tool in tools]

                await self.chat_loop()


async def main():
    chatbot = MCPChatBot()
    await chatbot.connect_to_server_and_run()

