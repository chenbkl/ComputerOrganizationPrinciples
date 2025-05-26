from langchain.memory import ConversationBufferMemory
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain_ollama import OllamaLLM

system = SystemMessagePromptTemplate.from_template("你是一个智能助手，负责回答用户的问题。请用中文回答。")
user = HumanMessagePromptTemplate.from_template("{input}")

chat_prompt = ChatPromptTemplate.from_messages([system, user])

memory = ConversationBufferMemory(return_messages=True)

llm = OllamaLLM(model="llama3", temperature=0.7, stream=False)

conversationChain = chat_prompt | llm | memory

resp1 = conversationChain.invoke({"input": "法国首都哪里？"})
print(resp1)
resp2 = conversationChain.invoke({"input": "它的人口是多少？"})
print(resp2)
resp3 = conversationChain.invoke({"input": "你知道鲁迅吗？"})
print(resp3)
resp4 = conversationChain.invoke({"input": "他有哪些知名作品？"})
print(resp4)
resp5 = conversationChain.invoke({"input": "他为什么这么些？"})
print(resp5)