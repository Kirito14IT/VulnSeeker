"""
Adapters that reuse the legacy TUI result parsing logic for the web APIs.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from api.schemas import CodeSnippet, IssueDetail, IssueSummary, RepoStat
from src.utils.issue_parser import collect_all_code_snippets, extract_code_blocks_from_text, extract_last_message
from src.utils.models import Issue
from src.utils.results_loader import ResultsLoader


def _issue_to_summary(issue: Issue, manual_decision: Optional[str]) -> IssueSummary:
    return IssueSummary(
        id=issue.id,
        name=issue.name.strip('"'),
        file=issue.file.strip('"'),
        line=issue.line,
        status=issue.status,
        finalized=bool(issue.final_data),
        issue_type=issue.issue_type,
        repo=issue.repo,
        manual_decision=manual_decision,
    )


def _issue_to_detail(issue: Issue, manual_decision: Optional[str]) -> IssueDetail:
    initial_code, additional_code = collect_all_code_snippets(issue)
    if not initial_code and issue.raw_data and isinstance(issue.raw_data.get("prompt"), str):
        raw_prompt_blocks = extract_code_blocks_from_text(issue.raw_data["prompt"])
        if raw_prompt_blocks:
            initial_code = raw_prompt_blocks[0]
            additional_code = raw_prompt_blocks[1:]

    snippets: list[CodeSnippet] = []
    if initial_code:
        snippets.append(CodeSnippet(label="Initial Code Context", content=initial_code, language="cpp"))
    for index, snippet in enumerate(additional_code, start=1):
        snippets.append(CodeSnippet(label=f"Additional Code {index}", content=snippet, language="cpp"))

    return IssueDetail(
        **_issue_to_summary(issue, manual_decision).model_dump(),
        summary=extract_last_message(issue.final_data) or (
            "LLM analysis did not finish for this issue. Showing the raw CodeQL match and prompt context."
            if not issue.final_data else None
        ),
        snippets=snippets,
        raw_data=issue.raw_data,
        final_data=issue.final_data,
    )


def load_task_issues(results_root: Path, language: str) -> list[Issue]:
    loader = ResultsLoader(str(results_root))
    all_issues = []
    for lang in [l.strip() for l in language.split(",")]:
        issues, _ = loader.load_all_issues(lang, include_raw_only=True)
        all_issues.extend(issues)
    return all_issues


def find_task_issue(results_root: Path, language: str, issue_id: str) -> Optional[Issue]:
    issues = load_task_issues(results_root, language)
    for issue in issues:
        if issue.id == issue_id:
            return issue
    return None


def load_global_issues(results_root: Path, language: str = "cpp") -> list[Issue]:
    """
    Load issues from the legacy global results folder using ResultsLoader.
    """
    if not results_root.exists():
        return []

    loader = ResultsLoader(str(results_root))
    all_issues = []
    for lang in [l.strip() for l in language.split(",")]:
        issues, _ = loader.load_all_issues(lang)
        all_issues.extend(issues)

    saved_decisions = loader.load_manual_decisions()
    for issue in all_issues:
        issue.manual_decision = saved_decisions.get(issue.final_path)
    return all_issues


def build_repo_stats(issues: list[Issue]) -> list[RepoStat]:
    from collections import defaultdict

    stats: dict[str, dict[str, int]] = defaultdict(
        lambda: {"total": 0, "true_count": 0, "false_count": 0, "more_count": 0}
    )

    for issue in issues:
        repo = issue.repo
        status = (issue.manual_decision or issue.status).strip()
        stats[repo]["total"] += 1

        if status == "True Positive":
            stats[repo]["true_count"] += 1
        elif status == "False Positive":
            stats[repo]["false_count"] += 1
        elif status == "Uncertain":
            stats[repo]["more_count"] += 1
        else:
            stats[repo]["more_count"] += 1

    return [
        RepoStat(
            repo=r,
            total=s["total"],
            true_count=s["true_count"],
            false_count=s["false_count"],
            more_count=s["more_count"],
        )
        for r, s in stats.items()
    ]


__all__ = [
    "_issue_to_detail",
    "_issue_to_summary",
    "build_repo_stats",
    "find_task_issue",
    "load_global_issues",
    "load_task_issues",
]
