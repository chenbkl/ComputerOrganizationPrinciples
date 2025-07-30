from langchain_community.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.llms import Ollama
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory

# 1. 加载文档
loader = TextLoader("your_file.txt", encoding="utf-8")
docs = loader.load()

# 2. 切分文档
splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
chunks = splitter.split_documents(docs)

# 3. 转向量
embedding = OllamaEmbeddings(model="llama3")
db = Chroma.from_documents(chunks, embedding)

# 4. 初始化模型
llm = Ollama(model="llama3")

# 5. 初始化记忆
memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

# 6. 构建多轮问答链
qa = ConversationalRetrievalChain.from_llm(
    llm=llm,
    retriever=db.as_retriever(),
    memory=memory,
    return_source_documents=True,
    verbose=True,
)

# 7. 交互
print("📚 多轮文档问答助手，输入 exit 退出")
while True:
    query = input("\n你：")
    if query.lower() in ["exit", "quit"]:
        break
    result = qa({"question": query})
    print("\n🤖 AI：", result["answer"])
