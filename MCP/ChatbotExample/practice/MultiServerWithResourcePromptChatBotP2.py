from MultiServerChatBot import ToolDefinition
from contextlib import AsyncExitStack
from typing import List, Dict, Any


class MultiServerWithResourcePromptChatBotP2:
    def __init__(self, server_name, resource_prompt):
        self.async_exit_stack = AsyncExitStack()
        self.available_tools:List[ToolDefinition] = []
        self.resource_prompt_tool_mapping = {}