
from langchain_community.llms import Ollama
from langchain.chains import ConversationChain
from langchain.memory import ConversationBufferMemory

# 初始化本地模型
llm = Ollama(model="llama3", temperature=0.7)

# 初始化记忆
memory = ConversationBufferMemory()

# 创建对话链
conversation = ConversationChain(
    llm=llm,
    memory=memory,
    verbose=False
)

# 简易对话
print("🤖 本地 LLM 助手，输入 exit 退出")
while True:
    user_input = input("你：")
    if user_input.lower() in ['exit', 'quit']:
        break
    response = conversation.run(user_input)
    print("助手：", response)
