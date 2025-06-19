import arxiv
from typing import List
import json
from mcp.server.fastmcp import FastMCP
import os

mcp = FastMCP("research")

paper_dir = "../papers"

@mcp.tool()
def search_papers(topic: str, max_results: int = 5) -> List[str]:
    """
    Search for papers on arXiv based on a topic and store their information.
    args:
    :param topic: The topic to search for papers on arXiv.
    :param max_results: The maximum number of results to retrieve. default is 5.
    :returns:
     List of paper IDs found in the search.
    """

    # use arxiv to find the papers
    client = arxiv.Client()

    # Search for the most relevant articles matching the queried topic
    search = arxiv.Search(
        query=topic,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.Relevance
    )

    papers = client.results(search)

    # create a directory to store the papers if it doesn't exist
    path = os.path.join(paper_dir, topic.lower().replace(" ", "_"))
    os.makedirs(path, exist_ok=True)

    file_path = os.path.join(path, "papers_info.json")

    try:
        with open(file_path, "r") as json_file:
            papers_info = json.load(json_file)
    except (FileNotFoundError, json.decoder.JSONDecodeError):
        papers_info = {}

    #     Process each paper and add to papers_info
    paper_ids = []
    for paper in papers:
        paper_ids.append(paper.get_short_id())
        paper_info = {
            "title": paper.title,
            "authors": [author.name for author in paper.authors],
            "summary": paper.summary,
            "pdf_url": paper.pdf_url,
            "published": str(paper.published.date()),
        }
        papers_info[paper.get_short_id()] = paper_info

    #     Save updated papers_info to JSON file
    with open(file_path, "w") as json_file:
        json.dump(papers_info, json_file, indent=2)

    print(f"Results are saved in {file_path}")
    return papers_info

@mcp.tool()
def extract_info(paper_id: str) -> str:
    """
    Extract information about a specific paper.
    args:
    :param paper_id: The ID of the paper to extract information from.
    :returns:
     A string containing the paper's title, authors, summary, and published date.
    """

    file_path = os.path.join(paper_dir, paper_id.split('/')[0], "papers_info.json")

    try:
        with open(file_path, "r") as json_file:
            papers_info = json.load(json_file)
            if paper_id in papers_info:
                paper_info = papers_info[paper_id]
                return json.dumps(paper_info, indent=2)
            else:
                return f"Paper with ID {paper_id} not found."
    except FileNotFoundError:
        return f"No information available for paper with ID {paper_id}."

import mcp

@mcp.resource("papers://folders")
def get_available_folders() -> str:
    """
    List all available topic folders in the papers directory.

    This resource provides a simple list of all available topic folders.
    """
    folders = []

    # Get all topic directories
    if os.path.exists(paper_dir): #判断论文文件夹是否存在
        for topic_dir in os.listdir(paper_dir): #遍历论文文件夹下的所有子目录
            topic_path = os.path.join(paper_dir, topic_dir) #拼接子目录的路径
            if os.path.isdir(topic_path): #判断是否为文件夹
                papers_file = os.path.join(topic_path, "papers_info.json") #拼接子目录下的papers_info.json文件路径，其中paper.json中存储的是论文的信息
                if os.path.exists(papers_file): #判断该json文件是否存在，如果存在，则添加到文件夹列表中
                    folders.append(topic_dir)

    # Create a simple markdown list
    content = "# Available Topics\n\n"
    if folders:
        for folder in folders:
            content += f"- {folder}\n"
            content += f"\nUse @{folder} to access papers in that topic.\n"
    else:
        content += "No topics found.\n"

    return content


@mcp.resource("papers://{topic}",type='markdown')
def get_topic_papers(topic: str) -> str:
    """
    Get detailed information about papers on a specific topic.

    Args:
        topic: The research topic to retrieve papers for
    """
    topic_dir = topic.lower().replace(" ", "_")
    papers_file = os.path.join(paper_dir, topic_dir, "papers_info.json")

    if not os.path.exists(papers_file):
        return f"# No papers found for topic: {topic}\n\nTry searching for papers on this topic first."

    try:
        with open(papers_file, 'r') as f:
            papers_data = json.load(f)

        # Create markdown content with paper details
        content = f"# Papers on {topic.replace('_', ' ').title()}\n\n"
        content += f"Total papers: {len(papers_data)}\n\n"

        for paper_id, paper_info in papers_data.items():
            content += f"## {paper_info['title']}\n"
            content += f"- **Paper ID**: {paper_id}\n"
            content += f"- **Authors**: {', '.join(paper_info['authors'])}\n"
            content += f"- **Published**: {paper_info['published']}\n"
            content += f"- **PDF URL**: [{paper_info['pdf_url']}]({paper_info['pdf_url']})\n\n"
            content += f"### Summary\n{paper_info['summary'][:500]}...\n\n"
            content += "---\n\n"

        return content
    except json.JSONDecodeError:
        return f"# Error reading papers data for {topic}\n\nThe papers data file is corrupted."




@mcp.prompt()
def generate_search_prompt(topic: str, num_papers: int = 5) -> str:
    """Generate a prompt for Claude to find and discuss academic papers on a specific topic."""
    return f"""Search for {num_papers} academic papers about '{topic}' using the search_papers tool. Follow these instructions:
    1. First, search for papers using search_papers(topic='{topic}', max_results={num_papers})
    2. For each paper found, extract and organize the following information:
       - Paper title
       - Authors
       - Publication date
       - Brief summary of the key findings
       - Main contributions or innovations
       - Methodologies used
       - Relevance to the topic '{topic}'

    3. Provide a comprehensive summary that includes:
       - Overview of the current state of research in '{topic}'
       - Common themes and trends across the papers
       - Key research gaps or areas for future investigation
       - Most impactful or influential papers in this area

    4. Organize your findings in a clear, structured format with headings and bullet points for easy readability.

    Please present both detailed information about each paper and a high-level synthesis of the research landscape in {topic}."""


if __name__ == "__main__":
    mcp.run(transport='stdio')
    print("MCP server is running...")