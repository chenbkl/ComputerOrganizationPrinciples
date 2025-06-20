from MultiServerChatBot import ToolDefinition
from contextlib import AsyncExitStack
from typing import List, Dict, Any
import json
from pydantic import AnyUrl

from mcp import ClientSession, StdioServerParameters, stdio_client
from anthropic import Anthropic


class MultiServerWithResourcePromptChatBotP2:
    def __init__(self, server_name, resource_prompt):
        self.async_exit_stack = AsyncExitStack()
        self.available_tools:List[ToolDefinition] = []
        self.available_prompts:List[str] = []
        self.resource_prompt_tool_mapping:Dict[str, ClientSession] = {}
        self.llm = Anthropic()


    async def connect_to_single_server(self,server_name, server_config):
        """
        Connect to a single server and store the tools resource prompt.
        """
        # Here you would implement the logic to connect to your server
        try:
            serverParams: StdioServerParameters = StdioServerParameters(**server_config)
            (reader,writer) = await self.async_exit_stack.enter_async_context(stdio_client(serverParams))
            session: ClientSession = await self.async_exit_stack.enter_async_context(ClientSession(reader, writer))
            await session.initialize()
            tools_response = await session.list_tools()
            if tools_response and tools_response.tools:
                for tool in tools_response.tools:
                    print("tool.name:", tool.name, type(tool.name))
                    print("tool.description:", tool.description, type(tool.description))
                    print("tool.inputSchema:", tool.inputSchema, type(tool.inputSchema))
                    self.available_tools.append(ToolDefinition(name=tool.name, description=tool.description, input_schema=tool.inputSchema))
                    #store the mapping about tool_name to session
                    self.resource_prompt_tool_mapping[tool.name] = session

            # Store the resource prompt for the server
            resource_response = await session.list_resources()
            if resource_response and resource_response.resources:
                for resource in resource_response.resources:
                    print("resource.uri:", resource.uri, type(resource.uri))
                    print("resource.name:", resource.name, type(resource.name))
                    print("resource.description:", resource.description, type(resource.description))
                    print("resource.mimeType:", resource.mimeType, type(resource.mimeType))
                    # Assuming you want to store the prompt in a specific way
                    self.resource_prompt_tool_mapping[str(resource.uri)] = session

            prompt_response = await session.list_prompts()
            if prompt_response and prompt_response.prompts:
                for prompt in prompt_response.prompts:
                    print("prompt.name:", prompt.name, type(prompt.name))
                    print("prompt.description:", prompt.description, type(prompt.description))
                    print("prompt.arguments:", prompt.arguments, type(prompt.arguments))
                    # Assuming you want to store the prompt in a specific way
                    self.resource_prompt_tool_mapping[prompt.name] = session
                    self.available_prompts.append(prompt.name)

        except Exception as e:
            print(f"Failed to connect to server {server_name}: {e}")
            raise

    async def connect_to_servers(self):
        """
        Connect to multiple servers and store tools resource prompt for each server.
        """
        # Here you would implement the logic to connect to your servers
        try:
            with open("../server_config.json", "r") as f:
                server_configs_file_dic = json.load(f)
                server_configs = server_configs_file_dic.get("mcpServers",{})
                for server_name, server_config in server_configs.items():
                    await self.connect_to_single_server(server_name, server_config)

        except Exception as e:
            print(f"Error loading server configuration: {e}")


    async def chat_loop(self):
        """
        Starts the chat loop for the chatbot.
        This method will continuously prompt the user for input and process user input.
        """
        while True:
            try:
                user_input = input("\nQuery: ").strip()
                user_input = user_input.lower()
                if user_input == "exit":
                    print("Exiting the chat. Goodbye!")
                    break

                # 判断用户的输入是否是查询资源
                if user_input.startswith("@"):
                    topic = user_input[1:].strip()
                    resource_uri_str = f"papers://{topic}"
                    await self.get_resource(resource_uri_str)
                    continue
                # 判断用户的输入是否是提示工程
                if user_input.startswith("/"):
                    if user_input.startswith("/prompts"):
                        print("Available prompts:")
                        for prompt in self.available_prompts:
                            print(f"- {prompt}")
                        continue
                    if user_input.startswith("/prompt"):
                        parts = user_input.split("")
                        if len(parts) < 2:
                            print("Usage: /prompt <prompt_name> <arg1=value1> <arg2=value2> ...")
                            continue
                        prompt_name = parts[1]
                        args = {}
                        for arg in parts[2:]:
                            if "=" in arg:
                                key, value = arg.split("=", 1)
                                args[key.strip()] = value.strip()
                        await self.execute_prompt(prompt_name, args)
                        continue
                # 如果不是查询资源或提示工程，则处理用户输入
                await self.process_query(user_input)
            except Exception as e:
                print(f"An error occurred: {e}")

    async def get_resource(self,resource_uri_str:str):
        session = self.resource_prompt_tool_mapping.get(resource_uri_str, None)
        if not session:
            for name,ses in self.resource_prompt_tool_mapping.items():
                if name.startswith("papers://"):
                    session = ses

        if not session:
            print(f"No session found for resource {resource_uri_str}")
            return

        try:
            resource_response = await session.read_resource(AnyUrl(resource_uri_str))
            if resource_response and resource_response.content:
                print(f"Resource content for {resource_uri_str}:")
                print(resource_response.text)
            else:
                print(f"No content found for resource {resource_uri_str}")
        except Exception as e:
            print(f"Failed to retrieve resource {resource_uri_str}: {e}")
            return


    async def execute_prompt(self,prompt_name:str, args:Dict[str, Any]):
        """
        Execute a prompt with the given name and arguments.
        """
        session = self.resource_prompt_tool_mapping.get(prompt_name)
        if not session:
            print(f"No session found for prompt {prompt_name}")
            return
        try:
            prompt_response = await session.get_prompt(prompt_name,arguments=args)
            if prompt_response and prompt_response.messages:
                prompt_content = ""
                for message in prompt_response.messages:
                    prompt_content += f"{message.role}: {message.content}\n"
                print(f"Prompt content for {prompt_name}:\n{prompt_content}")
                await self.process_query(prompt_content)

            else:
                print(f"No content found for prompt {prompt_name}")
        except Exception as e:
            print(f"Failed to execute prompt {prompt_name}: {e}")
            return


    async def process_query(self,query:str) :
        """
        Process the user query.
        This method should be implemented to handle the query and return a response.
        """
        messages = [{"role": "user", "content": query}]
        responses = self.llm.messages.create(messages=messages,
                                             model="claude-3-7-sonnet-20250219",
                                             tools=self.available_tools,
                                             max_tokens=2024)
        process_query_flag = True
        while process_query_flag:
            assistant_content = []
            user_tools_content = []
            for content in responses.content:
                if content.type == "text":
                    assistant_content.append(content)
                    if len(responses.content) == 1:
                        process_query_flag = False
                elif content.type == "tool_use":
                    assistant_content.append(content)
                    tool_id = content.id
                    tool_name = content.name
                    tool_args = content.input
                    # Here you would execute the tool and get the result
                    session = self.resource_prompt_tool_mapping.get(tool_name, None)
                    if not session:
                        print(f"No session found for tool {tool_name}")
                        continue
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
            responses = self.llm.messages.create(messages=messages,
                                                 model="claude-3-7-sonnet-20250219",
                                                 tools=self.available_tools,
                                                 max_tokens=2024)

    async def clean_up(self):
        """
        Clean up resources and close the async exit stack.
        """
        await self.async_exit_stack.aclose()
        print("Cleaned up resources and closed the async exit stack.")


    async def run(self):
        """
        Run the chatbot by connecting to servers and starting the chat loop.
        """
        try:
            await self.connect_to_servers()
            print("Connected to servers and ready to chat.")
            await self.chat_loop()
        except Exception as e:
            print(f"An error occurred while running the chatbot: {e}")
        finally:
            await self.clean_up()