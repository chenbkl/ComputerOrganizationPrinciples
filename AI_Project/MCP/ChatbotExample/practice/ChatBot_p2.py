from mcp import ClientSession
from typing import List, Dict, Any
from anthropic import Anthropic

from mcp import StdioServerParameters, stdio_client

class ChatBotP2:

    def __init__(self):
        self.name = "ChatBotP2"
        self.version = "1.0"
        self.description = "A simple chatbot for demonstration purposes."
        self.session:ClientSession = None
        self.available_tools:[Dict[str, Any]] = []
        self.client:Anthropic = Anthropic()

    async def process_query(self, query):
        messages = [{"role": "user", "content": query}]
        response = self.client.messages.create(
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
                    # Here you would execute the tool and get the result
                    result = await self.session.call_tool(tool_name, arguments=tool_args)
                    user_tools_content.append({"type": "tool_result", "tool_use_id": tool_id, "content": result})

            messages.append({
                "role": "assistant",
                "content": assistant_content,
            })
            messages.append({
                "role": "user",
                "content": user_tools_content,
            })
            response = self.client.messages.create(
                model="claude-3-7-sonnet-20250219",
                messages=messages,
                tools=self.available_tools,
                max_tokens=2024
            )

    async def chat_loop(self):
        """
        Starts the chat loop for the chatbot.
        This method will continuously prompt the user for input and process queries.
        """
        while True:
            try:
                user_input = input("> Query: ").strip()
                if user_input.lower() == "exit":
                    print("Exiting the chat. Goodbye!")
                    break
                await self.process_query(user_input)
            except Exception as e:
                print(f"An error occurred: {e}")
                continue


    async def connect_server_and_run(self):
        """
        Connects to the server and starts the chat loop.
        This method initializes the session and starts the chat loop.
        """
        server_params = StdioServerParameters(
            command="uv",
            args=["run", "mcp_server.py"],
        )
        async with stdio_client(server_params) as (reader, writer):
            async with ClientSession(reader,writer) as session:
                self.session = session
                await session.initialize()
                tools_response = await session.list_tools()
                self.available_tools = [
                    {
                        "name": tool.name,
                        "description": tool.description,
                        "arguments": tool.inputSchema,
                    } for tool in tools_response.tools
                ]
                # 会话建立连接后，相当于外部工具准备好了，就可以进行聊天了
                await self.chat_loop()


if __name__ == "__main__":
    import asyncio

    chatbot = ChatBotP2()
    asyncio.run(chatbot.connect_server_and_run())
