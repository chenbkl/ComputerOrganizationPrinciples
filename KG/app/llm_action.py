

import requests

def extract_triplets(text,model="llama3"):
    """
    Extracts triplets from the given text using a specified model.

    Args:
        text (str): The input text from which to extract triplets.
        model (str): The model to use for extraction. Default is "llama3".

    Returns:
        list: A list of extracted triplets.
    """
    prompt = f"""
    请从以下文本中提取所有事实性三元组。输出格式如下：
    (实体1, 关系, 实体2)
    文本：
    {text}
    """
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json().get("triplets", [])
    except requests.RequestException as e:
        print(f"An error occurred while extracting triplets: {e}")
        return []

text = "牛顿提出了万有引力定律，并著有《自然哲学的数学原理》。"
triplets = extract_triplets(text)
print(triplets)