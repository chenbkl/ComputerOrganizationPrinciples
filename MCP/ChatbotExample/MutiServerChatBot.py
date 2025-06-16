import json
from contextlib import AsyncExitStack
from pyexpat.errors import messages
from typing import List, Dict, Any
from mcp import ClientSession,StdioServerParameters,stdio_client
from anthropic import Anthropic
from pydantic import BaseModel
from mcp_client import server_params



class ToolDefinition(BaseModel):
    name:str
    description:str
    input_schema:dict

class MultiServerChatBot:

    def __init__(self):
        self.name = "MultiServerChatBot"
        self.version = "1.0"
        self.description = "A chatbot that can interact with multiple servers."

        self.llm = Anthropic()
        self.available_tools:List[ToolDefinition] = []
        self.sessions:List[ClientSession] = []  # Store sessions for different servers
        self.sessions_mapping_toolName:Dict[str, ClientSession] = {}  # Store sessions for different servers
        self.exit_stack = AsyncExitStack()


    async def process_query(self, query, server_id):
        messages = [
            {"role": "user", "content": query}
        ]
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
                    assistant_content.append(content)
                    if len(response.content) == 1:
                        process_query_flag = False
                elif content.type == "tool_use":
                    assistant_content.append(content)
                    tool_id = content.id
                    tool_name = content.name
                    tool_args = content.input

                    # Get the session for the specific server
                    session = self.sessions_mapping_toolName.get(tool_name)
                    if not session:
                        raise ValueError(f"No session found for tool name: {tool_name}")

                    # Execute the tool and get the result
                    result = await session.call_tool(tool_name, arguments=tool_args)
                    user_tools_content.append({
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": result,
                    })

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
        print(f"{self.name} v{self.version} - {self.description}")
        while True:
            try:
                query = input("\nQuery: ").strip()
                if query.lower() == "exit":
                    print("Exiting the chat. Goodbye!")
                    break

                server_id = input("Enter server ID: ").strip()  # Get server ID from user
                await self.process_query(query, server_id)
            except Exception as e:
                print(f"An error occurred: {e}")

    async def connect_to_single_server(self,server_name:str,server_config:dict) ->None:
        """connect to a server and store the session"""

        try:
            server_params = StdioServerParameters(server_config)
            stdio_transport = await self.exit_stack.enter_async_context(
                stdio_client(server_params)
            )
            reader, writer = stdio_transport
            session = await self.exit_stack.enter_async_context(
                ClientSession(reader, writer)
            )
            await session.initialize()
            self.sessions.append(session)

            response = await session.list_tools()
            tools = response.tools
            for tool in tools:
                print("tool.name:", tool.name, type(tool.name))
                print("tool.description:", tool.description, type(tool.description))
                print("tool.inputSchema:", tool.inputSchema, type(tool.inputSchema))
                self.sessions_mapping_toolName[tool.name] = session
                self.available_tools.append(ToolDefinition(name=tool.name, description=tool.description, input_schema=tool.inputSchema))
        except Exception as e:
            print(f"Failed to connect to server {server_name}: {e}")

    async def connect_to_servers(self):
        """connect to all servers defined in server_params"""
        try:
            with open("server_config.json", "r") as f:
                data = json.load(f)
            servers = data.get("mcpServers", {})
            for server_name, server_config in servers.items():
                await self.connect_to_single_server(server_name, server_config)
        except Exception as e:
            print(f"Error loading server configuration: {e}")
            raise

    async def cleanup(self):
        """cleanly close all resoueces using AsyncExitStack"""
        await self.exit_stack.aclose()
        print("Cleaned up resources.")

async def main():
    chatbot = MultiServerChatBot()
    try:
        await chatbot.connect_to_servers()
        await chatbot.chat_loop()
    finally:
        await chatbot.cleanup()

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())