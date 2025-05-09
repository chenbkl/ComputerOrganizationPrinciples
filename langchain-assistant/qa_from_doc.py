from langchain_community.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.llms import Ollama
from langchain.chains import RetrievalQA

# 步骤 1：加载文档
loader = TextLoader("your_file.txt", encoding="utf-8")
docs = loader.load()

# 步骤 2：切分文档
splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
chunks = splitter.split_documents(docs)

# 步骤 3：转为向量（用 Ollama 模型 embedding）
embedding = OllamaEmbeddings(model="llama3")

# 步骤 4：建立向量数据库
db = Chroma.from_documents(chunks, embedding)

# 步骤 5：初始化本地语言模型
llm = Ollama(model="llama3")

# 步骤 6：构建 RetrievalQA 链
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=db.as_retriever(),
    return_source_documents=True
)

# 步骤 7：问问题
while True:
    query = input("\n❓ 你想问什么？(输入 exit 退出)\n> ")
    if query.lower() in ["exit", "quit"]:
        break
    result = qa_chain({"query": query})
    print("\n🧠 答案：", result["result"])
    print("\n📄 来源片段：")
    for doc in result["source_documents"]:
        print("-", doc.page_content[:200])