from pathlib import Path
import shutil

import ngio_collections as ngc

from rfc8_examples import BASE_PATH, get_uuid4

import zarr


def _create_zarr_array(path: str | Path) -> None:
    zarr.zeros(
        store=path,
        shape=(100, 100),
        chunks=(10, 10),
        dtype="f4",
        overwrite=True,
    )


def _get_singlescales(coord_system_id: int) -> list:
    s0_id = get_uuid4()
    s1_id = get_uuid4()

    return [
        ngc.new_node(
            node_type="singlescale",
            id=s0_id,
            name="high-res",
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
        ngc.new_node(
            node_type="singlescale",
            id=s1_id,
            name="low-res",
            ref=ngc.Reference(path=ngc.ZarrPath(path="./1")),
        ).set_attr(
            ngc.CoordinateTransformationsAttribute(
                [
                    ngc.ScaleTransformation(
                        input=ngc.ReferenceObj(id=s1_id),
                        output=ngc.ReferenceObj(id=coord_system_id),
                        scale=[2.0, 2.0],
                    )
                ]
            )
        ),
    ]


def _get_image(name: str, coord_system_id: str):
    _image = ngc.new_node(
        node_type="multiscale",
        id=get_uuid4(),
        name=name,
        children=_get_singlescales(coord_system_id=coord_system_id),
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


def main():
    coord_system_id = get_uuid4()
    collection_id = get_uuid4()
    plate_id = get_uuid4()
    well_id = get_uuid4()

    root_collection_path = BASE_PATH / "example4"
    if Path(root_collection_path).exists():
        shutil.rmtree(root_collection_path)
    root_collection_path.mkdir(parents=True, exist_ok=True)

    well = ngc.new_node(
        "well",
        name="Well A1",
        id=well_id,
        children=[
            _get_image(name="Field 0", coord_system_id=coord_system_id),
            _get_image(name="Field 1", coord_system_id=coord_system_id),
            _get_image(name="Field 0 / registered", coord_system_id=coord_system_id),
            _get_image(name="Nuclei label", coord_system_id=coord_system_id),
            # TODO: Add table here
        ],
    )
    print(f"{well=}")

    url = str(root_collection_path / "plate/well-A1/well.json")
    well_ref = ngc.create(url, well, overwrite=True)
    print(f"{well_ref=}")

    plate = ngc.new_node(
        "plate",
        name="Plate",
        id=plate_id,
        children=[],
    ).add_ref(well_ref)

    url = str(root_collection_path / "plate/plate.json")
    ngc.create(url, plate, overwrite=True)
    print("plate created")

    collection = ngc.new_node(
        "collection",
        name="My dataset",
        id=collection_id,
        children=[plate],
    )

    url = str(root_collection_path / "root.json")
    ngc.create(url, collection, overwrite=True)


if __name__ == "__main__":
    main()
