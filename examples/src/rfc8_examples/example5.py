"""Example 5: extensions on a plate: an `extension_manifest`, URI traits and a URI node type.

    plate-001 (collection; plate trait + training-dataset trait)
    └── A1 (embedded collection; well trait)
        ├── fov0        -> ./A/1/0               (multiscale)
        ├── nuclei      -> ./A/1/nuclei          (multiscale; labels -> fov0, provenance trait)
        └── regionprops -> ./A/1/regionprops.csv (Fractal table node, custom CSV path type)

The extensions and their JSON Schemas are the illustrative ones shipped with ngio-collections
(`examples/schemas/`); the manifest is derived from the registered extensions.
"""

import ngio_collections as ngc

from rfc8_examples import BASE_PATH, get_uuid4
from rfc8_examples.utils import create_image, multiscale, reset_dir

ROOT_ID = get_uuid4("example5")

SCHEMAS_BASE = (
    "https://raw.githubusercontent.com/BioVisionCenter/ngio-collections/main/examples/schemas/"
)
HOMEPAGE = "https://github.com/BioVisionCenter/ngio-collections/tree/main/examples/schemas"
FRACTAL = SCHEMAS_BASE + "fractal/"
PROVENANCE = FRACTAL + "provenance"
TABLE = FRACTAL + "table"
CSV = FRACTAL + "csv"
TRAINING = SCHEMAS_BASE + "training/"
DATASET = TRAINING + "dataset"

FRACTAL_ENTRY = {
    "id": FRACTAL,
    "version": "0.1",
    "name": "Fractal",
    "schemas": [
        {"type": "jsonschema", "url": FRACTAL + "provenance.schema.json"},
        {"type": "jsonschema", "url": FRACTAL + "table.schema.json"},
    ],
    "homepage": HOMEPAGE,
}
TRAINING_ENTRY = {
    "id": TRAINING,
    "version": "0.1",
    "name": "Training dataset",
    "schemas": [{"type": "jsonschema", "url": TRAINING + "dataset.schema.json"}],
    "homepage": HOMEPAGE,
}


def main():
    base = reset_dir(BASE_PATH / "example5")
    ngc.register_extension(FRACTAL_ENTRY)
    ngc.register_extension(TRAINING_ENTRY)

    well_dir = base / "A" / "1"
    fov0 = create_image(
        well_dir / "0", multiscale("fov0", "example5-fov0"), levels=2, seed=50
    )
    nuclei = create_image(
        well_dir / "nuclei",
        multiscale("nuclei", "example5-nuclei"),
        levels=2,
        seed=51,
        dtype="u2",
    ).set_traits(
        ngc.LabelsTrait(source=[ngc.ReferenceObj(type="multiscale", ref=fov0.id)]),
        {
            "type": PROVENANCE,
            "task": "cellpose-segmentation",
            "version": "3.0.0",
            "inputs": [{"type": "multiscale", "ref": fov0.id}],
        },
    )
    (well_dir / "regionprops.csv").write_text(
        "label,area,mean_intensity\n1,120,0.82\n2,98,0.64\n"
    )
    table = ngc.new_node(
        TABLE,
        id=get_uuid4("example5-regionprops"),
        name="regionprops",
        path=ngc.DocPath(type=CSV, format="relative", href="./A/1/regionprops.csv"),
        fields={"columns": ["label", "area", "mean_intensity"]},
    )
    well = ngc.new_collection(
        id=get_uuid4("example5-A1"),
        name="A1",
        traits=[ngc.WellTrait(row_index=0, column_index=0)],
    ).add_external(fov0, nuclei, table)

    plate = ngc.PlateTrait(rows=[ngc.RowObj(name="A")], columns=[ngc.ColumnObj(name="1")])
    dataset = {
        "type": DATASET,
        "task": "segmentation",
        "samples": [
            {
                "image": {"type": "multiscale", "ref": fov0.id},
                "labels": {"type": "multiscale", "ref": nuclei.id},
                "split": "train",
            }
        ],
    }
    root = ngc.new_collection(id=ROOT_ID, name="plate-001", traits=[plate, dataset]).add(well)
    ngc.create(str(base / "zarr.json"), root, overwrite=True)


if __name__ == "__main__":
    main()
