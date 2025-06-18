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
        self.async_exit_stack = AsyncExitStack()

        self.available_tools: List[ToolDefinition] = []
        self.available_prompts = []
        # dictionary to map tool names and resourceUri to their corresponding sessions
        self.sessions_mapping_resourceOrToolName: Dict[str, ClientSession] = {}


    async def get_resource(self,resource_uri: str) -> Resource:
        """
        Retrieves a resource by its URI.
        """
        session = self.sessions_mapping_resourceOrToolName.get(resource_uri)

        if not session and resource_uri.startswith("papers://"):
            for uri,sess in self.sessions_mapping_resourceOrToolName.items():
                if uri.startswith("papers://"):
                    session = sess
                    break

        if not session:
            print(f"No session found for resource URI: {resource_uri}")
            return

        try:
            result = await session.read_resource(resource_uri)
            if result and result.contents:
                print(f"\nResource:{resource_uri}\n")
                print(f"Contents:{result.contents[0].text}")
            else:
                print("No contents found for the resource.")
        except Exception as e:
            print(f"Error retrieving resource {resource_uri}: {e}")

    async def list_prompts(self):
        """
        Lists all available prompts from the connected servers.
        """
        if not self.available_prompts:
            print("No prompts available.")
            return

        print("Available Prompts:")
        for prompt in self.available_prompts:
            print(f"Name: {prompt['name']}, Description: {prompt['description']}")
            if prompt["arguments"]:
                print(f"Arguments:")
                for argument in prompt['arguments']:
                    arg_name = argument.name if hasattr(argument, "name") else argument.get('name',"")
                    print(f"- {arg_name}")

    async def execute_prompt(self,prompt_name,args):
        """execute a prompt with the given arguments"""
        session = self.sessions_mapping_resourceOrToolName.get(prompt_name)
        if not session:
            print(f"Prompt '{prompt_name}' not found")
            return
        try:
            result = await session.get_prompt(prompt_name,arguments=args)
            if result and result.messages:
                prompt_content = result.messages[0].content
                text = ""
                if isinstance(prompt_content, str):
                    text = prompt_content
                elif hasattr(prompt_content, "text"):
                    text = prompt_content.text
                else:
                    # Handle list of content items
                    text = " ".join(item.text if hasattr(item,'text') else str(item) for item in prompt_content)
                    print(f"\n Executing prompt '{prompt_name}'...")
                await self.process_query(text)
        except Exception as e:
            print(f"Error executing prompt '{prompt_name}': {e}")




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
                    session = self.sessions_mapping_resourceOrToolName.get(tool_name)
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


    async def chat_loop_new(self):
        while True:
            try:
                query = input("> Query:").strip()
                if not query:
                    continue
                if query.lower() == "quit":
                    break

                # check for @resource syntax first
                if query.startswith("@"):
                    topic = query[1:]
                    if topic == "folders":
                        resource_uri = "papers://folders"
                    else:
                        resource_uri = f"papers://{topic}"
                    await self.get_resource(resource_uri)
                    continue
                # check for /command syntax
                if query.startswith("/"):
                    parts = query.split()
                    command = parts[0].lower()

                    if command == "/prompts":
                        await self.list_prompts()
                    elif command == "/prompt":
                        if len(parts) < 2:
                            print("Usage:/prompt <name> <arg1=value1> <arg2=value2>")
                            continue
                        prompt_name = parts[1]
                        args = {}
                        for arg in parts[1]:
                            if '=' in arg:
                                key, value = arg.split("=",1)
                                args[key] = value
                        await self.execute_prompt(prompt_name, args)
                    else:
                        print(f"Unknown command: {command}")
                    continue
                await self.process_query(query)
            except Exception as e:
                print(f"An error occurred: {e}")
    async def clean_up(self):
        """
        Cleans up resources and closes all sessions.
        """
        await self.async_exit_stack.aclose()
        print("All sessions closed and resources cleaned up.")

    async def main():
        chatbot = MultiServerWithResourceAndPromptChatbot()
        try:
            await chatbot.connect_to_servers()
            await chatbot.chat_loop_new()
        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            await chatbot.clean_up()
            print("Chatbot session ended.")

# if __name__ == "__main__":
#     asyncio.run(main())


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

            try:
                # list available tools from the server
                tools_responses = await session.get_tools()
                for tool in tools_responses.tools:
                    tool_definition = ToolDefinition(
                        name=tool.name,
                        description=tool.description,
                        input_schema=tool.inputSchema
                    )
                    self.available_tools.append(tool_definition)
                    self.sessions_mapping_resourceOrToolName[tool.name] = session
                # list available prompts from the server
                prompt_responses = await session.list_prompts()
                if prompt_responses and prompt_responses.prompts:
                    for prompt in prompt_responses.prompts:
                        self.sessions_mapping_resourceOrToolName[prompt.name] = session
                        self.available_prompts.append({
                            "name": prompt.name,
                            "description": prompt.description,
                            "arguments": prompt.arguments,
                        })

                # list available resources from the server
                resource_responses = await session.list_resources()
                if resource_responses and resource_responses.resources:
                    for resource in resource_responses.resources:
                        resource_uri = str(resource.uri)
                        self.sessions_mapping_resourceOrToolName[resource_uri] = session

            except Exception as e:
                print(f"Error: {e}")

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
            await self.chat_loop_new()
        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            await self.clean_up()
            print("Chatbot session ended.")


if __name__ == "__main__":
    chatbot = MultiServerWithResourceAndPromptChatbot()
    asyncio.run(chatbot.run())