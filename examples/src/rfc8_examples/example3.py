"""Example 3: a standalone JSON collection whose nodes point to the other examples over http.

Each entry shares the UUID of the document it points to (RFC-8 revision 1 requires it), so the
ids are imported from the scripts that generate those documents.
"""

import json

from rfc8_examples import BASE_PATH, RAW_BASE_URL, get_uuid4
from rfc8_examples.example1 import ROOT_ID as EXAMPLE1_ID
from rfc8_examples.example2 import ROOT_ID as EXAMPLE2_ID
from rfc8_examples.example4 import ROOT_ID as EXAMPLE4_ID
from rfc8_examples.utils import reset_dir


def main():
    base = reset_dir(BASE_PATH / "example3")
    nodes = []
    for name, node_id in (
        ("example1", EXAMPLE1_ID),
        ("example2", EXAMPLE2_ID),
        ("example4", EXAMPLE4_ID),
    ):
        nodes.append(
            {
                "type": "collection",
                "id": node_id,
                "name": name,
                "path": {
                    "type": "zarr",
                    "format": "http",
                    "href": f"{RAW_BASE_URL}/{name}",
                },
            }
        )
    data = {
        "ome": {
            "version": "0.x",
            "type": "collection",
            "id": get_uuid4("example3"),
            "name": "http_collection",
            "nodes": nodes,
        }
    }
    with open(base / "root.json", "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
