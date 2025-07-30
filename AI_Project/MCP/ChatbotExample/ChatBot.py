from typing import List,Dict,Any

from anthropic import Anthropic  # Assuming Anthropic is a class that handles the chat logic

from mcp_client import StdioServerParameters,stdio_client,ClientSession


class ChatBot:
    def __init__(self):
        self.name = "ChatBot P1"
        self.version = "1.0"
        self.greeting = "Hello! I am ChatBot P1. How can I assist you today?"
        self.client = Anthropic()  # Assuming Anthropics is a class that handles the chat logic
        self.available_tools: List[Dict] = []
        self.sessions:ClientSession = None  # This could be used to manage multiple user sessions if needed


    # 这个函数代表一次查询过程
    async def process_query(self, user_input):
        messages = [{
            "role": "user",
            "content": user_input
        }]
        response = self.client.messages.create(
            model="claude-3-7-sonnet-20250219",
            messages=messages,
            tools=self.available_tools,  # Assuming no tools are used in this simple version
            max_tokens=2024
        )

        _query = True
        while _query:
            assistant_content = []
            user_messages_content = []
            for content in response.content:
                if content.type == "text":
                    assistant_content.append(content.text)
                    if len(response.content) == 1:
                        _query = False
                elif content.type == "tool_use":
                    assistant_content.append(content)
                    tool_id = content.id
                    tool_name = content.name
                    tool_args = content.input
                    # Here you would execute the tool and get the result
                    result = await self.sessions.call_tool(tool_name,arguments=tool_args)
                    user_messages_content.append({"type": "tool_result", "tool_use_id": tool_id, "content": result})

            messages.append({
                "role": "assistant",
                "content": assistant_content,
            })
            messages.append({
                "role": "user",
                "content": user_messages_content,
            })
            response = self.client.messages.create(
                model="claude-3-7-sonnet-20250219",
                messages=messages,
                tools=self.available_tools,  # Assuming no tools are used in this simple version
                max_tokens=2024
            )

    async def chat_loop(self):
        print(self.greeting)
        while True:
            try:
                user_input = input("Query: ").strip()
                if user_input.lower() == "exit":
                    print("Exiting the chat. Goodbye!")
                    break
                await self.process_query(user_input)
            except Exception as e:
                print(f"An error occurred: {str(e)}")

    async def connect_to_server_and_run(self):
        print("Connecting to the server...")
        # Here you would implement the logic to connect to the server
        # For now, we will just start the chat loop
        server_params = StdioServerParameters(
            command="uv",
            args=["run","practice/mcp_server_p1.py"],
            env=None
        )

        async with stdio_client(server_params) as (read,write):
            print("Connected to the server.")
            async with ClientSession(read,write) as session:
                self.sessions = session
                await session.initialize()
                response_tools = await session.list_tools()
                tools = response_tools.tools
                self.available_tools = [
                    {
                        "name": tool.name,
                        "description": tool.description,
                        "input_schema": tool.inputSchema
                    } for tool in tools
                ]
                await self.chat_loop()


import asyncio
if __name__ == "__main__":
    chatbot = ChatBot()
    asyncio.run(chatbot.connect_to_server_and_run())