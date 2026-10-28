from pathlib import Path

from .utils import get_uuid4  # noqa: F401

BASE_PATH = Path(__file__).parents[2] / "data"

# Where the generated data is served from (used by the http example and the viewer homepage).
RAW_BASE_URL = (
    "https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-viewer/main/examples/data"
)
