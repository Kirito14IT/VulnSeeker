#!/usr/bin/env python3
"""
Compile and run CodeQL queries on CodeQL databases for a specific language.

Requires that CodeQL is installed or available under the CODEQL path.
By default, it compiles all .ql files under 'data/queries/<LANG>/tools' and
'data/queries/<LANG>/issues', then runs them on each CodeQL database located
in 'output/databases/<LANG>'.

Example:
    python src/codeql/run_codeql_queries.py
"""

import subprocess
import os
from pathlib import Path
from typing import List, Optional

# Make sure your common_functions module is in your PYTHONPATH or same folder
from src.utils.common_functions import get_all_dbs
from src.utils.config import get_codeql_path
from src.utils.logger import get_logger
from src.utils.exceptions import CodeQLError, CodeQLConfigError, CodeQLExecutionError

logger = get_logger(__name__)


# Default locations/values
DEFAULT_CODEQL = get_codeql_path()
DEFAULT_LANG = "c"  # Mapped to data/queries/cpp for some tasks


def _format_process_output(stdout: str | None, stderr: str | None) -> str:
    """
    Return a concise process output block for error messages.
    """
    output_parts = []
    for stream_name, content in (("stdout", stdout), ("stderr", stderr)):
        text = (content or "").strip()
        if not text:
            continue
        if len(text) > 8000:
            text = "... output truncated ...\n" + text[-8000:]
        output_parts.append(f"CodeQL {stream_name}:\n{text}")
    return "\n".join(output_parts)


def _run_codeql_command(command: list[str], failure_message: str) -> None:
    """
    Run a CodeQL command and preserve its stdout/stderr in failure details.
    """
    try:
        subprocess.run(
            command,
            check=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError as e:
        raise CodeQLConfigError(
            f"CodeQL executable not found: {command[0]}. "
            "Please check your CODEQL_PATH configuration."
        ) from e
    except subprocess.CalledProcessError as e:
        output = _format_process_output(e.stdout, e.stderr)
        detail = f"\n{output}" if output else ""
        raise CodeQLExecutionError(
            f"{failure_message}: CodeQL returned exit code {e.returncode}{detail}"
        ) from e


def append_csv(source_csv: str, dest_csv: str) -> None:
    """
    Appends the content of source_csv to dest_csv and removes source_csv.
    If dest_csv does not exist, it creates it.
    """
    if not os.path.exists(source_csv):
        return
    with open(source_csv, "r", encoding="utf-8") as f_src:
        content = f_src.read()
    
    # If the file exists and has content, make sure it ends with a newline before appending
    if os.path.exists(dest_csv):
        with open(dest_csv, "a", encoding="utf-8") as f_dst:
            if os.path.getsize(dest_csv) > 0:
                with open(dest_csv, "r", encoding="utf-8") as check_nl:
                    # Move to the end minus 1 byte
                    try:
                        check_nl.seek(os.path.getsize(dest_csv) - 1)
                        if check_nl.read(1) != '\n':
                            f_dst.write('\n')
                    except OSError:
                        pass
            f_dst.write(content)
    else:
        with open(dest_csv, "w", encoding="utf-8") as f_dst:
            f_dst.write(content)
    os.remove(source_csv)


def pre_compile_ql(file_name: str, threads: int, codeql_bin: str) -> None:
    """
    Pre-compile a single .ql file using CodeQL.

    Args:
        file_name (str): The path to the .ql query file.
        threads (int): Number of threads to use during compilation.
        codeql_bin (str): Full path to the 'codeql' executable.
    
    Raises:
        CodeQLConfigError: If CodeQL executable not found.
        CodeQLExecutionError: If query compilation fails.
    """
    qlx_path = Path(str(file_name) + "x")
    if not qlx_path.exists():
        _run_codeql_command(
            [
                codeql_bin,
                "query",
                "compile",
                file_name,
                f'--threads={threads}',
                "--precompile"
            ],
            f"Failed to compile query {file_name}",
        )


def compile_all_queries(queries_folder: str, threads: int, codeql_bin: str) -> None:
    """
    Recursively pre-compile all .ql files in a folder.

    Args:
        queries_folder (str): Directory containing .ql files (and possibly subdirectories).
        threads (int): Number of threads to use during compilation.
        codeql_bin (str): Full path to the 'codeql' executable.
    
    Raises:
        CodeQLConfigError: If CodeQL executable not found.
        CodeQLExecutionError: If query compilation fails.
    """
    queries_folder_path = Path(queries_folder)
    for file_path in queries_folder_path.rglob("*"):
        if file_path.is_file() and file_path.suffix.lower() == ".ql":
            pre_compile_ql(str(file_path), threads, codeql_bin)


def run_one_query(
    query_file: str,
    curr_db: str,
    output_bqrs: str,
    output_csv: str,
    threads: int,
    codeql_bin: str
) -> None:
    """
    Execute a single CodeQL query on a specific database and export the results.

    Args:
        query_file (str): The path to the .ql file to run.
        curr_db (str): The path to the CodeQL database on which to run queries.
        output_bqrs (str): Where to write the intermediate BQRS output.
        output_csv (str): Where to write the CSV representation of the results.
        threads (int): Number of threads to use during query execution.
        codeql_bin (str): Full path to the 'codeql' executable.
    
    Raises:
        CodeQLConfigError: If CodeQL executable not found.
        CodeQLExecutionError: If query execution or BQRS decoding fails.
    """
    # Run the query
    _run_codeql_command(
        [
            codeql_bin, "query", "run", query_file,
            f'--database={curr_db}',
            f'--output={output_bqrs}',
            f'--threads={threads}'
        ],
        f"Failed to run query {query_file} on database {curr_db}",
    )

    # Decode BQRS to CSV
    _run_codeql_command(
        [
            codeql_bin, "bqrs", "decode", output_bqrs,
            '--format=csv', f'--output={output_csv}'
        ],
        f"Failed to decode BQRS file {output_bqrs} to CSV",
    )


def run_queries_on_db(
    curr_db: str,
    tools_folder: str,
    queries_folder: str,
    threads: int,
    codeql_bin: str,
    current_lang: str,
    timeout: int = 300
) -> None:
    """
    Execute all tool queries in 'tools_folder' individually on a given database,
    then run 'database analyze' with all queries in 'queries_folder'.

    Args:
        curr_db (str): The path to the CodeQL database.
        tools_folder (str): Folder containing individual .ql files to run.
        queries_folder (str): Folder containing .ql queries for database analysis.
        threads (int): Number of threads to use during query execution.
        codeql_bin (str): Full path to the 'codeql' executable.
        current_lang (str): The language currently being analyzed.
        timeout (int, optional): Timeout in seconds for the 'database analyze' command.
            Defaults to 300.
    
    Raises:
        CodeQLConfigError: If CodeQL executable not found.
        CodeQLExecutionError: If query execution or database analysis fails.
    """
    # 1) Run each .ql in tools_folder individually
    tools_folder_path = Path(tools_folder)
    if tools_folder_path.is_dir():
        for file_path in tools_folder_path.iterdir():
            if file_path.is_file() and file_path.suffix.lower() == ".ql":
                file_stem = file_path.stem
                output_bqrs = str(Path(curr_db) / f"{file_stem}_{current_lang}.bqrs")
                output_csv = str(Path(curr_db) / f"{file_stem}_{current_lang}.csv")
                final_csv = str(Path(curr_db) / f"{file_stem}.csv")
                
                run_one_query(
                    str(file_path),
                    curr_db,
                    output_bqrs,
                    output_csv,
                    threads,
                    codeql_bin
                )
                
                append_csv(output_csv, final_csv)
    else:
        logger.warning("Tools folder '%s' not found. Skipping individual queries.", tools_folder)

    # 2) Run the entire queries folder in one go using database analyze
    queries_folder_path = Path(queries_folder)
    if queries_folder_path.is_dir():
        output_issues = str(Path(curr_db) / f"issues_{current_lang}.csv")
        final_issues = str(Path(curr_db) / "issues.csv")
        _run_codeql_command(
            [
                codeql_bin,
                "database",
                "analyze",
                curr_db,
                queries_folder,
                f'--timeout={timeout}',
                '--format=csv',
                f'--output={output_issues}',
                f'--threads={threads}'
            ],
            f"Failed to analyze database {curr_db} with queries from {queries_folder}",
        )
        append_csv(output_issues, final_issues)
    else:
        logger.warning("Queries folder '%s' not found. Skipping database analysis.", queries_folder)


def compile_and_run_codeql_queries(
    codeql_bin: str = DEFAULT_CODEQL,
    lang: str = DEFAULT_LANG,
    threads: int = 16,
    timeout: int = 300,
    *,
    dbs_dir: str
) -> None:
    """
    Compile and run CodeQL queries on CodeQL databases for a specific language.

    1. Pre-compile all .ql files in the tools and queries folders.
    2. Enumerate all CodeQL DBs for the given language.
    3. Run each DB against both the 'tools' and 'issues' queries folders.

    Args:
        codeql_bin (str, optional): Full path to the 'codeql' executable. Defaults to DEFAULT_CODEQL.
        lang (str, optional): Language code. Defaults to 'c' (which maps to data/queries/cpp).
        threads (int, optional): Number of threads for compilation/execution. Defaults to 16.
        timeout (int, optional): Timeout in seconds for database analysis. Defaults to 300.
        dbs_dir (str): The path to the CodeQL databases.
        
    Raises:
        CodeQLConfigError: If CodeQL executable not found (from compilation or query execution).
        CodeQLExecutionError: If query compilation or execution fails.
    """
    # Split by comma if multiple languages are provided
    lang_list = [l.strip() for l in lang.split(",")]
    
    for current_lang in lang_list:
        # Setup paths
        queries_subfolder = "cpp" if current_lang == "c" else current_lang
        queries_folder = str(Path("data/queries") / queries_subfolder / "issues")
        tools_folder = str(Path("data/queries") / queries_subfolder / "tools")

        # Step 1: Pre-compile all queries
        if Path(tools_folder).exists():
            compile_all_queries(tools_folder, threads, codeql_bin)
        if Path(queries_folder).exists():
            compile_all_queries(queries_folder, threads, codeql_bin)

    # Step 2: Run queries
    # Validate database directory exists and is accessible
    dbs_folder_path = Path(dbs_dir)
    if not dbs_folder_path.exists():
        logger.warning("Database folder '%s' does not exist. No databases to process.", dbs_dir)
        logger.warning("Make sure databases were downloaded and extracted successfully.")
        return
    
    if not dbs_folder_path.is_dir():
        logger.warning("Database path '%s' is not a directory. No databases to process.", dbs_dir)
        return
    
    # List what's in the folder for debugging
    try:
        contents = list(dbs_folder_path.iterdir())
        if len(contents) == 0:
            logger.warning("Database folder '%s' is empty. No databases to process.", dbs_dir)
            return
        logger.debug("Found %d item(s) in database folder: %s", len(contents), [str(c) for c in contents])
    except OSError as e:
        logger.warning("Cannot access database folder '%s': %s. No databases to process.", dbs_dir, e)
        return
        
    actual_dbs = get_all_dbs(dbs_dir)

    if len(actual_dbs) == 0:
        logger.warning("No valid databases found in '%s'. Expected structure: <dbs_folder>/<repo_name>/<db_name>/codeql-database.yml", dbs_dir)
        logger.warning("Make sure databases were downloaded and extracted successfully.")
        return

    for curr_db in actual_dbs:
        # Check if database folder is empty
        curr_db_path = Path(curr_db)
        if curr_db_path.is_dir():
            try:
                if len(list(curr_db_path.iterdir())) == 0:
                    logger.warning("Database folder '%s' is empty. Skipping queries.", curr_db)
                    continue
            except OSError:
                logger.warning("Cannot access database folder '%s'. Skipping.", curr_db)
                continue
        
        # We need to run queries for each language and append the results.
        # So we delete the existing issues.csv and FunctionTree.csv to start fresh for this run
        issues_csv = curr_db_path / "issues.csv"
        function_tree_csv = curr_db_path / "FunctionTree.csv"
        
        if issues_csv.exists():
            issues_csv.unlink()
        if function_tree_csv.exists():
            function_tree_csv.unlink()
            
        logger.info("Processing DB: %s", curr_db)
        for current_lang in lang_list:
            queries_subfolder = "cpp" if current_lang == "c" else current_lang
            queries_folder = str(Path("data/queries") / queries_subfolder / "issues")
            tools_folder = str(Path("data/queries") / queries_subfolder / "tools")
            
            logger.info("Running queries for language: %s", current_lang)
            run_queries_on_db(
                curr_db,
                tools_folder,
                queries_folder,
                threads,
                codeql_bin,
                current_lang,
                timeout
            )

    logger.info("[+] done!")


def main_cli() -> None:
    """
    CLI entry point for running codeql queries with defaults.
    """
    compile_and_run_codeql_queries(
        codeql_bin=DEFAULT_CODEQL,
        lang=DEFAULT_LANG,
        threads=16,
        timeout=300,
        dbs_dir="output/databases/c"
    )


if __name__ == '__main__':
    # Initialize logging
    from src.utils.logger import setup_logging
    setup_logging()
    
    main_cli()
