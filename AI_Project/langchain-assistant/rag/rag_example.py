from langchain.chains.retrieval_qa.base import RetrievalQA
from langchain_community.document_loaders import TextLoader
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaLLM
from langchain_text_splitters import CharacterTextSplitter


loader = TextLoader("./docs/example.md", encoding="utf-8")
documents = loader.load()

# 分割文档
text_splitter = CharacterTextSplitter(chunk_size=500,chunk_overlap=100)
docs = text_splitter.split_documents(documents)

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
db = FAISS.from_documents(docs,embeddings=embeddings)

llm = OllamaLLM(model="llama3", temperature=0.7, stream=False)

retriever = db.as_retriever()
# qa = RetrievalQA.from_chain_type(llm,retriever=retriever)

query = "What is the purpose of this document?"
retrieved_docs = retriever.get_relevant_documents(query=query)
context = "\n".join([doc.page_content for doc in retrieved_docs])
response = llm.invoke(f"请根据一下内容回答问题：\n{context}\n\n问题：{query}")
print(response)