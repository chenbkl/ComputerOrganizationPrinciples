
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello, World!"}


class QuestionRequest(BaseModel):
    question: str

class AnswerResponse(BaseModel):
    answer: str


@app.post("/ask",response_model=AnswerResponse)
async def ask_question(req:QuestionRequest):
    q = req.question.lower()
    if "rag" in q:
        replay = "RAG（Retrieval-Augmented Generation）是一种结合检索和生成的模型架构，旨在提高自然语言处理任务的性能。它通过检索相关信息来增强生成模型的回答能力。"
    else:
        replay = f"你问了{req.question},但是我还没有能力回答这个问题。"

    return {"answer": replay}

