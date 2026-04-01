#!/usr/bin/env python3
"""
Entry point for running the VulnSeeker UI.

Usage:
    python examples/ui_example.py
"""

import sys
from pathlib import Path

# Add project root to Python path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.ui.ui_app import main

if __name__ == "__main__":
    main()

