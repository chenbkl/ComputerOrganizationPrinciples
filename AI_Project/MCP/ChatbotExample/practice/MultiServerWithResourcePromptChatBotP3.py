from contextlib import AsyncExitStack
from http.client import responses
from pyexpat.errors import messages

from mcp import StdioServerParameters,stdio_client,ClientSession

from MultiServerWithResourceAndPromptChatbot import ToolDefinition
from typing import List,Dict
from mcp.types import Prompt
import json
from anthropic import Anthropic
import asyncio
from pydantic import AnyUrl


class MultiServerWithResourcePromptChatBotP3:
    def __init__(self):
        self.async_exit_stack = AsyncExitStack()
        self.available_tools:List[ToolDefinition] = []
        self.available_prompts:List[Prompt] = []
        self.resource_prompt_tool_mapping:Dict[str,ClientSession] = {}
        self.llm = Anthropic()

    async def connect_to_single_server(self, server_config:dict):
        """
        Connect to a single server.
        """
        server_params = StdioServerParameters(**server_config)
        print(f"Server params: {server_params},type = {type(server_params)}")

        (reader, writer) = await self.async_exit_stack.enter_async_context(stdio_client(server_params))
        session = await self.async_exit_stack.enter_async_context(ClientSession(reader, writer))
        await session.initialize()
        tools_response = await session.list_tools()
        if tools_response and tools_response.tools:
            for tool in tools_response.tools:
                tool_definition = ToolDefinition(
                    name=tool.name,
                    description=tool.description,
                    input_schema=tool.inputSchema
                )
                self.available_tools.append(tool_definition)
                self.resource_prompt_tool_mapping[tool.name] = session

        prompts_response = await session.list_prompts()
        if prompts_response and prompts_response.prompts:
            for prompt in prompts_response.prompts:
                self.available_prompts.append(prompt)
                self.resource_prompt_tool_mapping[prompt.name] = session

        resource_response = await session.list_resources()
        if resource_response and resource_response.resources:
            for resource in resource_response.resources:
                self.resource_prompt_tool_mapping[str(resource.uri)] = session

    async def connect_to_multiple_servers(self):
        """
        Connect to multiple servers.
        """
        try:
            with open("../server_config.json") as f:
                configs = json.load(f)
                server_configs = configs.get("mcpServers",{})
                for server_name, server_config in server_configs.items():
                    print(f"Connecting to server: {server_name}")
                    print(f"Server configuration: {server_config},type = {type(server_config)}")
                    await self.connect_to_single_server(server_config)
        except FileNotFoundError:
            print("Server configuration file not found. Please ensure 'server_config.json' exists.")

    async def chat_loop_p3(self):
        """
        Start the chat loop for the MultiServerWithResourcePromptChatBotP3.
        """
        while True:
            user_input = input("\nQuery: ")
            user_input = user_input.strip().lower()
            if user_input in ["exit", "quit"]:
                print("Exiting chat.")
                break

            # 判断并处理resource
            if user_input.startswith("@"):
                topic = user_input[1:].strip()
                resource_uri = f"papers://{topic}"
                await self.getResource(resource_uri)
                continue

            # 判断并处理prompt
            if user_input.startswith("/"):
                if user_input.startswith("/prompts"):
                    self.list_all_prompts()
                    continue
                elif user_input.startswith("/prompt"):
                    parts = user_input.split()
                    if len(parts) < 2:
                        print("Prompt format error. Usage: /prompt <prompt_name> <arg_name1=arg_value1> <arg_name2=arg_value2> ...")
                        continue
                    prompt_name = parts[1]
                    prompt_arguments_dict = {}
                    for prompt_arg in parts[2:]:
                        arguments:List[str] = prompt_arg.split("=",)
                        if len(arguments) == 2:
                            prompt_arguments_dict[arguments[0]] = arguments[1]
                    await self.execute_prompt(prompt_name, prompt_arguments_dict)
                    continue
                else:
                    print("Unknown command. Use /prompts to list available prompts or /prompt <prompt_name> to execute a prompt.")
                    continue

            # 处理普通用户输入
            await self.process_query(user_input)


    async def getResource(self, resource_uri:str):
        session = self.resource_prompt_tool_mapping.get(resource_uri)
        if not session:
            for name, sess in self.resource_prompt_tool_mapping.items():
                if name.startswith("papers://"):
                    session = sess

        if not session:
            print(f"No session found for resource: {resource_uri}")
            return

        result = await session.read_resource(AnyUrl(resource_uri))
        if result and result.contents:
            print(f"Resource content for {resource_uri}:")
            for content in result.contents:
                print(content)
        else:
            print(f"Failed to retrieve resource: {resource_uri}")


    def list_all_prompts(self):
        """
        List all available prompts.
        """
        if not self.available_prompts:
            print("No prompts available.")
            return

        print("Available Prompts:")
        for prompt in self.available_prompts:
            print(f"---prompt_name: {prompt.name};\n   prompt_description {prompt.description};\n   Input Schema: {prompt.arguments}")
        print("All prompts listed successfully.")

    async def execute_prompt(self, prompt_name, prompt_args:dict):
        """
        Execute a specific prompt with the given arguments.
        """
        session = self.resource_prompt_tool_mapping.get(prompt_name)
        if not session:
            print(f"No session found for prompt: {prompt_name}")
            return

        try:
            prompt_result = await session.get_prompt(prompt_name, arguments=prompt_args)
            if prompt_result and prompt_result.messages:
                prompt_content = prompt_result.messages[0].content
                await self.process_query(prompt_content.text)
                print(f"Result prompt '{prompt_name}': {prompt_result}")

        except Exception as e:
            print(f"Error executing prompt '{prompt_name}': {e}")

    async def process_query(self, query):
        """
        Process the user query.
        """
        messages = [
            {
                "role": "user",
                "content": query
            }
        ]
        responses = self.llm.messages.create(model="claude-3-7-sonnet-20250219",messages=messages,tools=self.available_tools,max_tokens=2024)

        _process_query = True
        while _process_query:
            assistant_content = []
            user_tools_content = []
            for content in responses.content:
                if content.type == "text":
                    print(f"ChatBot: {content.text}")
                    assistant_content.append(content.text)
                    if len(responses.contents) == 1:
                        _process_query = False

                elif content.type == "tool_use":
                    tool_name = content.name
                    tool_input = content.input
                    tool_id = content.id
                    session = self.resource_prompt_tool_mapping.get(tool_name)
                    if not session:
                        print(f"No session found for tool: {tool_name}")
                        continue
                    result = await session.call_tool(tool_name,vars(tool_input))

                    assistant_content.append(content)
                    user_tools_content.append({
                        "type": "tool_result",
                        "id": tool_id,
                        "result": result
                    })
            messages.append({
                "role": "assistant",
                "content": assistant_content,
            })
            messages.append({
                "role": "user",
                "content": user_tools_content
            })
            responses = self.llm.messages.create(model="claude-3-7-sonnet-20250219", messages=messages,
                                                 tools=self.available_tools, max_tokens=2024)


    async def clean_up(self):
        """
        Clean up resources.
        """
        await self.async_exit_stack.aclose()

    async def run(self):
        """
        Run the chat bot.
        """
        try:
            await self.connect_to_multiple_servers()
            print("Connected to all servers successfully.")
            await self.chat_loop_p3()
        except Exception as e:
            print(f"Failed to connect to servers: {e}")
        finally:
            await self.clean_up()
            print("Cleaned up resources and exited chat bot.")

if __name__ == "__main__":
    chatbot = MultiServerWithResourcePromptChatBotP3()
    asyncio.run(chatbot.run())
