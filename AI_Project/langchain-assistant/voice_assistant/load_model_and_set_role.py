
# langchain和本地的ollama服务进程通信

from langchain_ollama import OllamaLLM
from langchain.prompts import ChatPromptTemplate
from langchain.prompts import SystemMessagePromptTemplate
from langchain.prompts import HumanMessagePromptTemplate

from voice_assistant.tools.cb_time import set_timer
import re

llm = OllamaLLM(model="llama3", temperature=0.7)

system_template1 = SystemMessagePromptTemplate.from_template("你是一个智能家庭助手，负责回答用户的问题。请用中文回答。")
system_template2 = SystemMessagePromptTemplate.from_template("你可以回答用户关于时间和日期的问题。请用中文回答，你拥有计时功能，比如用户要求你计时20分钟，你可以回答“好的，我会在20分钟后提醒你”，并在20分钟后提醒用户。")
system_template3 = SystemMessagePromptTemplate.from_template("你可以回答用户关于育儿（1-6岁儿童）的问题")
system_template4 = SystemMessagePromptTemplate.from_template("你可以调用QQ音乐给用户播放他想听的音乐，你支持顺序播放、随机播放、单曲循环等功能，支持歌曲搜索")
# system_template5 = SystemMessagePromptTemplate.from_template("如果用户的问题中包含倒计时的需求，那么你的回答中应该包含计时器三个字，而且要包含时间长度，用minute=2这种形式来表达，其中2是用户要求的分钟数。")
system_template6 = SystemMessagePromptTemplate.from_template("""你是一个智能助手，接下来每次用户提到'提醒'或'计时'，你必须仅以如下字符串格式回复，不要添加任何解释或多余的内容：
"计时器已设置，minutes={{minutes}}分钟后提醒您。请注意查看您的计时器。" """)


system_templates = [system_template1, system_template2, system_template3, system_template4,system_template6]

human_template = HumanMessagePromptTemplate.from_template("{question}")

chat_prompt = ChatPromptTemplate.from_messages(system_templates+[human_template])

chain =  chat_prompt | llm

# 测试输入
question = "我火上炖了排骨，1分钟后提醒我"


response = chain.invoke({"question":question})
print(response)
# 使用正则匹配数字
# 判断模型输出是否包含计时器相关的内容
if "计时器" in response:
    # 假设用户请求了计时器功能
    match = re.search(r"计时器已设置，minutes=(\d+)分钟后提醒您", response)
    minutes = 0
    if match:
        minutes = int(match.group(1))
        print(f"模型建议设置计时器：{minutes}")
    else:
        print("没有匹配到分钟数，原始输出为：", response)
    # 调用计时器工具
    tool_input = {"minutes": minutes}
    timer_response = set_timer(tool_input)
    print(timer_response)
else:
    print(response)