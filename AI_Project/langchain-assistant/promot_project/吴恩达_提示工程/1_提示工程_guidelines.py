
from langchain_ollama import OllamaLLM
from langchain.prompts import PromptTemplate

llm = OllamaLLM(model="llama3", temperature=0.7,stream=False)
prompt = PromptTemplate.from_template("请用中文回答：{question}")
chain =  prompt | llm
response = chain.invoke({"question":"What is the capital of France?"})
print(response)

# notes
### 提示工程的原则：
# 1. 写清晰且具体的指令 clear 不等于 short
# 2. 给模型思考的时间

# 例如：总结模板
summary_prompt = PromptTemplate.from_template(
    """
    你是一个智能助手，负责总结用户提供的文本。请用一句话总结以下内容：
    
    ```{text}```
    
    请确保总结包含主要观点和关键信息。
    请用中文回答。
    """
)
chain1 = summary_prompt | llm
response = chain1.invoke({"text": "约翰尼·方坦站起身。他憎恨地上的这个女人，但她的美貌仿佛魔力盾牌。玛格特翻个身，舞蹈演员似的一跃而起，面对他站住。她跳起孩子的嘲笑舞步，唱着说：“约翰尼永远不会伤害我，约翰尼永远不会伤害我。”随后板起美丽的脸蛋，近乎于哀伤地说，“可怜的傻瓜浑蛋，打得我不痛不痒像个小孩。唉，约翰尼，永远是个傻乎乎意大利佬，那么浪漫，连做爱都像小孩，还以为打炮真像你唱的那些白痴小调。”她摇摇头，说，“可怜的约翰尼。再会了，约翰尼。”她走进卧室，他听见她转动钥匙锁门。约翰尼坐在地上，脸埋在手里。屈辱得想吐的绝望淹没了他。但没过多久，帮他在好莱坞丛林活下来的草根韧性使他拿起电话，叫车送他去机场。有个人能救他。他要回纽约。回去找那个有权力、有智慧、让他信任的人。他的教父，柯里昂。\n面包师纳佐里尼和他烤的意式长棍一样敦实，一样硬邦邦；他满身面粉，怒视老婆、正值婚龄的女儿凯瑟琳和帮工恩佐。恩佐换上了带绿字臂章的战俘制服，害怕这一幕会搞得他来不及回总督岛报到。他是成千上万的意大利战俘之一，每天假释出来为美国经济作贡献，他生活在持续的恐惧之中，唯恐假释被撤销。因此正在上演的这一幕小小喜剧，对他来说却严肃得无以复加。"})
print(response)