"""
Standalone worker process that runs the legacy VulnSeeker pipeline inside an
isolated task workspace.
"""

from __future__ import annotations

import argparse
import os
import sys
import subprocess
import shutil
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.codeql.fetch_repos import build_local_codeql_db, fetch_codeql_dbs
from src.codeql.run_codeql_queries import compile_and_run_codeql_queries
from src.utils.config import get_codeql_path
from src.utils.config_validator import validate_and_exit_on_error
from src.utils.common_functions import get_all_dbs
from src.vulnseeker import IssueAnalyzer
from src.utils.logger import get_logger

logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run one isolated VulnSeeker web task")
    parser.add_argument("--mode", required=True, choices=("github", "local_db", "local_src"))
    parser.add_argument("--language", required=True)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--repo-url")
    parser.add_argument("--source-path")
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--threads", type=int, default=16)
    return parser.parse_args()


def _resolve_server_path(raw_path: str) -> Path:
    candidate = Path(raw_path.strip()).expanduser()
    if not candidate.is_absolute():
        candidate = PROJECT_ROOT / candidate
    return candidate.resolve(strict=False)


def normalize_local_db_path(raw_path: str) -> Path:
    path = _resolve_server_path(raw_path)
    if path.name == "codeql-database.yml":
        path = path.parent

    if not path.exists():
        raise ValueError(f"Local database path does not exist: {path}")
    if not path.is_dir():
        raise ValueError(f"Local database path must be a directory: {path}")
    if not get_all_dbs(str(path)):
        raise ValueError(
            "Local database path must point to a CodeQL database directory or a folder containing one"
        )
    return path


def normalize_local_source_path(raw_path: str) -> Path:
    path = _resolve_server_path(raw_path)
    if not path.exists():
        raise ValueError(f"Local source path does not exist: {path}")
    if not path.is_dir():
        raise ValueError(f"Local source path must be a directory: {path}")
    return path


def run() -> int:
    args = parse_args()
    workspace = Path(args.workspace).resolve()
    workspace.mkdir(parents=True, exist_ok=True)
    os.chdir(workspace)

    validate_and_exit_on_error()

    if args.mode == "github":
        if not args.repo_url:
            raise ValueError("repo-url is required for github mode")
        # For GitHub mode, just pick the first language if multiple are provided
        primary_lang = args.language.split(",")[0].strip()
        dbs_dir = fetch_codeql_dbs(
            lang=primary_lang,
            threads=args.threads,
            repo_name=args.repo_url,
            force=args.force,
        )
        if not dbs_dir:
            logger.info("No pre-built CodeQL DB found on GitHub for %s.", args.repo_url)
            logger.info("Falling back to local source build: Cloning repository...")
            
            # Use PROJECT_ROOT / "temp_repo" to avoid cluttering workspace
            temp_repo_dir = PROJECT_ROOT / "temp_repo" / args.repo_url.replace("/", "_")
            if temp_repo_dir.exists():
                shutil.rmtree(temp_repo_dir, ignore_errors=True)
                
            temp_repo_dir.parent.mkdir(parents=True, exist_ok=True)
            
            repo_url_to_clone = f"https://github.com/{args.repo_url}.git"
            
            try:
                subprocess.run(
                    ["git", "clone", "--depth", "1", repo_url_to_clone, str(temp_repo_dir)],
                    check=True,
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT
                )
            except subprocess.CalledProcessError as e:
                logger.error("Failed to clone repository:\n%s", e.stdout)
                raise ValueError(f"Failed to clone {repo_url_to_clone} for local fallback.") from e
                
            logger.info("Repository cloned successfully. Proceeding with local build.")
            dbs_dir = build_local_codeql_db(
                source_path=str(temp_repo_dir),
                lang=args.language,
                threads=args.threads,
                force=True, # Force rebuild since it's a fresh clone
            )

    elif args.mode == "local_db":
        if not args.source_path:
            raise ValueError("source-path is required for local_db mode")
        dbs_dir = str(normalize_local_db_path(args.source_path))
    else:
        if not args.source_path:
            raise ValueError("source-path is required for local_src mode")
        dbs_dir = build_local_codeql_db(
            source_path=str(normalize_local_source_path(args.source_path)),
            lang=args.language,
            threads=args.threads,
            force=args.force,
        )

    compile_and_run_codeql_queries(
        codeql_bin=get_codeql_path(),
        lang=args.language,
        threads=args.threads,
        timeout=600,
        dbs_dir=dbs_dir,
    )

    lang_list = [l.strip() for l in args.language.split(",")]
    for current_lang in lang_list:
        analyzer = IssueAnalyzer(lang=current_lang)
        analyzer.run(dbs_dir)

    return 0


if __name__ == "__main__":
    raise SystemExit(run())
