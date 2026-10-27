"""Example 1: a collection with two images in a scene, one being a label image.

    hela-nuclei-experiment (collection, scene trait)
    ├── raw    -> ./raw    (multiscale, 2 scales)
    └── nuclei -> ./nuclei (multiscale, 2 scales; labels trait on its entry -> raw)
"""

import ngio_collections as ngc

from rfc8_examples import BASE_PATH, get_uuid4
from rfc8_examples.utils import (
    coordinate_system_id,
    create_image,
    multiscale,
    reset_dir,
    yx_axes,
)

ROOT_ID = get_uuid4("example1")


def main():
    base = reset_dir(BASE_PATH / "example1")

    raw = create_image(base / "raw", multiscale("raw", "example1-raw"), levels=2, seed=1)
    nuclei = create_image(
        base / "nuclei",
        multiscale("nuclei", "example1-nuclei"),
        levels=2,
        seed=2,
        dtype="u2",
    )
    # The labels trait sits on the entry in the collection, not in the image document.
    nuclei = nuclei.set_trait(
        ngc.LabelsTrait(
            source=[ngc.ReferenceObj(type="multiscale", ref=raw.id)],
            label_attributes=[
                ngc.LabelObj(label_value=1, rgba=[255, 0, 0, 255]),
                ngc.LabelObj(label_value=2, rgba=[0, 255, 0, 255]),
            ],
        )
    )

    scene_cs = get_uuid4("example1-scene-cs")
    scene = ngc.SceneTrait(
        coordinate_systems=[ngc.CoordinateSystem(id=scene_cs, name="scene", axes=yx_axes())],
        coordinate_transformations=[
            ngc.TranslationTransformation(
                translation=translation,
                input=ngc.ReferenceObj(
                    type="coordinate_system",
                    ref=coordinate_system_id(key),
                    path=ngc.ZarrPath(href=href),
                ),
                output=ngc.ReferenceObj(type="coordinate_system", ref=scene_cs),
            )
            for key, href, translation in (
                ("example1-raw", "./raw", [0.0, 0.0]),
                ("example1-nuclei", "./nuclei", [0.0, 0.0]),
            )
        ],
    )
    root = ngc.new_collection(
        id=ROOT_ID, name="hela-nuclei-experiment", traits=[scene]
    ).add_external(raw, nuclei)
    ngc.create(str(base / "zarr.json"), root, overwrite=True)


if __name__ == "__main__":
    main()
