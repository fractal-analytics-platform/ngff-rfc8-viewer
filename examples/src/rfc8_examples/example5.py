import shutil
from pathlib import Path

import ngio_collections as ngc

from rfc8_examples import BASE_PATH, get_uuid4
from rfc8_examples.utils import create_zarr_array


def _get_singlescales(coord_system_id: int, image_id: str) -> list[ngc.Node]:
    s0_id = get_uuid4(f"{image_id}-s0")
    return [
        ngc.new_node(
            node_type="singlescale",
            id=s0_id,
            name="s0",
            ref=ngc.Reference(path=ngc.ZarrPath(path="./s0")),
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
    image_id =get_uuid4({"name": name, "attributes": attributes})
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


def _get_children_and_tables(coord_system_id: int, well_label: str) -> list[ngc.Node]:
    return [
        _get_image(
            name="0",
            coord_system_id=coord_system_id,
            attributes={"field": {"id": 0}, "acquisition": 0},
        ),
        _get_image(
            name="1",
            coord_system_id=coord_system_id,
            attributes={"field": {"id": 0}, "acquisition": 1},
        ),
        _get_image(
            name="1_registered",
            coord_system_id=coord_system_id,
            attributes={"field": {"id": 0}, "acquisition": 1},
        ),
        _get_image(
            name="nuclei",
            coord_system_id=coord_system_id,
            attributes={"field": {"id": 0}, "acquisition": 0},
        ),
        ngc.new_node(
            node_type="table",
            id=get_uuid4("nuclei_measurements" + well_label),
            name="nuclei_measurements",
        ),
    ]


def main():
    coord_system_id = get_uuid4("coord-system")

    root_collection_path = BASE_PATH / "example5"
    if Path(root_collection_path).exists():
        shutil.rmtree(root_collection_path)
    root_collection_path.mkdir(parents=True, exist_ok=True)

    children_A1 = _get_children_and_tables(coord_system_id=coord_system_id, well_label="A1")
    children_A1_ref = []
    for child in children_A1:
        url = str(root_collection_path / f"plate/well-A1/{child.name}/zarr.json")
        children_A1_ref.append(ngc.create(url, child, overwrite=True))
        if child.type == "multiscale":
            url = str(root_collection_path / f"plate/well-A1/{child.name}/s0")
            create_zarr_array(url)

    well_A1 = ngc.new_node(
        "collection",
        name="Well A1",
        id=get_uuid4("well A1"),
        children=[],
        attributes={"well": {"column": {"id": "1"}, "row": {"id": "A"}}},
    ).add_ref(*children_A1_ref)

    url = str(root_collection_path / "plate/well-A1/well.json")
    well_A1_ref = ngc.create(url, well_A1, overwrite=True)

    plate = ngc.new_node(
        "collection",
        name="Plate",
        id=get_uuid4("plate"),
        children=[],
        attributes={
            "plate": {
                "acquisitions": [],
                "columns": [{"id": "1"}],
                "rows": [{"id": "A"}],
            }
        },
    ).add_ref(well_A1_ref)

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
