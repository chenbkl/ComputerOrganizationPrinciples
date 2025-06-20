import asyncio

from anthropic import Anthropic
from typing import List, Dict, Any
from mcp import ClientSession, StdioServerParameters, stdio_client
from mcp import Resource
from contextlib import AsyncExitStack
import json
from pydantic import BaseModel,AnyUrl,TypeAdapter,ValidationError


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


    # 函数小模板
    """
    函数名： get_resource
    功能： 根据统一资源标识符获取资源
    输入： resource_uri: str统一资源标识符
    输出： 这里是通过控制台打印的形式输出
    步骤拆解：
    1.根据统一资源标识符获取会话对象
    2.如果没有在映射表中根据统一资源标识符获取到会话对象，则判断统一资源标识符的前缀是否为"papers://"，如果是，则判断映射表中的key是否有以"papers://"开头的，如果有，则获取第一个会话对象
    3.如果依旧没找到，则提示没有该资源对应的会话对象并退出函数
    4.拿着获取到的会话对象，调用其读取资源的函数 read_resource,然后打印资源内容
    5.如果读取资源失败，则打印错误信息
    
    注意：其中 read_resource的返回值的结构，是一个数组，每个元素有两个属性，一个是type，一个是text，当mcp server的资源函数返回一个字符串的时候，字符串会被自动构造为{"type":"markdown","text":"askljd"},
    ,数组中只有一个元素,如果返回的是一个列表，则其返回值一般形式为：[{"type":"markdown","text":"askljd"}, {"type":"markdown","text":"askljd2"}]
    """
    async def get_resource(self,resource_uri: str):
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
            resource_uri = TypeAdapter(AnyUrl).validate_python(resource_uri)
            result = await session.read_resource(resource_uri)
            if result and result.contents:
                print(f"\nResource:{resource_uri}\n")
                print(f"Contents:{result.contents[0].text}")
            else:
                print("No contents found for the resource.")
        except Exception as e:
            print(f"Error retrieving resource {resource_uri}: {e}")


    """
    # 函数名： list_prompts
    功能： 列出所有可用的提示
    输入： 无
    输出： 打印所有可用的提示
    步骤拆解：
    1.判断可用的提示列表是否为空，如果为空，则打印没有可用的提示并退出函数
    2.如果不为空，则逐个 按照格式打印所有可用的提示，其中要打印提示的名称、描述和参数
    """
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

    """
    函数名： execute_prompt
    功能： 执行一个提示
    输入： prompt_name: str 提示的名称
              args: dict 提示的参数
    输出： 执行提示的结果
    步骤拆解：
    1.根据提示名称，获取已经从服务器获取的会话对象，如果没有找到，则打印提示未找到并退出函数
    2.如果找到了会话对象，则调用会话对象的 get_prompt 方法，传入提示名称和参数
    3.拿到真正的提示内容后，判断提示内容的类型，最终将其转换为字符串形式，打印输出，并且调用大模型的处理函数，执行prompt
    
    """
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



    """
    函数名： process_query
    功能： 处理用户查询
    输入： query: str 用户查询内容
    输出： 控制台打印用户查询结果
    步骤拆解：
    主要是两部分信息：一个是用户普通对话，一个是大模型需要对工具进行调用的对话，工具调用可能涉及多轮对话
    工具和资源、提示不同，工具是大模型主动调用的，而资源和提示是用户主动查询的，所以工具的调用需要根据大模型的消息判断，而资源和提示是根据用户的消息进行判断
    """
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


    """
    函数名： chat_loop_new
    功能： 启动聊天循环
    输入： 无
    输出： 控制台打印用户查询结果
    步骤拆解：
    1.无限循环，直到用户输入"quit"退出
    2.等待用户输入的查询内容，如果为空则继续循环
    3.如果用户输入的查询内容以"@"开头，则认为是资源查询，获取对应的资源并打印，查询资源的时候是进行拼接操作的
    4.如果用户输入的查询内容以"/"开头，则认为是提示查询，解析命令并执行对应的操作。如果用户输入的是"/prompts"，则列出所有可用的提示；
        如果输入的是"/prompt"，需要解析提示名字和参数，用户的输入格式必须为“/prompt prompt_name args1=value1 args2=value2”的格式，
        例如："/prompt generate_search_prompt topic=computer num_papers=3"
    5.如果用户输入的查询内容不是资源查询和提示查询，则认为是普通查询，调用 process_query 方法处理查询
    """
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
                        for arg in parts[2:]:
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

    async def main(self):
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

    """
    函数名： connect_to_single_server
    功能： 连接到单个服务器
    输入： server_name: str 服务器名称
              server_config: Dict[str, Any] 服务器配置
    输出： 无
    步骤拆解：
         1.根据服务器配置信息，初始化标准输入输出连接的客户端和session会话对象，并使用AsyncExitStack来管理资源的清理
         2.拿到session对象并初始化完成后，分别获取该mcp服务上可用的工具、提示和资源，并分别进行存储
         3.对于工具，资源和提示，都将其的名称作为key，session对象作为value存储在一个字典中，方便后续根据名称获取对应的session对象
         4.对于工具，还需要使用数组存储所有工具的结构信息，用于喂给大模型，让它知道我都有哪些工具可以调用
         5.资源和提示的话，由于是用户主动查询的，所以只需要存储在字典中，方便根据名称获取对应的session并利用session执行mcp server的对应的资源和提示的函数，获取最终的资源和提示的结果
    """
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
                        # self.available_prompts.append({
                        #     "name": prompt.name,
                        #     "description": prompt.description,
                        #     "arguments": prompt.arguments,
                        # })
                        self.available_prompts.append(vars(prompt))

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

    """
    函数名： connect_to_servers
    功能： 连接到多个服务器
    输入： 无
    输出： 无
    步骤拆解：
    1.读取服务器配置文件 server_config.json，获取所有服务器的配置信息
    2.遍历所有服务器的配置信息，调用 connect_to_single_server 函数连接到每个服务器
    """
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