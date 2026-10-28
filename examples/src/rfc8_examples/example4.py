"""Example 4: an HCS plate with the provisional `plate`, `well` and `acquisition` traits.

    plate-001 (collection, plate trait: rows A, columns 1/2, acquisitions t0/t1)
    ├── A1 -> ./A/1/well.json (collection, well + scene traits)
    │   ├── fov0_t0 -> ./0      (multiscale; acquisition t0)
    │   ├── fov0_t1 -> ./0_t1   (multiscale; acquisition t1, same field)
    │   └── nuclei  -> ./nuclei (multiscale; labels -> fov0_t0)
    └── A2 -> ./A/2/well.json (collection, well trait)
        └── fov0    -> ./0      (multiscale; acquisition t0)

Wells are standalone JSON documents, so their image hrefs are relative to `A/1/well.json`.
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

ROOT_ID = get_uuid4("example4")
ACQUISITIONS = {
    "t0": (get_uuid4("example4-acq-t0"), 1727683200, 1727686800),
    "t1": (get_uuid4("example4-acq-t1"), 1727690400, 1727694000),
}


def acquisition_trait(name: str) -> ngc.AcquisitionTrait:
    return ngc.AcquisitionTrait(
        acquisition=ngc.ReferenceObj(type="acquisition", ref=ACQUISITIONS[name][0])
    )


def main():
    base = reset_dir(BASE_PATH / "example4")

    # Well A1: two acquisitions of the same field, plus a label image
    a1 = base / "A" / "1"
    fov0_t0 = create_image(
        a1 / "0", multiscale("fov0_t0", "example4-A1-fov0-t0"), levels=2, seed=10
    ).set_trait(acquisition_trait("t0"))
    fov0_t1 = create_image(
        a1 / "0_t1", multiscale("fov0_t1", "example4-A1-fov0-t1"), levels=2, seed=11
    ).set_trait(acquisition_trait("t1"))
    nuclei = create_image(
        a1 / "nuclei",
        multiscale("nuclei", "example4-A1-nuclei"),
        levels=2,
        seed=12,
        dtype="u2",
    ).set_trait(
        ngc.LabelsTrait(
            source=[ngc.ReferenceObj(type="multiscale", ref=fov0_t0.id)],
            label_attributes=[ngc.LabelObj(label_value=1, rgba=[0, 128, 255, 255])],
        )
    )
    scene_cs = get_uuid4("example4-A1-scene-cs")
    scene = ngc.SceneTrait(
        coordinate_systems=[ngc.CoordinateSystem(id=scene_cs, name="well", axes=yx_axes())],
        coordinate_transformations=[
            ngc.TranslationTransformation(
                translation=[0.0, 0.0],
                input=ngc.ReferenceObj(
                    type="coordinate_system",
                    ref=coordinate_system_id(key),
                    path=ngc.ZarrPath(href=href),
                ),
                output=ngc.ReferenceObj(type="coordinate_system", ref=scene_cs),
            )
            for key, href in (
                ("example4-A1-fov0-t0", "./0"),
                ("example4-A1-fov0-t1", "./0_t1"),
            )
        ],
    )
    well_a1 = ngc.new_collection(
        id=get_uuid4("example4-A1"),
        name="A1",
        traits=[ngc.WellTrait(row_index=0, column_index=0), scene],
    ).add_external(fov0_t0, fov0_t1, nuclei)
    well_a1_entry = ngc.create(str(a1 / "well.json"), well_a1, overwrite=True)

    # Well A2: a single field
    a2 = base / "A" / "2"
    fov0 = create_image(
        a2 / "0", multiscale("fov0", "example4-A2-fov0"), levels=2, seed=20
    ).set_trait(acquisition_trait("t0"))
    well_a2 = ngc.new_collection(
        id=get_uuid4("example4-A2"),
        name="A2",
        traits=[ngc.WellTrait(row_index=0, column_index=1)],
    ).add_external(fov0)
    well_a2_entry = ngc.create(str(a2 / "well.json"), well_a2, overwrite=True)

    plate = ngc.PlateTrait(
        rows=[ngc.RowObj(name="A")],
        columns=[ngc.ColumnObj(name="1"), ngc.ColumnObj(name="2")],
        acquisitions=[
            ngc.AcquisitionObj(id=acq_id, name=name, starttime=start, endtime=end)
            for name, (acq_id, start, end) in ACQUISITIONS.items()
        ],
    )
    root = ngc.new_collection(id=ROOT_ID, name="plate-001", traits=[plate]).add_external(
        well_a1_entry, well_a2_entry
    )
    ngc.create(str(base / "zarr.json"), root, overwrite=True)


if __name__ == "__main__":
    main()
