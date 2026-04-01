#!/usr/bin/env python3
"""
Issue parsing utilities for extracting and processing data from Issue objects.

This module contains pure data parsing logic, separated from UI concerns.
"""

import re
from typing import List, Optional, Tuple

from src.ui.models import Issue


# Regex patterns for parsing
LOCATION_PATTERN = re.compile(r'Location:\s*[^:]*:(\d+)', re.IGNORECASE)
FILE_LINE_PATTERN = re.compile(r'^\s*file:')
NUMBERED_LINE_PATTERN = re.compile(r'^\s*\d+:')
LINE_NUMBER_PATTERN = re.compile(r'^\s*\d+:\s*')
LINE_NUMBER_MATCH_PATTERN = re.compile(r'^\s*(\d+):')


def extract_line_number_from_location(issue: Issue) -> Optional[int]:
    """
    Extract line number from "Location: ..." text in raw_data or final_data.

    Args:
        issue (Issue): Issue object containing raw_data and final_data.

    Returns:
        Optional[int]: Line number extracted from location text, or None if not found.
    """
    # Check raw_data prompt first
    if issue.raw_data and "prompt" in issue.raw_data:
        match = LOCATION_PATTERN.search(issue.raw_data["prompt"])
        if match:
            try:
                return int(match.group(1))
            except (ValueError, IndexError):
                pass
    
    # Check final_data messages
    if issue.final_data:
        for msg in issue.final_data:
            if isinstance(msg, dict):
                content = msg.get("content", "")
                if content:
                    match = LOCATION_PATTERN.search(content)
                    if match:
                        try:
                            return int(match.group(1))
                        except (ValueError, IndexError):
                            pass
    
    return None


def extract_code_blocks_from_text(text: str) -> List[str]:
    """
    Extract VulnSeeker code blocks from text.

    Args:
        text (str): Text containing code blocks in format "file: ..." followed by 
            numbered lines like "123: code".

    Returns:
        List[str]: List of extracted code block strings.
    """
    if not text:
        return []
    
    blocks = []
    lines = text.split('\n')
    i = 0
    
    while i < len(lines):
        if FILE_LINE_PATTERN.match(lines[i]):
            # Found file: line - start collecting block
            block_lines = [lines[i]]
            i += 1
            
            # Collect numbered lines until we hit a non-numbered line
            while i < len(lines):
                line = lines[i]
                if NUMBERED_LINE_PATTERN.match(line):
                    block_lines.append(line)
                    i += 1
                    # Include continuation lines that end with a backslash
                    if line.rstrip().endswith('\\') and i < len(lines):
                        block_lines.append(lines[i])
                        i += 1
                else:
                    break  # End of block
            
            # Only keep blocks with at least file: + one numbered line
            if len(block_lines) > 1:
                block = '\n'.join(block_lines).strip()
                if block:
                    blocks.append(block)
        else:
            i += 1
    
    return blocks


def extract_code_from_messages(final_data: Optional[List]) -> List[str]:
    """
    Extract all code blocks from final_data messages in chronological order.

    Args:
        final_data (Optional[List]): List of message dictionaries from LLM conversation.

    Returns:
        List[str]: List of extracted code block strings.
    """
    if not final_data:
        return []
    
    all_blocks = []
    for msg in final_data:
        if isinstance(msg, dict):
            content = msg.get("content", "")
            if isinstance(content, str) and content:
                all_blocks.extend(extract_code_blocks_from_text(content))
    
    return all_blocks


def normalize_code_snippet(snippet: str) -> str:
    """
    Normalize code snippet for deduplication: strip line numbers and whitespace.
    
    The file header is normalized to handle slight formatting differences (whitespace,
    trailing characters) so that the same code block with minor header differences
    will be properly deduplicated.

    Args:
        snippet (str): Code snippet to normalize.

    Returns:
        str: Normalized code snippet with line numbers removed and file header normalized.
    """
    snippet = snippet.strip()
    if not snippet:
        return ""
    
    # Check for file: header
    file_match = re.match(r'(file:\s*[^\n]+)\n(.*)', snippet, re.DOTALL)
    if file_match:
        # Normalize file header: strip whitespace and normalize multiple spaces to single space
        file_header = file_match.group(1).strip()
        # Normalize whitespace in file header (multiple spaces -> single space)
        file_header = re.sub(r'\s+', ' ', file_header)
        code_lines = file_match.group(2).split('\n')
    else:
        file_header = None
        code_lines = snippet.split('\n')
    
    # Normalize all code lines: remove line numbers and strip whitespace
    normalized_lines = []
    for line in code_lines:
        line = LINE_NUMBER_PATTERN.sub('', line).strip()
        if line:  # Keep non-empty lines
            normalized_lines.append(line)
    
    normalized_code = '\n'.join(normalized_lines)
    # Return normalized key with normalized file header
    return f"{file_header}\n{normalized_code}" if file_header else normalized_code


def collect_all_code_snippets(issue: Issue) -> Tuple[str, List[str]]:
    """
    Collect all unique code snippets from final_data, deduplicated and in order.

    Args:
        issue (Issue): Issue object containing final_data.

    Returns:
        Tuple[str, List[str]]: Tuple of (initial_code, additional_code_list) where
            initial_code is the first snippet (or empty string) and 
            additional_code_list contains additional snippets (empty if none).
    """
    snippets = extract_code_from_messages(issue.final_data)
    if not snippets:
        return ("", [])
    
    # Deduplicate: keep first occurrence of each normalized block
    seen = set()
    unique_snippets = []
    for snippet in snippets:
        key = normalize_code_snippet(snippet)
        if key and key not in seen:
            seen.add(key)
            unique_snippets.append(snippet)
    
    if not unique_snippets:
        return ("", [])
    
    initial_code = unique_snippets[0]
    additional_code = unique_snippets[1:] if len(unique_snippets) > 1 else []
    
    return (initial_code, additional_code)



def extract_last_message(final_data: Optional[List]) -> Optional[str]:
    """
    Extract the last non-empty message content from final_data.

    Args:
        final_data (Optional[List]): List of message dictionaries from LLM conversation.

    Returns:
        Optional[str]: Content string of the last message, or None if no valid message found.
    """
    if not final_data:
        return None
    
    # Iterate backwards to find the last non-empty message
    for msg in reversed(final_data):
        if isinstance(msg, dict):
            content = msg.get("content", "")
            if isinstance(content, str) and content.strip():
                return content.strip()
    
    return None

