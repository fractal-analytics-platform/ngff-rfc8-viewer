# Example RFC-8 revision 1 collections

The scripts in `src/rfc8_examples` generate the collections under `data/` with
[ngio-collections](https://github.com/BioVisionCenter/ngio-collections) (branch `rfc8-revision1`)
and write small random zarr v3 arrays for every scale, so thumbnails render in the viewer.

Regenerate everything with

```bash
uv run examples-all
```

or one example at a time (`uv run example1`, ...). To build against a local ngio-collections checkout:

```bash
uv run --with-editable ../../ngio-collections examples-all
```

Explore the examples at https://fractal-analytics-platform.github.io/ngff-rfc8-viewer/ (the homepage
links every example), or locally with `npm run dev` from the repository root and
`?source=http://localhost:5173/examples/data/example1/zarr.json`.

## Example 1: scene and labels

```
hela-nuclei-experiment (collection, scene trait)
├── raw    -> ./raw    (multiscale, 2 scales)
└── nuclei -> ./nuclei (multiscale, 2 scales; labels trait on its entry -> raw)
```

## Example 2: many images

A collection with 10 multiscales of 5 scales each.

## Example 3: http paths

A standalone `root.json` collection whose nodes point to examples 1, 2 and 4 on
`raw.githubusercontent.com` with `format: "http"` paths. Each entry carries the UUID of the
document it points to.

## Example 4: HCS plate

```
plate-001 (collection, plate trait: rows A, columns 1/2, acquisitions t0/t1)
├── A1 -> ./A/1/well.json (collection, well + scene traits)
│   ├── fov0_t0 -> ./0      (multiscale; acquisition t0)
│   ├── fov0_t1 -> ./0_t1   (multiscale; acquisition t1, same field)
│   └── nuclei  -> ./nuclei (multiscale; labels -> fov0_t0)
└── A2 -> ./A/2/well.json (collection, well trait)
    └── fov0    -> ./0      (multiscale; acquisition t0)
```

Wells are standalone JSON documents, so their image hrefs are relative to `A/1/well.json`.

## Example 5: extensions

```
plate-001 (collection; plate trait + training-dataset trait)
└── A1 (embedded collection; well trait)
    ├── fov0        -> ./A/1/0               (multiscale)
    ├── nuclei      -> ./A/1/nuclei          (multiscale; labels -> fov0, provenance trait)
    └── regionprops -> ./A/1/regionprops.csv (Fractal table node, custom CSV path type)
```

The root document declares the two extensions in its `extension_manifest`; the extension ids and
JSON Schemas are the illustrative ones shipped with ngio-collections (`examples/schemas/`).

## Invalid examples

`data/invalid/legacy/root.json` is a document in the pre-revision RFC-8 format (`attributes`,
`singlescale` nodes, `path.path`); the viewer rejects it with an explicit error.
