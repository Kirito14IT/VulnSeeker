#!/usr/bin/env python3
"""
Details panel component for VulnSeeker UI.
"""

from textual.containers import Container, Vertical, ScrollableContainer
from textual.widgets import Static, Label, Select
from textual.app import ComposeResult
from textual.events import Click


class ManualDecisionContainer(Vertical):
    """Container that focuses the Select when clicked anywhere."""
    
    def on_click(self, event: Click) -> None:
        """Focus the select widget when clicking on container (not the Select itself)."""
        try:
            select = self.query_one("#manual-decision-select", Select)
            # Check if click was on the Select or its children - if so, let it handle naturally
            widget = self.app.get_widget_at(event.screen_x, event.screen_y)[0]
            if widget is select or select in widget.ancestors:
                return  # Let the Select handle its own clicks
            # Click was on label or empty area - focus the Select
            select.focus()
        except Exception:
            pass


class DetailsPanel(Container):
    """
    Right panel showing issue details with scrollable content and manual decision selector.
    """
    
    def compose(self) -> ComposeResult:
        """Compose the issue details panel layout.

        Builds the right-hand panel that shows LLM decisions, metadata,
        code snippets and the manual decision selector for the selected issue.
        """
        with Vertical():
            # Scrollable content area
            scrollable_content = ScrollableContainer(id="details-scrollable")
            with scrollable_content:
                yield Static("Select an issue to view details", id="details-content", markup=True)
            # Manual decision controls
            with ManualDecisionContainer(id="manual-decision-container"):
                yield Label("Enter your manual decision:", id="manual-decision-label")
                yield Select(
                    [
                        ("True Positive", "True Positive"),
                        ("False Positive", "False Positive"),
                        ("Uncertain", "Uncertain"),
                    ],
                    allow_blank=True,
                    id="manual-decision-select",
                    prompt="Not Set"
                )

