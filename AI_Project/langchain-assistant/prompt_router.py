from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from langchain_community.llms import Ollama

llm = Ollama(model="llama3")
intent_prompt = PromptTemplate.from_template("""
你是一个意图分类器。我们系统支持以下任务类型：
- 总结
- 改写
- 翻译
请判断下列用户输入最接近哪个任务类型。请只输出对应的任务类型，不要解释。
用户输入：{user_input}
任务类型：
""")

intent_chain = LLMChain(prompt=intent_prompt,llm=llm)

def classify_intent(user_input:str)->str:
    return intent_chain.run({"user_input": user_input}).strip()

summary_prompt = PromptTemplate.from_template("请用一句话总结以下内容：\n\n{text}")
summary_prompt_chain = LLMChain(prompt=summary_prompt,llm=llm)

rewrite_prompt = PromptTemplate.from_template("请用更通俗的语言改写以下内容：\n\n{text}")
rewrite_prompt_chain = LLMChain(prompt=rewrite_prompt,llm=llm)

translation_prompt = PromptTemplate.from_template("请将以下内容翻译成英文：\n\n{text}")
translation_prompt_chain = LLMChain(prompt=translation_prompt,llm=llm)

def route_task(user_input:str,intent:str)->str:
    if intent == "总结":
        return summary_prompt_chain.run({"text": user_input}).strip()
    elif intent == "改写":
        return rewrite_prompt_chain.run({"text": user_input}).strip()
    elif intent == "翻译":
        return translation_prompt_chain.run({"text": user_input}).strip()
    else:
        return "无法识别的任务类型"

if __name__ == "__main__":
    print("🤖 智能意图识别路由系统，输入 exit 退出")
    while True:
        user_input = input("你：")
        if user_input.lower() in ['exit', 'quit']:
            break
        intent = classify_intent(user_input)
        print("系统识别意图：", intent)
        result = route_task(user_input,intent)
        print("输出结果：", result)