
import ngio_collections as ngc

from rfc8_examples import BASE_PATH, get_uuid4
from rfc8_examples.utils import create_zarr_array

NUM_MULTISCALES = 10
NUM_SINGLESCALES = 5




def main():
    base_dir = BASE_PATH / "example2"
    base_dir.mkdir(parents=True, exist_ok=True)

    coord_system_id = get_uuid4("coord-system")
    collection_id = get_uuid4("collection")
    multiscales = []
    for ind_multiscale in range(NUM_MULTISCALES):
        multiscale_id = get_uuid4(f"multiscale-{ind_multiscale}")
        singlescales = []
        for ind_singlescale in range(NUM_SINGLESCALES):
            singlescale_id = get_uuid4(f"multiscale-{ind_multiscale}-singlescale-{ind_singlescale}")
            scale_factor = 2.0**ind_singlescale
            relative_path = f"image-{ind_multiscale:02d}/{ind_singlescale}"
            singlescales.append(
                ngc.new_node(
                    node_type="singlescale",
                    id=singlescale_id,
                    name=f"resolution {ind_singlescale}",
                    ref=ngc.Reference(path=ngc.ZarrPath(path=f"./{relative_path}")),
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
            create_zarr_array(base_dir / f"{relative_path}")
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
