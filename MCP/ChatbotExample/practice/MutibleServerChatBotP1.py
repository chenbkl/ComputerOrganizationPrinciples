from contextlib import AsyncExitStack

from anthropic import Anthropic
from typing import List, Dict, Any
from mcp import ClientSession,stdio_client
import json


class MutibleServerChatBotP1:

    def __init__(self, topic):
        self.name = "MutibleServerChatBotP1"
        self.version = "1.0"
        self.topic = topic
        self.greeting = f"Hello! I am {self.name}. How can I assist you with {self.topic} today?"

        self.llm = Anthropic()
        self.sessions:List[ClientSession] = []  # Store sessions for different servers
        self.toolName_session_mapping:Dict[str,ClientSession] = {}
        self.available_tools:List[Dict[str, Any]] = []
        self.resource_stack = AsyncExitStack()

    async def process_query(self, query):
        messages = [{"role": "user", "content": query}]
        response = self.llm.messages.create(
            model="claude-3-7-sonnet-20250219",
            messages=messages,
            tools=self.available_tools,
            max_tokens=2024
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
                elif content.type == "tool_use":
                    assistant_content.append(content)
                    tool_id = content.id
                    tool_name = content.name
                    tool_args = content.input

                    # Get the session for the specific tool name
                    session = self.toolName_session_mapping.get(tool_name)
                    if not session:
                        raise ValueError(f"No session found for tool name: {tool_name}")

                    # Here you would execute the tool and get the result
                    result = await session.call_tool(tool_name, arguments=tool_args)
                    user_tools_content.append({"type": "tool_result", "tool_use_id": tool_id, "content": result})

            messages.append({
                "role": "assistant",
                "content": assistant_content,
            })
            messages.append({
                "role": "user",
                "content": user_tools_content,
            })

            response = self.llm.messages.create(
                model="claude-3-7-sonnet-20250219",
                messages=messages,
                tools=self.available_tools,
                max_tokens=2024
            )

    async def chat_loop(self):
        """
        Starts the chat loop for the chatbot.
        """
        print(self.greeting)
        while True:
            user_input = input("You: ")
            if user_input.lower() in ["exit", "quit"]:
                print("Exiting chat...")
                break
            await self.process_query(user_input)
            print("ChatBot:", self.llm.messages[-1].content)

    async def connect_single_server(self,server_name,server_params):
        reader,writer = await self.resource_stack.enter_async_context(stdio_client(server_params))
        session = await self.resource_stack.enter_async_context(ClientSession(reader,writer))
        self.sessions.append(session)
        await session.initialize()
        tool_response = await session.get_tools()
        for tool in tool_response.tools:
            self.toolName_session_mapping[tool.name] = session
            self.available_tools.append({
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.parameters
            })
        print(f"Connected to server: {server_name}")

    async def connect_to_servers(self):
        """
        Connects to multiple servers based on the provided configurations.
        :param server_configs: List of dictionaries containing server configurations.
        """
        try:
            with open("../server_configs.json", "r") as f:
                server_configs = json.load(f)
                server_items = server_configs.get("mcpServers", {})
                for server_name, server_config in server_items.items():
                    await self.connect_single_server(server_name, server_config)

        except Exception as e:
            print(f"Failed to load server_configs.json: {e}")


"""
总结：mcp连接多个server，需要使用配置文件，在其中硬编码连接mcp server所需要的命令和参数，然后使用AsyncExitStack管理服务器资源
"""