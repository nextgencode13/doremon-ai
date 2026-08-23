# SPDX-License-Identifier: AGPL-3.0-or-later
# services/research/__init__.py
"""Research service — deep research with LLM-in-the-loop."""

from .service import ResearchService, ResearchResult, ResearchSource
from .research_handler import ResearchHandler

__all__ = [
    "ResearchService",
    "ResearchResult",
    "ResearchSource",
    "ResearchHandler",
]
