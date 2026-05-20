import shutil
import subprocess
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

def generate_and_install_deps():
    project_root = Path(__file__).resolve().parent.parent.parent
    queries_root = (project_root / "data" / "queries").resolve()
    queries_root.mkdir(parents=True, exist_ok=True)

    logger.info(f"Will create/install dependencies in {queries_root}")

    for lang, codeql_lang in SUPPORTED_LANGS.items():
        lang_dir = queries_root / lang
        tools_dir = lang_dir / "tools"
        issues_dir = lang_dir / "issues"

        for folder in [tools_dir, issues_dir]:
            folder.mkdir(parents=True, exist_ok=True)
            qlpack_path = folder / "qlpack.yml"

            if not qlpack_path.exists():
                pack_name = f"vulnseeker-{lang}-{folder.name}"
                dep_name = f"codeql/{codeql_lang}-all"

                content = f"name: {pack_name}\nversion: 0.0.0\ndependencies:\n  {dep_name}: \"*\"\n"
                qlpack_path.write_text(content)
                logger.info(f"Created {qlpack_path}")

            # Check if there's already a lock file
            lock_path = folder / "codeql-pack.lock.yml"
            if not lock_path.exists():
                logger.info(f"Installing CodeQL packs in {folder}...")
                try:
                    codeql_bin = get_codeql_path()
                    if not shutil.which(codeql_bin):
                        codeql_bin = "codeql"
                    subprocess.run([codeql_bin, "pack", "install"], cwd=folder, check=True)
                    logger.info(f"Successfully installed in {folder}")
                except Exception as e:
                    logger.warning(f"Failed to install in {folder}: {e}")
            else:
                logger.info(f"Skipping install in {folder}, lock file exists.")

if __name__ == "__main__":
    generate_and_install_deps()
