import json
import shutil

from rfc8_examples import BASE_PATH

DATA = {
    "ome": {
        "version": "0.x",
        "type": "collection",
        "name": "http_collection",
        "id": "http_collection",
        "nodes": [
            {
                "type": "collection",
                "name": "example1",
                "id": "example1",
                "path": {
                    "type": "json",
                    "path": "https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-viewer/refs/heads/main/examples/data/example1/root.json",
                },
            },
            {
                "type": "collection",
                "name": "example2",
                "id": "example2",
                "path": {
                    "type": "json",
                    "path": "https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-viewer/refs/heads/main/examples/data/example2/root.json",
                },
            },
        ],
    }
}


def main():
    root_path = BASE_PATH / "example3/root.json"
    if root_path.parent.exists():
        shutil.rmtree(root_path.parent)
    root_path.parent.mkdir(parents=True, exist_ok=True)
    with open(root_path, "w") as f:
        json.dump(DATA, f, indent=2)