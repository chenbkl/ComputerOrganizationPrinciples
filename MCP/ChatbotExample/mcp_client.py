import json
from typing import List

from dotenv import load_dotenv
import anthropic

mapping_tool = {
    "search_papers": "search_papers",
    "extract_info": "extract_info"
}

tools = {
    "search_papers": {
        "description": "Search for papers on a given topic",
        "args": {
            "topic": {"type": "string", "description": "The topic to search for papers on"},
            "num_results": {"type": "integer", "description": "Number of results to return", "default": 5}
        }
    },
    "extract_info": {
        "description": "Extract information about a specific paper",
        "args": {
            "paper_id": {"type": "string", "description": "The ID of the paper to extract information from"}
        }
    }
}

def execute_tool(tool_name, tool_args):
    result = mapping_tool[tool_name](**tool_args)
    if isinstance(result, dict):
        return json.dumps(result)
    elif isinstance(result, List):
        return result.join(',')
    else:
        return str(result)


load_dotenv()
client = anthropic.Anthropic()

def process_query(query):
    messages = {
        "role":"user",
        "content":query
    }
    response = client.messages.create(
        model="claude-3-7-sonnet-20250219",
        messages=messages,
        tools=tools,
        tool_choice="auto",
    )
    process_query_flag = True
    while process_query_flag:
        assistant_content = []
        user_tools_content = []
        for content in response.content:
            if content.type == "text":
                assistant_content.append(content.text)
                if len(response.content) == 1:
                    process_query_flag = False
            elif content.type == "tool_user":
                user_tools_content.append(content)

                tool_id = content.id
                tool_name = content.name
                tool_args = content.args

                result = execute_tool(tool_name, tool_args)
                user_tools_content.append({"type":"tool_result", "id": tool_id, "result": result})

        messages = messages.append({
            "role": "assistant",
            "content": assistant_content,
        })
        messages = messages.append({
            "role": "tool_user",
            "content": user_tools_content,
        })
        response = client.messages.create(
            model="claude-3-7-sonnet-20250219",
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )

def chat_loop():
    print("Welcome to the MCP Client! Type 'exit' to quit.")
    while True:
        try:
            user_input = input("Query: ")
            if user_input.lower() == "exit":
                break
            process_query(user_input)
        except Exception as e:
            print("An error occurred:", str(e))




from mcp import ClientSession,StdioServerParameters,types
from mcp.client.stdio import  stdio_client

#create server parameters for stdio connection
server_params = StdioServerParameters(
    command="uv",
    args=["run","mcp_server.py"],
    env=None
)

async def run():
    # Launch the server as a subprocess
    # read is the stream that the client will use to read msgs from the server
    # write is the stream that the client will use to write msgs to the server
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # initialize the connection(1:1 connection with the server)
            await session.initialize()

            #list available tools
            tools = await session.list_tools()

            #will call the chat_loop here
            #......


            # call a tool:this will be in the process_query method
            result = await session.call_tool("tool_name",arguments={})


if __name__ == "__main__":
    import asyncio
    asyncio.run(run())
    # chat_loop()  # Uncomment to run the chat loop directly without MCP client session`