import arxiv
from typing import List
import json
from mcp.server.fastmcp import FastMCP
import os

mcp = FastMCP("research")

paper_dir = "papers"

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

if __name__ == "__main__":
    mcp.run(transport='stdio')
    print("MCP server is running...")