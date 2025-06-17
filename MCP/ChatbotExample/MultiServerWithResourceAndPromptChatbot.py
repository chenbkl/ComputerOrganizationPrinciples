import asyncio

from anthropic import Anthropic
from typing import List, Dict, Any
from mcp import ClientSession, StdioServerParameters, stdio_client
from mcp import Resource
from contextlib import AsyncExitStack
import json
from pydantic import BaseModel


class ToolDefinition(BaseModel):
    name: str
    description: str
    input_schema: dict

class MultiServerWithResourceAndPromptChatbot(object):

    def __init__(self):
        self.name = "MultiServerWithResourceAndPromptChatbot"
        self.version = "1.0"
        self.description = "A chatbot that can interact with multiple servers, resources, and prompts."

        self.llm = Anthropic()
        self.available_tools: List[ToolDefinition] = []
        self.sessions: List[ClientSession] = []
        self.sessions_mapping_toolName: Dict[str, ClientSession] = {}
        self.resources: Dict[str, Resource] = {}
        self.async_exit_stack = AsyncExitStack()

    async def process_query(self,query:str):
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

                    # Execute the tool with the session
                    result = await session.call_tool(tool_name, tool_args)
                    user_tools_content.append({"type": "tool_result", "id": tool_id, "result": result})

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
        This method starts the chat loop, allowing the user to interact with the chatbot.
        It continuously prompts for user input and processes the queries until the user decides to exit.
        """
        print("Welcome to the MultiServerWithResourceAndPromptChatbot!")
        print("Type 'exit' to quit.")

        while True:
            query = input("You: ")
            if query.lower() == 'exit':
                break
            try:
                response = await self.process_query(query)
                print(f"Bot: {response}")
            except Exception as e:
                print(f"Error: {e}")

    async def connect_to_single_server(self,server_name, server_config: Dict[str, Any]):
        """
        Connects to a single server using the provided server ID and address.
        """
        try:
            parameters = StdioServerParameters(**server_config)
            (read, write) = await self.async_exit_stack.enter_async_context(stdio_client(parameters))
            session = await self.async_exit_stack.enter_async_context(ClientSession(read, write))
            self.sessions.append(session)
            await session.initialize()
            tools_responses = await session.get_tools()
            for tool in tools_responses.tools:
                tool_definition = ToolDefinition(
                    name=tool.name,
                    description=tool.description,
                    input_schema=tool.inputSchema
                )
                self.available_tools.append(tool_definition)
                self.sessions_mapping_toolName[tool.name] = session
            print(f"Connected to server:{server_name} {server_config['command']}")
        except Exception as e:
            print(f"Failed to connect to server {server_name}: {e}")

    async def connect_to_servers(self):
        """
        Connects to multiple servers based on the provided configurations.
        """
        try:
            with open("server_config.json", "r") as config_file:
                server_configs:dict = json.load(config_file)
                configs = server_configs.get("mcpServers", {})
                for server_name, server_config in configs.items():
                    await self.connect_to_single_server(server_name,server_config)
                    print(f"Start to connect to server: {server_name}")
        except FileNotFoundError:
            print("Server configuration file not found. Please ensure 'server_config.json' exists.")
        except json.JSONDecodeError:
            print("Error decoding JSON from the server configuration file. Please check the file format.")
        except Exception as e:
            print(f"An error occurred while connecting to servers: {e}")

    async def clean_up(self):
        """
        Cleans up resources and closes all sessions.
        """
        await self.async_exit_stack.aclose()
        print("All sessions closed and resources cleaned up.")


    async def run(self):
        try:
            await self.connect_to_servers()
            await self.chat_loop()
        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            await self.clean_up()
            print("Chatbot session ended.")


if __name__ == "__main__":
    chatbot = MultiServerWithResourceAndPromptChatbot()
    asyncio.run(chatbot.run())