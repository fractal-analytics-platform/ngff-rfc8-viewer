import ngio_collections as ngc

from rfc8_examples import BASE_PATH, get_uuid4


def main():
    coord_system_id = get_uuid4()
    singlescale_1_id = get_uuid4()
    singlescale_2_id = get_uuid4()
    multiscale_id = get_uuid4()
    collection_id = get_uuid4()

    singlescale_1 = ngc.new_node(
        node_type="singlescale",
        id=singlescale_1_id,
        name="high-res",
        ref=ngc.Reference(path=ngc.ZarrPath(path="./1")),
    ).set_attr(
        ngc.CoordinateTransformationsAttribute(
            [
                ngc.ScaleTransformation(
                    input=ngc.ReferenceObj(id=singlescale_1_id),
                    output=ngc.ReferenceObj(id=coord_system_id),
                    scale=[1.0, 1.0],
                )
            ]
        )
    )

    singlescale_2 = ngc.new_node(
        node_type="singlescale",
        id=singlescale_2_id,
        name="low-res",
        ref=ngc.Reference(path=ngc.ZarrPath(path="./2")),
    ).set_attr(
        ngc.CoordinateTransformationsAttribute(
            [
                ngc.ScaleTransformation(
                    input=ngc.ReferenceObj(id=singlescale_2_id),
                    output=ngc.ReferenceObj(id=coord_system_id),
                    scale=[2.0, 2.0],
                )
            ]
        )
    )

    multiscale = ngc.new_node(
        node_type="multiscale",
        id=multiscale_id,
        name="my multiscale",
        children=(singlescale_1, singlescale_2),
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

    collection = ngc.new_node(
        "collection",
        name="my collection",
        id=collection_id,
        children=(multiscale,),
    )

    BASE_PATH.mkdir(parents=True, exist_ok=True)
    url = str(BASE_PATH / "example1.json")
    ngc.create(url, collection, overwrite=True)


if __name__ == "__main__":
    main()
