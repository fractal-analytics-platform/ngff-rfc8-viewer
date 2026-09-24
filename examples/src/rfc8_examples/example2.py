from pathlib import Path

import ngio_collections as ngc
import zarr

from rfc8_examples import BASE_PATH, get_uuid4

NUM_MULTISCALES = 20
NUM_SINGLESCALES = 5


def _create_zarr_array(path: str | Path) -> None:
    zarr.zeros(
        store=path,
        shape=(100, 100),
        chunks=(10, 10),
        dtype="f4",
        overwrite=True,
    )

def main():
    base_dir = BASE_PATH / "example2"
    base_dir.mkdir(parents=True, exist_ok=True)
    
    coord_system_id = get_uuid4()
    collection_id = get_uuid4()
    multiscales = []
    for ind_multiscale in range(NUM_MULTISCALES):
        multiscale_id = get_uuid4()
        singlescales = []
        for ind_singlescale in range(NUM_SINGLESCALES):
            singlescale_id = get_uuid4()
            scale_factor = 2.0**ind_singlescale
            singlescales.append(
                ngc.new_node(
                    node_type="singlescale",
                    id=singlescale_id,
                    name=f"resolution {ind_singlescale}",
                    ref=ngc.Reference(path=ngc.ZarrPath(path=f"./{ind_singlescale}")),
                ).set_attr(
                    ngc.CoordinateTransformationsAttribute(
                        [
                            ngc.ScaleTransformation(
                                input=ngc.ReferenceObj(id=singlescale_id),
                                output=ngc.ReferenceObj(id=coord_system_id),
                                scale=[scale_factor, scale_factor],
                            )
                        ]
                    )
                )
            )
            _create_zarr_array(base_dir / f"{ind_singlescale}")
        multiscales.append(
            ngc.new_node(
                node_type="multiscale",
                id=multiscale_id,
                name=f"multiscale {ind_multiscale}",
                children=singlescales,
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
        )

    collection = ngc.new_node(
        "collection",
        name="my collection",
        id=collection_id,
        children=multiscales,
    )


    url = str(base_dir / "root.json")
    ngc.create(url, collection, overwrite=True)



if __name__ == "__main__":
    main()
