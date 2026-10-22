import shutil
from pathlib import Path

import ngio_collections as ngc

from rfc8_examples import BASE_PATH, get_uuid4


def _get_singlescales(coord_system_id: int, image_id: str) -> list[ngc.Node]:
    s0_id = get_uuid4(f"{image_id}-s0")
    return [
        ngc.new_node(
            node_type="singlescale",
            id=s0_id,
            name="s0",
            ref=ngc.Reference(path=ngc.ZarrPath(path="./0")),
        ).set_attr(
            ngc.CoordinateTransformationsAttribute(
                [
                    ngc.ScaleTransformation(
                        input=ngc.ReferenceObj(id=s0_id),
                        output=ngc.ReferenceObj(id=coord_system_id),
                        scale=[1.0, 1.0],
                    )
                ]
            )
        ),
    ]


def _get_image(
    name: str,
    coord_system_id: str,
    attributes: dict | None = None,
) -> ngc.Node:
    image_id = get_uuid4({"name": name, "attributes": attributes})
    _image = ngc.new_node(
        node_type="multiscale",
        id=image_id,
        name=name,
        attributes=attributes,
        children=_get_singlescales(coord_system_id=coord_system_id, image_id=image_id),
    ).set_attr(
        ngc.CoordinateSystemsAttribute(
            [
                ngc.CoordinateSystem(
                    id=coord_system_id,
                    axes=[
                        ngc.Axis(name="y", type="space", unit="micrometer"),
                        ngc.Axis(name="x", type="space", unit="micrometer"),
                    ],
                )
            ]
        )
    )
    return _image


def _get_images(coord_system_id: int, well_label: str) -> list[ngc.Node]:
    return [
        _get_image(
            name="0",
            coord_system_id=coord_system_id,
            attributes={"field": {"id": 0}},
        ),
        _get_image(
            name="1",
            coord_system_id=coord_system_id,
            attributes={"field": {"id": 1}},
        ),
        _get_image(
            name="0_corrected",
            coord_system_id=coord_system_id,
            attributes={"field": {"id": 0}},
        ),
        _get_image(
            name="1_corrected",
            coord_system_id=coord_system_id,
            attributes={"field": {"id": 1}},
        ),
        _get_image(
            name="nuclei_0",
            coord_system_id=coord_system_id,
            attributes={"field": {"id": 0}},
        ),
        _get_image(
            name="nuclei_1",
            coord_system_id=coord_system_id,
            attributes={"field": {"id": 1}},
        ),
        ngc.new_node(
            node_type="table",
            id=get_uuid4("measurements_0_corrected" + well_label),
            name="measurements_0_corrected",
            attributes={"field": {"id": 0}},
        ),
        ngc.new_node(
            node_type="table",
            id=get_uuid4("measurements_1_corrected" + well_label),
            name="measurements_1_corrected",
            attributes={"field": {"id": 1}},
        ),
    ]


def main():
    coord_system_id = get_uuid4("coord-system")

    root_collection_path = BASE_PATH / "example4"
    if Path(root_collection_path).exists():
        shutil.rmtree(root_collection_path)
    root_collection_path.mkdir(parents=True, exist_ok=True)

    images_A1 = _get_images(coord_system_id=coord_system_id, well_label="A1")
    images_A1_ref = []
    images_A2 = _get_images(coord_system_id=coord_system_id, well_label="A2")
    images_A2_ref = []
    for image in images_A1:
        url = str(root_collection_path / f"plate/well-A1/{image.name}/zarr.json")
        images_A1_ref.append(ngc.create(url, image, overwrite=True))
    for image in images_A2:
        url = str(root_collection_path / f"plate/well-A2/{image.name}/zarr.json")
        images_A2_ref.append(ngc.create(url, image, overwrite=True))

    well_A1 = ngc.new_node(
        "collection",
        name="Well A1",
        id=get_uuid4("well-A1"),
        children=[],
        attributes={"well": {"column": {"id": "1"}, "row": {"id": "A"}}},
    ).add_ref(*images_A1_ref)

    well_A2 = ngc.new_node(
        "collection",
        name="Well A2",
        id=get_uuid4("well-A2"),
        children=[],
        attributes={"well": {"column": {"id": "2"}, "row": {"id": "A"}}},
    ).add_ref(*images_A2_ref)

    url = str(root_collection_path / "plate/well-A1/well.json")
    well_A1_ref = ngc.create(url, well_A1, overwrite=True)
    url = str(root_collection_path / "plate/well-A2/well.json")
    well_A2_ref = ngc.create(url, well_A2, overwrite=True)

    plate = ngc.new_node(
        "collection",
        name="Plate",
        id=get_uuid4("collection"),
        children=[],
        attributes={
            "plate": {
                "acquisitions": [],
                "columns": [{"id": "1"}, {"id": "2"}],
                "rows": [{"id": "A"}],
            }
        },
    ).add_ref(well_A1_ref, well_A2_ref)

    url = str(root_collection_path / "plate/plate.json")
    ngc.create(url, plate, overwrite=True)

    collection = ngc.new_node(
        "collection",
        name="My dataset",
        id=get_uuid4("dataset"),
        children=[plate],
    )

    url = str(root_collection_path / "root.json")
    ngc.create(url, collection, overwrite=True)


if __name__ == "__main__":
    main()
