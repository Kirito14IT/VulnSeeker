"""
Adapters that reuse the legacy TUI result parsing logic for the web APIs.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from api.schemas import CodeSnippet, IssueDetail, IssueSummary, RepoStat
from src.ui.issue_parser import collect_all_code_snippets, extract_code_blocks_from_text, extract_last_message
from src.ui.models import Issue
from src.ui.results_loader import ResultsLoader


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
    issues, _ = loader.load_all_issues(language, include_raw_only=True)
    return issues


def find_task_issue(results_root: Path, language: str, issue_id: str) -> Optional[Issue]:
    issues = load_task_issues(results_root, language)
    for issue in issues:
        if issue.id == issue_id:
            return issue
    return None


def load_global_issues(results_root: Path, language: str = "c") -> list[Issue]:
    loader = ResultsLoader(str(results_root))
    issues, _ = loader.load_all_issues(language)
    saved_decisions = loader.load_manual_decisions()
    for issue in issues:
        issue.manual_decision = saved_decisions.get(issue.final_path)
    return issues


def build_repo_stats(issues: list[Issue]) -> list[RepoStat]:
    grouped: dict[str, dict[str, int]] = {}
    for issue in issues:
        bucket = grouped.setdefault(issue.repo, {"true": 0, "false": 0, "more": 0})
        bucket[issue.status] = bucket.get(issue.status, 0) + 1

    stats = []
    for repo, counts in sorted(grouped.items()):
        stats.append(
            RepoStat(
                repo=repo,
                total=counts["true"] + counts["false"] + counts["more"],
                true_count=counts["true"],
                false_count=counts["false"],
                more_count=counts["more"],
            )
        )
    return stats


__all__ = [
    "_issue_to_detail",
    "_issue_to_summary",
    "build_repo_stats",
    "find_task_issue",
    "load_global_issues",
    "load_task_issues",
]
