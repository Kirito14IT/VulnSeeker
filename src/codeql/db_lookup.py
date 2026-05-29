"""
CodeQL database lookup utilities.

This module provides functions to query CodeQL CSV files (FunctionTree.csv,
Macros.csv, GlobalVars.csv, Classes.csv) and extract code snippets from
the source archive.
"""

import csv
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from src.utils.exceptions import CodeQLError
from src.utils.common_functions import read_file_lines_from_zip
from src.utils.csv_parser import parse_csv_row


class CodeQLDBLookup:
    """
    Encapsulates CodeQL database lookup operations for functions, macros,
    global variables, classes, and caller relationships.
    """

    def _iter_csv_lines(
        self,
        file_path: Union[str, Path],
        file_type_name: str
    ):
        """
        Generator that yields lines from a CSV file, handling file I/O errors.

        This helper centralizes CSV file opening, line iteration, and error handling.
        Each method can iterate over the yielded lines and apply method-specific logic.

        Args:
            file_path: Path to the CSV file to read.
            file_type_name: Descriptive name for the file type (e.g., "Function tree file",
                           "Macros CSV", "GlobalVars CSV") for error messages.

        Yields:
            str: Each line from the CSV file (including newline characters).

        Raises:
            CodeQLError: If file cannot be read (not found, permission denied, etc.).
        """
        try:
            with Path(file_path).open("r", encoding="utf-8") as f:
                while True:
                    line = f.readline()
                    if not line:
                        break
                    yield line
        except (FileNotFoundError, PermissionError, OSError) as e:
            raise self._convert_csv_file_error(e, file_path, file_type_name) from e


    @staticmethod
    def _convert_csv_file_error(
        error: Exception,
        file_path: Union[str, Path],
        file_type_name: str
    ) -> CodeQLError:
        """
        Convert file I/O exceptions to CodeQLError with consistent messaging.

        Args:
            error: The original exception (FileNotFoundError, PermissionError, or OSError).
            file_path: Path to the CSV file that caused the error.
            file_type_name: Descriptive name for the file type (e.g., "Function tree file",
                           "Macros CSV", "GlobalVars CSV") for error messages.

        Returns:
            CodeQLError: Converted exception with appropriate message.
        """
        file_path_str = str(file_path)
        if isinstance(error, FileNotFoundError):
            return CodeQLError(f"{file_type_name} not found: {file_path_str}")
        elif isinstance(error, PermissionError):
            return CodeQLError(f"Permission denied reading {file_type_name}: {file_path_str}")
        elif isinstance(error, OSError):
            return CodeQLError(f"OS error while reading {file_type_name}: {file_path_str}")
        else:
            # Fallback for unexpected exception types
            return CodeQLError(f"Error reading {file_type_name}: {file_path_str}")


    def get_function_by_line(
        self,
        function_tree_file: str,
        file: str,
        line: int,
        db_path: str | None = None,
    ) -> Optional[Dict[str, str]]:
        """
        Retrieve the function dictionary from a CSV (FunctionTree.csv) that matches
        the specified file and line coverage.

        Args:
            function_tree_file (str): Path to the FunctionTree.csv file.
            file (str): Name of the file as it appears in the CSV row.
            line (int): A line number within the function's start_line and end_line range.

        Returns:
            Optional[Dict[str, str]]: The matching function row as a dict, or None if not found.
        
        Raises:
            CodeQLError: If function tree file cannot be read (not found, permission denied, etc.).
        """
        best_function = None
        smallest_range = float("inf")
        nearest_prior_function = None
        nearest_prior_start = -1

        for function in self._iter_csv_lines(function_tree_file, "Function tree file"):
            if file not in function:
                continue

            row_dict = self._parse_function_row(function)
            if not row_dict:
                continue

            try:
                start = int(row_dict["start_line"])
                end = self._resolve_function_end_line(row_dict, db_path)
            except (ValueError, CodeQLError):
                continue

            row_dict["end_line"] = str(end)
            if start <= line <= end:
                size = end - start
                if size < smallest_range:
                    best_function = row_dict
                    smallest_range = size
            elif start <= line and start > nearest_prior_start:
                nearest_prior_function = row_dict
                nearest_prior_start = start

        if best_function:
            return best_function

        if nearest_prior_function and db_path:
            try:
                nearest_prior_function["end_line"] = str(
                    self._resolve_function_end_line(nearest_prior_function, db_path, force_infer=True)
                )
                if int(nearest_prior_function["start_line"]) <= line <= int(nearest_prior_function["end_line"]):
                    return nearest_prior_function
            except (ValueError, CodeQLError):
                return None

        if db_path:
            try:
                return self.get_source_block_by_line(db_path, file, line)
            except (ValueError, CodeQLError):
                return None

        return None


    def get_function_by_name(
            self,
            function_tree_file: str,
            function_name: str,
            all_function: List[Dict[str, Any]],
            less_strict: bool = False
        ) -> Tuple[Union[str, Dict[str, str]], Optional[Dict[str, str]]]:
            """
            Retrieve a function by searching function_name in FunctionTree.csv.
            If not found, tries partial match if less_strict is True.

            Args:
                function_tree_file (str): Path to FunctionTree.csv.
                function_name (str): Desired function name (e.g., 'MyClass::MyFunc').
                all_function (List[Dict[str, Any]]): A list of known function dictionaries.
                less_strict (bool, optional): If True, use partial matching. Defaults to False.

            Returns:
                Tuple[Union[str, Dict[str, str]], Optional[Dict[str, str]]]:
                    - The found function (dict) or an error message (str).
                    - The "parent function" that references it, if relevant.
            
            Raises:
                CodeQLError: If function tree file cannot be read (not found, permission denied, etc.).
            """
            function_name_only = self._simple_symbol_name(function_name)
            parent_pairs = []
            for current_function in all_function:
                if not isinstance(current_function, dict):
                    continue
                function_id = str(current_function.get("function_id") or "").replace("\"", "").strip()
                if function_id:
                    parent_pairs.append((function_id, current_function))

            fallback_match = None
            for row in self._iter_csv_lines(function_tree_file, "Function tree file"):
                row_dict = self._parse_function_row(row)
                if not row_dict:
                    continue

                candidate_name = row_dict.get("function_name", "").replace("\"", "").strip()
                candidate_simple_name = self._simple_symbol_name(candidate_name)
                if not (
                    candidate_name == function_name_only
                    or candidate_simple_name == function_name_only
                    or (less_strict and function_name_only in candidate_name)
                    or (less_strict and function_name_only in candidate_simple_name)
                ):
                    continue

                row_text = row.replace("\"", "")
                for parent_id, parent_function in parent_pairs:
                    if parent_id in row_text:
                        return row_dict, parent_function

                if fallback_match is None:
                    fallback_match = row_dict

            if fallback_match is not None:
                return fallback_match, None

            # Try partial matching if less_strict is False
            if not less_strict:
                return self.get_function_by_name(function_tree_file, function_name, all_function, True)
            else:
                err = (
                    f"Function '{function_name}' not found. Make sure you're using "
                    "the correct tool and args."
                )
                return err, None


    def get_macro(
        self,
        curr_db: str,
        macro_name: str,
        less_strict: bool = False
    ) -> Union[str, Dict[str, str]]:
        """
        Return macro info from Macros.csv for the given macro_name.
        If not found, tries partial match if less_strict is True.

        Args:
            curr_db (str): Path to the current CodeQL database folder.
            macro_name (str): Macro name to search for.
            less_strict (bool, optional): If True, use partial matching.

        Returns:
            Union[str, Dict[str, str]]:
                - A dict with 'macro_name' and 'body' if found,
                - or an error message string if not found.
        
        Raises:
            CodeQLError: If Macros CSV file cannot be read (not found, permission denied, etc.).
        """
        macro_file = Path(curr_db) / "Macros.csv"
        keys = ["macro_name", "body"]

        for macro in self._iter_csv_lines(macro_file, "Macros CSV"):
            if macro_name in macro:
                row_dict = parse_csv_row(macro, keys)
                if not row_dict:
                    continue

                actual_name = row_dict["macro_name"].replace("\"", "")
                if (actual_name == macro_name
                        or (less_strict and macro_name in actual_name)):
                    return row_dict

        if not less_strict:
            return self.get_macro(curr_db, macro_name, True)
        else:
            return (
                f"Macro '{macro_name}' not found. Make sure you're using the correct tool "
                "with correct args."
            )


    def get_global_var(
        self,
        curr_db: str,
        global_var_name: str,
        less_strict: bool = False
    ) -> Union[str, Dict[str, str]]:
        """
        Return a global variable from GlobalVars.csv matching global_var_name.
        If not found, tries partial match if less_strict is True.

        Args:
            curr_db (str): Path to current CodeQL database folder.
            global_var_name (str): The name of the global variable to find.
            less_strict (bool, optional): If True, use partial matching.

        Returns:
            Union[str, Dict[str, str]]:
                - A dict with ['global_var_name','file','start_line','end_line'] if found,
                - or an error message string if not found.
        
        Raises:
            CodeQLError: If GlobalVars CSV file cannot be read (not found, permission denied, etc.).
        """
        global_var_file = Path(curr_db) / "GlobalVars.csv"
        keys = ["global_var_name", "file", "start_line", "end_line"]
        var_name_only = global_var_name.split("::")[-1]

        for line in self._iter_csv_lines(global_var_file, "GlobalVars CSV"):
            if var_name_only in line:
                data_dict = parse_csv_row(line, keys)
                if not data_dict:
                    continue

                actual_name = data_dict["global_var_name"].replace("\"", "")
                if (actual_name == var_name_only
                        or (less_strict and var_name_only in actual_name)):
                    return data_dict

        if not less_strict:
            return self.get_global_var(curr_db, global_var_name, True)
        else:
            return (
                f"Global var '{global_var_name}' not found. "
                "Could it be a macro or should you use another tool?"
            )


    def get_class(
        self,
        curr_db: str,
        class_name: str,
        less_strict: bool = False
    ) -> Union[str, Dict[str, str]]:
        """
        Return class info (type, class_name, file, start_line, end_line, simple_name)
        from Classes.csv for class_name. If not found, tries partial match if less_strict is True.

        Args:
            curr_db (str): Path to current CodeQL database folder.
            class_name (str): The name of the class/struct/union to find.
            less_strict (bool, optional): If True, use partial matching.

        Returns:
            Union[str, Dict[str, str]]:
                - A dict with keys ['type','class_name','file','start_line','end_line','simple_name']
                - or an error message string if not found.
        
        Raises:
            CodeQLError: If Classes CSV file cannot be read (not found, permission denied, etc.).
        """
        classes_file = Path(curr_db) / "Classes.csv"
        class_name_only = self._simple_symbol_name(class_name)

        for row in self._iter_csv_lines(classes_file, "Classes CSV"):
            if class_name_only in row:
                row_dict = self._parse_class_row(row)
                if not row_dict:
                    continue

                actual_class = row_dict.get("class_name", "").replace("\"", "")
                simple_class = row_dict.get("simple_name", "").replace("\"", "")
                if (
                    actual_class == class_name
                    or actual_class == class_name_only
                    or simple_class == class_name_only
                    or (less_strict and class_name_only in actual_class)
                    or (less_strict and class_name_only in simple_class)
                ):
                    return row_dict

        if not less_strict:
            return self.get_class(curr_db, class_name, True)
        else:
            return f"Class '{class_name}' not found. Could it be a Namespace?"

    @staticmethod
    def _simple_symbol_name(name: str) -> str:
        """
        Return the last symbol component for package/class qualified names.
        """
        return name.replace("\"", "").strip().split("::")[-1].split(".")[-1].split("$")[-1]

    def _parse_class_row(self, row: str) -> Optional[Dict[str, str]]:
        """
        Parse Classes.csv rows produced by different language helper queries.

        C/C++ helper output has six columns:
        type,class_name,file,start_line,end_line,simple_name

        Java/Python/JavaScript helper output currently has three columns:
        class_name,file,start_line
        """
        try:
            values = next(csv.reader([row]))
        except csv.Error:
            return None

        if not values:
            return None

        normalized_header = [value.strip().lower() for value in values]
        if normalized_header[:3] in (
            ["class_name", "file", "start_line"],
            ["type", "class_name", "file"],
        ):
            return None

        if len(values) >= 6:
            keys = ["type", "class_name", "file", "start_line", "end_line", "simple_name"]
            return dict(zip(keys, values[:6]))

        if len(values) >= 3:
            class_name = values[0]
            return {
                "type": "class",
                "class_name": class_name,
                "file": values[1],
                "start_line": values[2],
                "end_line": values[3] if len(values) >= 4 else "",
                "simple_name": self._simple_symbol_name(class_name),
            }

        return None


    def _parse_function_row(self, row: str) -> Optional[Dict[str, str]]:
        """
        Parse FunctionTree.csv rows and skip headers or malformed lines.
        """
        try:
            values = next(csv.reader([row]))
        except csv.Error:
            return None

        if len(values) < 5:
            return None

        normalized_header = [value.strip().lower() for value in values]
        if normalized_header[:3] == ["function_name", "file", "start_line"]:
            return None

        keys = ["function_name", "file", "start_line", "function_id", "end_line", "caller_id"]
        if len(values) < len(keys):
            values = values + [""] * (len(keys) - len(values))
        return dict(zip(keys, values[:len(keys)]))


    def _resolve_function_end_line(
        self,
        current_function: Dict[str, str],
        db_path: str | None,
        force_infer: bool = False,
    ) -> int:
        start_line = int(current_function["start_line"])
        end_line_value = str(current_function.get("end_line") or "").replace("\"", "").strip()
        end_line = int(end_line_value) if end_line_value else start_line

        if not db_path:
            return end_line

        if force_infer or end_line <= start_line:
            src_zip = Path(db_path) / "src.zip"
            file_path = current_function["file"].replace("\"", "")[1:]
            code_file = read_file_lines_from_zip(str(src_zip), file_path)
            inferred_end = self._infer_block_end_line(code_file.split("\n"), start_line)
            return max(end_line, inferred_end)

        return end_line


    def get_source_block_by_line(
        self,
        db_path: str,
        file: str,
        line: int,
    ) -> Optional[Dict[str, str]]:
        """
        Build a source-derived pseudo function when helper queries miss a block.

        JavaScript route callbacks and other anonymous functions are not always
        present in FunctionTree.csv, but CodeQL issues still point to source
        lines inside them. This fallback keeps those findings eligible for LLM
        review instead of skipping them as "function not found".
        """
        file_path = file.replace("\"", "")
        if not file_path.startswith("/"):
            file_path = "/" + file_path

        src_zip = Path(db_path) / "src.zip"
        zip_file_path = file_path[1:]
        code_file = read_file_lines_from_zip(str(src_zip), zip_file_path)
        lines = code_file.split("\n")
        if line < 1 or line > len(lines):
            return None

        start_line, end_line = self._infer_enclosing_source_block(lines, line)
        return {
            "function_name": "<source block>",
            "file": file_path,
            "start_line": str(start_line),
            "function_id": f"{file_path}:{start_line}",
            "end_line": str(end_line),
            "caller_id": "",
        }


    def _infer_enclosing_source_block(self, lines: List[str], target_line: int) -> Tuple[int, int]:
        target_index = target_line - 1

        for index in range(target_index, -1, -1):
            stripped = lines[index].lstrip()
            if stripped.startswith(("def ", "async def ", "class ")) and lines[index].rstrip().endswith(":"):
                end_line = self._infer_block_end_line(lines, index + 1)
                if index + 1 <= target_line <= end_line:
                    return index + 1, end_line

        search_start = max(0, target_index - 120)
        best_block: Optional[Tuple[int, int]] = None
        for index in range(target_index, search_start - 1, -1):
            if "{" not in lines[index]:
                continue

            depth = 0
            contains_target = False
            for scan_index in range(index, min(len(lines), index + 240)):
                depth += lines[scan_index].count("{")
                depth -= lines[scan_index].count("}")
                if scan_index == target_index and depth > 0:
                    contains_target = True
                if contains_target and depth <= 0:
                    best_block = (index + 1, scan_index + 1)
                    break

            if best_block:
                return best_block

        start_line = max(1, target_line - 20)
        end_line = min(len(lines), target_line + 40)
        return start_line, end_line


    def get_caller_function(
        self,
        function_tree_file: str,
        current_function: Dict[str, str]
    ) -> Union[str, Dict[str, str]]:
        """
        Return the caller function from function_tree_file that calls current_function.

        Args:
            function_tree_file (str): Path to FunctionTree.csv.
            current_function (Dict[str, str]): The function dictionary whose caller we want.

        Returns:
            Union[str, Dict[str, str]]:
                - Dict describing the caller if found
                - or an error string if the caller wasn't found.
        
        Raises:
            CodeQLError: If function tree file cannot be read (not found, permission denied, etc.).
        """
        caller_id = str(current_function.get("caller_id") or "").replace("\"", "").strip()
        if not caller_id:
            return (
                "Caller function was not recorded for this language/query. "
                "Use another tool if more context is needed."
            )

        for line in self._iter_csv_lines(function_tree_file, "Function tree file"):
            if caller_id in line:
                data_dict = self._parse_function_row(line)
                if not data_dict:
                    continue
                if data_dict.get("function_id", "").replace("\"", "").strip() == caller_id:
                    return data_dict

        # Fallback if 'caller_id' is in format file:line
        maybe_line = caller_id.split(":")
        if len(maybe_line) == 2:
            file_part, line_part = maybe_line
            function = self.get_function_by_line(function_tree_file, file_part[1:], int(line_part))
            if function:
                return function

        return (
            "Caller function was not found. "
            "Make sure you are using the correct tool with the correct args."
        )


    def extract_function_lines_from_db(
        self,
        db_path: str,
        current_function: Dict[str, str],
    ) -> Tuple[str, int, int, List[str]]:
        """
        Extract function lines from the CodeQL database source archive.

        Args:
            db_path (str): Path to the CodeQL database directory.
            current_function (Dict[str, str]): The function dictionary.

        Returns:
            Tuple[str, int, int, List[str]]:
                - file_path (str): The file path (after .replace and [1:])
                - start_line (int): Starting line number
                - end_line (int): Ending line number
                - all_lines (List[str]): Full file splitlines
        """
        src_zip = Path(db_path) / "src.zip"
        file_path = current_function["file"].replace("\"", "")[1:]
        code_file = read_file_lines_from_zip(str(src_zip), file_path)
        lines = code_file.split("\n")

        start_line = int(current_function["start_line"])
        end_line_value = str(current_function.get("end_line") or "").replace("\"", "").strip()
        if end_line_value:
            end_line = int(end_line_value)
            if end_line <= start_line:
                end_line = max(end_line, self._infer_block_end_line(lines, start_line))
        else:
            end_line = self._infer_block_end_line(lines, start_line)
        return file_path, start_line, end_line, lines

    @staticmethod
    def _infer_block_end_line(lines: List[str], start_line: int, max_fallback_lines: int = 120) -> int:
        """
        Infer an end line for rows that only contain a start line.
        """
        if start_line < 1 or start_line > len(lines):
            return min(len(lines), max(1, start_line))

        start_text = lines[start_line - 1]
        start_indent = len(start_text) - len(start_text.lstrip())
        header_end_line = start_line if start_text.rstrip().endswith(":") else None
        stripped_start = start_text.lstrip()
        if header_end_line is None and stripped_start.startswith(("def ", "async def ", "class ")):
            paren_depth = 0
            for index in range(start_line - 1, min(len(lines), start_line + 40)):
                line = lines[index]
                paren_depth += line.count("(") + line.count("[") + line.count("{")
                paren_depth -= line.count(")") + line.count("]") + line.count("}")
                if line.rstrip().endswith(":") and paren_depth <= 0:
                    header_end_line = index + 1
                    break

        if header_end_line is not None:
            last_body_line = header_end_line
            for index in range(header_end_line, len(lines)):
                line = lines[index]
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    last_body_line = index + 1
                    continue

                indent = len(line) - len(line.lstrip())
                if indent <= start_indent:
                    return max(start_line, last_body_line)
                last_body_line = index + 1

            return min(len(lines), last_body_line)

        brace_depth = 0
        saw_open_brace = False
        for index in range(start_line - 1, len(lines)):
            line = lines[index]
            brace_depth += line.count("{")
            if "{" in line:
                saw_open_brace = True
            brace_depth -= line.count("}")
            if saw_open_brace and brace_depth <= 0 and index >= start_line - 1:
                return index + 1

        if not saw_open_brace:
            return start_line

        fallback_end = start_line + max_fallback_lines - 1
        return min(len(lines), fallback_end)

    @staticmethod
    def format_numbered_snippet(file_path: str, start_line: int, snippet_lines: List[str]) -> str:
        """
        Format a code snippet with line numbers.

        Args:
            file_path (str): Path to the source file.
            start_line (int): Starting line number (1-indexed).
            snippet_lines (List[str]): The code lines to format.

        Returns:
            str: Formatted snippet with line numbers.
        """
        snippet = "\n".join(
            f"{start_line + i}: {text}" for i, text in enumerate(snippet_lines)
        )
        return f"file: {file_path}\n{snippet}"
