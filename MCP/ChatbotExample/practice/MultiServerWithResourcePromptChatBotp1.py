
from typing import List,Dict,Any
from contextlib import AsyncExitStack
from anthropic import Anthropic
from mcp import StdioServerParameters, stdio_client, ClientSession
from pydantic import BaseModel
import json

class ToolDefinitionP1(BaseModel):
    name: str
    description: str
    input_schema: dict

class MultiServerWithResourcePromptChatBotP1:

    def __init__(self, server):
        # 因为有多个server，所以用字典的形式来存储prompt resource_url tool_name 和session的映射关系，方便快速找到session之后调用对应的函数
        self.prompt_resource_tool_map:Dict[str, ClientSession] = {}
        self.async_exit_stack = AsyncExitStack()
        self.llm = Anthropic()
        self.available_tools:List[ToolDefinitionP1] = []
        self.available_prompts:List[Dict] = []


    async def process_query(self, query: str, server_id: str):
        messages = [{"role":"user", "content": query}]
        responses = self.llm.messages.create(model="claude-3-7-sonnet-20250219",
                                             messages=messages,
                                             tools=self.available_tools,
                                             max_tokens=2024)
        process_query_flag = True
        while process_query_flag:
            assistant_content = []
            user_tools_content = []
            for content in responses.content:
                if content.type == "text":
                    assistant_content.append(content.text)
                    if len(responses.content) == 1:
                        process_query_flag = False
                elif content.type == "tool_use":
                    assistant_content.append(content)
                    tool_id = content.id
                    tool_name = content.name
                    tool_args = content.input

                    # Get the session for the specific server
                    session = self.prompt_resource_tool_map.get(tool_name)
                    if not session:
                        raise ValueError(f"No session found for tool name: {tool_name}")

                    # Execute the tool and get the result
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
            responses = self.llm.messages.create(model="claude-3-7-sonnet-20250219",
                                                 messages=messages,
                                                 tools=self.available_tools,
                                                 max_tokens=2024)

    async def connect_to_single_server(self,server_name:str,server_config:dict[str, Any]):
        """ Connects to a single server using the provided configuration.
            Storage the resources prompt and tool_name mapping to session.
        """
        stdio_server_params = StdioServerParameters(
            command=server_config["command"],
            args=server_config["args"],
            env=None
        )
        (read , write) = await self.async_exit_stack.enter_async_context(stdio_client(stdio_server_params))
        session = await self.async_exit_stack.enter_async_context(ClientSession(read, write))
        await session.initialize()
        tools_responses = await session.list_tools()
        if tools_responses and tools_responses.tools:
            tools = tools_responses.tools
            for tool in tools:
                tool_definition = ToolDefinitionP1(
                    name=tool.name,
                    description=tool.description,
                    input_schema=tool.inputSchema
                )
                self.available_tools.append(tool_definition)
                # Store the session for the specific tool
                self.prompt_resource_tool_map[tool.name] = session


        resources_response = await session.list_resources()
        if resources_response and resources_response.resources:
            resources = resources_response.resources
            for resource in resources:
                self.prompt_resource_tool_map[str(resource.uri)] = session

        prompts_responses = await session.list_prompts()
        if prompts_responses and prompts_responses.prompts:
            prompts = prompts_responses.prompts
            for prompt in prompts:
                self.prompt_resource_tool_map[prompt.name] = session
                self.available_prompts.append({
                    "name": prompt.name,
                    "description": prompt.description,
                    "arguments": prompt.arguments
                })
    async def connect_to_servers(self):
        """ Connects to multiple servers and initializes the chatbot. """
        try:
            with open("../server_config.json", "r") as config_file:
                config_dic = json.load(config_file)
                server_configs = config_dic.get("mcpServers", {})
                for server_name,single_server_config in server_configs.items():
                    await self.connect_to_single_server(server_name, single_server_config)
        except Exception as e:
            print(f"An error occurred while connecting to servers: {e}")

    async def chat_loop(self):
        """ Starts the chat loop for the chatbot. """
        print("Welcome to the Multi-Server ChatBot!")
        while True:
            try:
                user_input = input("Query: ").strip()
                if user_input.lower() == "exit":
                    print("Exiting the chat. Goodbye!")
                    break
                user_input = user_input.lower()

            # 下面是处理resource和prompt的逻辑
                # 判断是否是用户输入的resource请求
                if user_input.startwith("@"):
                    topic = user_input[1:]
                    if topic == "folders":
                        resource_uri = "papers://folders"
                    else:
                        resource_uri = f"papers://{topic}"
                    await self.get_resource(resource_uri)
                    # 找到资源啦，返回给用户后，继续等待用户新的输入，因为这是一个聊天机器人，chat loop
                    continue
                #判断是否是用户输入的prompt请求
                if user_input.startswith("/"):
                    parts = user_input.split()
                    command = parts[0].lower()
                    if command == "/prompts":
                        await self.list_prompts()
                    elif command == "/prompt":
                        if len(parts) < 2:
                            print("Usage: /prompt <prompt_name> <arg1 = value1> <arg2 = value2> ...")
                            continue
                        prompt_name = parts[1]
                        args = {}
                        for arg in parts[2:]:
                            if "=" in arg:
                                key, value = arg.split("=", 1)
                                args[key.strip()] = value.strip()
                        await self.execute_prompt(prompt_name, args)
                    else:
                        print("Unknown command. Available commands: /prompts, /prompt <prompt_name> <arg1=value1> <arg2=value2> ...")
                    #处理完prompt请求后，继续等待用户新的输入
                    continue
                # 处理普通的查询请求
                await self.process_query(user_input)
            except Exception as e:
                print(f"An error occurred: {e}")

    #列出所有的prompt，当用户输入/prompts时，列出所有的prompt
    async def list_prompts(self):
        if not self.available_prompts:
            print("No prompts available.")
            return
        # 开始打印
        print("Available prompts:")
        for prompt in self.available_prompts:
            print(f"Name:{prompt['name']}, Description: {prompt['description']}")
            print("Arguments:")
            for argument in prompt['arguments']:
                arg_name = argument.name if hasattr(argument, 'name') else argument['name']
                print(f"- {arg_name}\n")


    # 执行用户给出的提示语
    async def execute_prompt(self, prompt_name:str, args:dict):
        session = self.prompt_resource_tool_map.get(prompt_name)
        if not session:
            print(f"No session found for prompt name: {prompt_name}")
            return
        try:
            result = await session.get_prompt(prompt_name, arguments=args)
            if result and result.messages:
                prompt_content = result.messages[0].content
                text = ""
                if isinstance(prompt_content, str):
                    text = prompt_content
                elif hasattr(prompt_content, 'text'):
                    text = prompt_content.text
                else:
                    text = " ".join(item.text if hasattr(item,'text') else str(item) for item in prompt_content)
                    print(f"\n Executing prompt {prompt_name} with arguments {args}:\n{text}....")
                await self.process_query(text)
        except Exception as e:
            print(f"An error occurred when executed prompt {prompt_name} with arguments {args}: {e}")


    async def get_resource(self, resource_uri: str):
        """ Retrieves a resource by its URI. """
        session = self.prompt_resource_tool_map.get(resource_uri)
        if not session and resource_uri.startswith("papers://"):
            for uri,sess in self.prompt_resource_tool_map.items():
                if uri.startswith("papers://"):
                    session = sess
                    break
        # 没有相匹配的session 会话对象
        if not session:
            print(f"No session found for tool name: {resource_uri}")
            return

        # 找到会话对象了，读取资源并返回资源
        try:
            result = await session.read_resource(resource_uri)
            if result and result.contents:
                print(f"\nResource {resource_uri} contents:\n{result.contents[0].text}")
            else:
                print(f"No contents found for resource {resource_uri}.")
        except Exception as e:
            print(f"An error occurred while retrieving resource {resource_uri}: {e}")


async def main():
    try:
        chatbot = MultiServerWithResourcePromptChatBotP1(server=None)
        await chatbot.connect_to_servers()
        await chatbot.chat_loop()
    except Exception as e:
        print(f"An error occurred in the main function: {e}")
    finally:
        await chatbot.async_exit_stack.aclose()