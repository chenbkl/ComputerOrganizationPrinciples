
from typing import List,Dict,Any
from contextlib import AsyncExitStack
from anthropic import Anthropic
from mcp import StdioServerParameters, stdio_client, ClientSession
from pydantic import BaseModel

class ToolDefinitionP1(BaseModel):
    name: str
    description: str
    input_schema: dict

class MultiServerWithResourcePromptChatBotP1:

    def __init__(self, server):
        # 因为有多个server，所以用字典的形式来存储prompt resource_url tool_name 和session的映射关系，方便快速找到session之后调用对应的函数
        self.prompt_resource_tool_map:Dict[str, Any] = []
        self.async_exit_stack = AsyncExitStack()
        self.llm = Anthropic()
        self.available_tools:List[ToolDefinitionP1] = []
        self.available_prompts:List[str] = []


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
                

