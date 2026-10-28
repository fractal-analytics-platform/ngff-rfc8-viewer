"""Example 2: a collection with many images (`NUM_IMAGES` multiscales, `NUM_LEVELS` scales each)."""

import ngio_collections as ngc

from rfc8_examples import BASE_PATH, get_uuid4
from rfc8_examples.utils import create_image, multiscale, reset_dir

NUM_IMAGES = 10
NUM_LEVELS = 5
ROOT_ID = get_uuid4("example2")


def main():
    base = reset_dir(BASE_PATH / "example2")
    entries = []
    for index in range(NUM_IMAGES):
        name = f"image-{index:02d}"
        entries.append(
            create_image(
                base / name,
                multiscale(name, f"example2-{name}", levels=NUM_LEVELS),
                levels=NUM_LEVELS,
                seed=100 + index,
            )
        )
    root = ngc.new_collection(id=ROOT_ID, name="many-images").add_external(*entries)
    ngc.create(str(base / "zarr.json"), root, overwrite=True)


if __name__ == "__main__":
    main()
