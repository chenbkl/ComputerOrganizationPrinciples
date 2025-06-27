from xml.dom.minidom import Document

from langchain.prompts import PromptTemplate
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_ollama import OllamaLLM
from langchain.text_splitter import RecursiveCharacterTextSplitter



# def extract_triplets_with_langchain(text, model="llama3"):
#     """
#     Extracts triplets from the given text using LangChain and a specified model.
#
#     Args:
#         text (str): The input text from which to extract triplets.
#         model (str): The model to use for extraction. Default is "llama3".
#
#     Returns:
#         list: A list of extracted triplets.
#     """
#     prompt = PromptTemplate(
#         input_variables=["text"],
#         template="""
#     你是一个知识抽取专家，请从下面文本中提取三元组（实体1，关系，实体2）。
#     文本：
#     {text}
#     输出格式：[(实体1, 关系, 实体2), ...]
#     """
#     )
#
#     llm = OllamaLLM(model=model,base_url="http://localhost:11434")  # Adjust the base URL if necessary
#     # chain = LLMChain(llm=llm, prompt=prompt)
#     chain = prompt | llm
#     try:
#         result = chain.invoke(input=text)
#         return result.split('\n')  # Assuming each triplet is on a new line
#     except Exception as e:
#         print(f"An error occurred while extracting triplets: {e}")
#         return []

# 1. 加载 PDF 文件
def load_pdf_documents(pdf_path:str) ->list[Document]:
    loader = PyMuPDFLoader(pdf_path)
    documents = loader.load()
    print(f"当前PDF文件一共：{len(documents)}页")
    return documents

# 2. 切片
def split_documents(documents: list[Document], chunk_size=800, chunk_overlap=100) -> list[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    chunks = splitter.split_documents(documents)
    print(f"切片数量为:{len(chunks)}")
    return chunks

def extract_triplets_from_chunks(chunks:list[Document],model="llama3") -> list:
    prompt = PromptTemplate(
        input_variables=["text"],
        template="""
    你是一个知识抽取专家，请从下面文本中提取三元组（实体1，关系，实体2）。
    文本：
    {text}
    输出格式：[(实体1, 关系, 实体2), ...]
    """
    )

    llm = OllamaLLM(model=model,base_url="http://localhost:11434")  # Adjust the base URL if necessary
    # chain = LLMChain(llm=llm, prompt=prompt)
    chain = prompt | llm

    triplets = []

    for index,chunk in enumerate(chunks):
        try:
            result = chain.invoke({"text":chunk.page_content})
            print(f"当前切片的序号为：{index}，文档内容为:{chunk.page_content}\n 提取的三元组为：{result}")
            triplets.extend(result)
        except Exception as e:
            print(f"An error occurred while extracting triplets: {e}")


    return triplets

def pdfbook_path():
    from pathlib import Path
    base_dir = Path(__file__).resolve().parent
    pdf_file = base_dir.__str__() + "/../resources/数码时代如何育儿.pdf"
    return pdf_file

if __name__ == "__main__":
    # 测试运行
    pdf_path = pdfbook_path()
    result = extract_triplets_from_chunks(split_documents(load_pdf_documents(pdf_path)))