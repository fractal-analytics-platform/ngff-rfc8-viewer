# NGFF RFC-8 Viewer

Proof of principle of validation/viewing tools for NGFF RFC-8 collections

Examples:
* https://fractal-analytics-platform.github.io/ngff-rfc8-viewer/?source=https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-viewer/refs/heads/main/examples/data/example1/root.json
* https://fractal-analytics-platform.github.io/ngff-rfc8-viewer/?source=https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-viewer/refs/heads/main/examples/data/example2/root.json
* https://fractal-analytics-platform.github.io/ngff-rfc8-viewer/?source=https://raw.githubusercontent.com/tcompa/example-collections/refs/heads/main/plate/dataset/dataset.json
* https://fractal-analytics-platform.github.io/ngff-rfc8-viewer/?source=https://raw.githubusercontent.com/tcompa/example-collections/refs/heads/main/multiplex/dataset/dataset.json

## Build

First build the viewer library:

```bash
cd lib
npm ci
npm run build
```

Then you can build the root project, which is a demo page calling the library:

```bash
npm ci
npm run build
```

## Include the library

You can use the library including the files built in `lib/dist` in a HTML page:

```html
<link rel="stylesheet" href="ngff-rfc8-viewer.css" />
<script src="ngff-rfc8-viewer.umd.cjs"></script>
```

Have a look at the `index.html` source for a complete example.

## Development

To view the demo HTML page execute:

```bash
npm run dev
```

### pre-commit setup

In your local folder, create a file `.git/hooks/pre-commit` with the following content:

```bash
#!/bin/bash
cd lib && npm run pre-commit
RESULT=$?
[ $RESULT -ne 0 ] && exit 1
exit 0
```

and make this file executable (`chmod +x .git/hooks/pre-commit`).

In this way, `npm run pre-commit` will run before every commit.
