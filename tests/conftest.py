"""Shared pytest fixtures and configuration."""

import sys
from pathlib import Path

# Add project root to Python path for imports
# 添加项目根目录到Python路径，用于导入
PROJECT_ROOT = Path(__file__).parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
