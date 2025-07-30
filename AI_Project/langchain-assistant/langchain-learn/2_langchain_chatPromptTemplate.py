from platform import system

from  langchain.prompts import ChatPromptTemplate,HumanMessagePromptTemplate,AIMessagePromptTemplate,SystemMessagePromptTemplate
from langchain_ollama import OllamaLLM

system = SystemMessagePromptTemplate.from_template("你是一个智能助手，负责回答用户的问题。请用中文回答。")
human = HumanMessagePromptTemplate.from_template("{input}")

ai = AIMessagePromptTemplate.from_template("{history_response}")


chat_prompt = ChatPromptTemplate.from_messages([system, human,ai])


messages = chat_prompt.format_messages(input="它的人口是多少？",history_response="巴黎")
print(messages)

llm = OllamaLLM(model="llama3", temperature=0.7,stream=False)


response = llm.invoke(messages)
print(response)