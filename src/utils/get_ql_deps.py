import shutil
import subprocess
import os
from pathlib import Path

from src.utils.logger import get_logger
from src.utils.config import get_codeql_path

logger = get_logger(__name__)

SUPPORTED_LANGS = {
    "cpp": "cpp",
    "java": "java",
    "python": "python",
    "javascript": "javascript"
}

OFFICIAL_QUERY_PACKS = {
    "cpp": "codeql/cpp-queries",
    "java": "codeql/java-queries",
    "python": "codeql/python-queries",
    "javascript": "codeql/javascript-queries",
}

DEFAULT_OFFICIAL_SUITE = "security-extended"


def _resolve_codeql_bin() -> str:
    codeql_bin = get_codeql_path()
    if Path(codeql_bin).exists() or shutil.which(codeql_bin):
        return codeql_bin
    return "codeql"


def _run_codeql(command: list[str], cwd: Path | None = None) -> None:
    subprocess.run(
        [_resolve_codeql_bin(), *command],
        cwd=cwd,
        check=True,
        text=True,
    )


def _can_resolve_official_suite(lang: str) -> bool:
    query_pack = OFFICIAL_QUERY_PACKS[lang]
    suite = os.getenv("CODEQL_QUERY_SUITE", DEFAULT_OFFICIAL_SUITE).strip() or DEFAULT_OFFICIAL_SUITE
    if ":" not in suite and not suite.endswith((".ql", ".qls")):
        suite = suite.replace("_", "-")
        suite = f"{query_pack}:codeql-suites/{lang}-{suite}.qls"

    try:
        _run_codeql(["resolve", "queries", suite])
        logger.info(f"Official query suite already available for {lang}: {suite}")
        return True
    except subprocess.CalledProcessError:
        return False


def generate_and_install_deps():
    project_root = Path(__file__).resolve().parent.parent.parent
    queries_root = (project_root / "data" / "queries").resolve()
    queries_root.mkdir(parents=True, exist_ok=True)

    logger.info(f"Will create/install dependencies in {queries_root}")

    for lang, codeql_lang in SUPPORTED_LANGS.items():
        lang_dir = queries_root / lang
        tools_dir = lang_dir / "tools"

        tools_dir.mkdir(parents=True, exist_ok=True)
        qlpack_path = tools_dir / "qlpack.yml"

        if not qlpack_path.exists():
            pack_name = f"vulnseeker-{lang}-tools"
            dep_name = f"codeql/{codeql_lang}-all"

            content = f"name: {pack_name}\nversion: 0.0.0\ndependencies:\n  {dep_name}: \"*\"\n"
            qlpack_path.write_text(content)
            logger.info(f"Created {qlpack_path}")

        lock_path = tools_dir / "codeql-pack.lock.yml"
        if not lock_path.exists():
            logger.info(f"Installing CodeQL packs in {tools_dir}...")
            try:
                _run_codeql(["pack", "install"], cwd=tools_dir)
                logger.info(f"Successfully installed in {tools_dir}")
            except Exception as e:
                logger.warning(f"Failed to install in {tools_dir}: {e}")
        else:
            logger.info(f"Skipping install in {tools_dir}, lock file exists.")

        official_pack = OFFICIAL_QUERY_PACKS[lang]
        logger.info(f"Ensuring official CodeQL query suite is available for {lang}")
        if _can_resolve_official_suite(lang):
            continue

        logger.info(f"Downloading official CodeQL query pack: {official_pack}")
        try:
            _run_codeql(["pack", "download", official_pack])
            logger.info(f"Official query pack ready: {official_pack}")
        except Exception as e:
            logger.warning(f"Failed to download official query pack {official_pack}: {e}")

if __name__ == "__main__":
    generate_and_install_deps()
