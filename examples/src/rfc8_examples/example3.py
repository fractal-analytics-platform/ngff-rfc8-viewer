import ngio_collections as ngc
import shutil

from rfc8_examples import BASE_PATH, get_uuid4

NUM_COLLECTIONS = 3
NUM_MULTISCALES = 5
NUM_SINGLESCALES = 3

def main():
    coord_system_id = get_uuid4()
    collection_id = get_uuid4()

    root_collection_path = BASE_PATH / "3"
    shutil.rmtree(root_collection_path)
    root_collection_path.mkdir(parents=True, exist_ok=True)

    collections_level1 = []
    for ind_collection_lev1 in range(NUM_COLLECTIONS):
        collection_level1_id = get_uuid4()

        collection_level1_path = root_collection_path / str(ind_collection_lev1)
        collection_level1_path.mkdir(parents=True, exist_ok=True)

        collections_level2 = []
        for ind_collection_lev2 in range(NUM_COLLECTIONS):
            collection_level2_id = get_uuid4()

            collection_level2_path = collection_level1_path / str(ind_collection_lev2)
            collection_level2_path.mkdir(parents=True, exist_ok=True)

            multiscales = []

            for ind_multiscale in range(NUM_MULTISCALES):
                multiscale_id = get_uuid4()
                multiscale_path = collection_level2_path / str(ind_multiscale)
                multiscale_path.mkdir(parents=True, exist_ok=True)

                singlescales = []
                for ind_singlescale in range(NUM_SINGLESCALES):
                    singlescale_id = get_uuid4()
                    singlescale_path = multiscale_path / str(ind_singlescale)
                    singlescale_path.mkdir(parents=True, exist_ok=True)

                    scale_factor = 2.0 ** ind_singlescale
                    singlescale = ngc.new_node(
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
                    singlescales.append(singlescale)

                    singlescale_resolved = ngc.new_node(
                        node_type="singlescale",
                        id=singlescale_id,
                        name=f"resolution {ind_singlescale}",
                        children=[],
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
                    ).set_attr(ngc.WellAttribute(
                        column=ngc.ReferenceObj(id="test"),
                        row=ngc.ReferenceObj(id="test"),
                    ))
                    singlescale_path.mkdir(parents=True, exist_ok=True)
                    url = str(singlescale_path)
                    ngc.create(url, singlescale_resolved, overwrite=True)

                multiscale = ngc.new_node(
                    node_type="multiscale",
                    id=multiscale_id,
                    name=f"multiscale {ind_multiscale}",
                    ref=ngc.Reference(path=ngc.ZarrPath(path=f"./{ind_multiscale}")),
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
                multiscales.append(multiscale)

                multiscale_resolved = ngc.new_node(
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
                multiscale_path.mkdir(parents=True, exist_ok=True)
                url = str(multiscale_path)
                ngc.create(url, multiscale_resolved, overwrite=True)

            collection_level2 = ngc.new_node(
                node_type="collection",
                id=collection_level2_id,
                name=f"collection L2 {ind_collection_lev2}",
                ref=ngc.Reference(path=ngc.ZarrPath(path=f"./{ind_collection_lev2}")),
            )
            collections_level2.append(collection_level2)

            collection_level2_resolved = ngc.new_node(
                node_type="collection",
                id=collection_level2_id,
                name=f"collection L2 {ind_collection_lev2}",
                children=multiscales,
            )
            collection_level2_path.mkdir(parents=True, exist_ok=True)
            url = str(collection_level2_path)
            ngc.create(url, collection_level2_resolved, overwrite=True)

        collection_level1 = ngc.new_node(
            node_type="collection",
            id=collection_level1_id,
            name=f"collection L1 {ind_collection_lev1}",
            ref=ngc.Reference(path=ngc.ZarrPath(path=f"./{ind_collection_lev1}")),
        )
        collections_level1.append(collection_level1)

        collection_level1_resolved = ngc.new_node(
            node_type="collection",
            id=collection_level1_id,
            name=f"collection L1 {ind_collection_lev1}",
            children=collections_level2,
        )
        collection_level1_path.mkdir(parents=True, exist_ok=True)
        url = str(collection_level1_path)
        ngc.create(url, collection_level1_resolved, overwrite=True)

    collection = ngc.new_node(
        "collection",
        name="root collection",
        id=collection_id,
        ref=ngc.Reference(path=ngc.ZarrPath(path=f"./3")),
    )

    collection_resolved = ngc.new_node(
        "collection",
        name="root collection",
        id=collection_id,
        children=collections_level1,
    )

    url = str(root_collection_path)
    ngc.create(url, collection_resolved, overwrite=True)

    url = str(BASE_PATH / "example3.json")
    ngc.create(url, collection, overwrite=True)


if __name__ == "__main__":
    main()
