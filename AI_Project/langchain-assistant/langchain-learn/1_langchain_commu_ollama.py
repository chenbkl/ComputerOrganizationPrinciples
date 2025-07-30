
# langchain和本地的ollama服务进程通信

from langchain_ollama import OllamaLLM
from langchain.prompts import PromptTemplate



llm = OllamaLLM(model="llama3", temperature=0.7)

prompt = PromptTemplate.from_template("请用中文回答：{question}")


chain =  prompt | llm

response = chain.invoke({"question":"What is the capital of France?"})
print(response)