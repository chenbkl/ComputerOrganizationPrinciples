import fitz
# from llm_langchian_action import extract_triplets_with_langchain
from pathlib import Path

def extract_text_from_pdf(pdf_path):
    """
    Extracts text from a PDF file.

    Args:
        pdf_path (str): The path to the PDF file.

    Returns:
        str: The extracted text from the PDF.
    """
    text = ""
    try:
        with fitz.open(pdf_path) as pdf_document:
            for page in pdf_document:
                text += page.get_text()
    except Exception as e:
        print(f"An error occurred while reading the PDF: {e}")

    return text

def pdfbook_path():
    base_dir = Path(__file__).resolve().parent
    pdf_file = base_dir.__str__() + "/../resources/数码时代如何育儿.pdf"
    return pdf_file