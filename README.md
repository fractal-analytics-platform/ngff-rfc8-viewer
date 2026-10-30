# Metadata viewer for NGFF RFC-8 collections

Web viewer for the NGFF RFC-8 collections metadata - see https://ngff.openmicroscopy.org/rfc/8/index.html.

⚠️ **WARNING**: This project is a proof of concept. It is experimental, unstable, and not intended for production use. Its functionality will evolve with RFC-8 progress.

## Quick start

The web viewer is available at https://fractal-analytics-platform.github.io/ngff-rfc8-viewer/, and it includes multiple pre-made examples.

To create new RFC-8 OME-Zarr collections, also check out the [ngio-collections](https://github.com/BioVisionCenter/ngio-collections) package.

## How to build the library

Build the project via a single command through
```bash
npm run build-all
```

Note that this is equivalent to first building the viewer library
```bash
cd lib
npm ci
npm run build
```
and then the root project (which is a demo page calling the library)
```bash
npm ci
npm run build
```


## How to include the library

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


## Contributors and license

This project is developed by the [BioVisionCenter](https://www.biovisioncenter.uzh.ch/en.html) at the University of Zurich, who contracts [eXact lab s.r.l.](https://www.exact-lab.it/en/) for software engineering and development support.

Unless otherwise specified, all components are released under the BSD 3-Clause License, and copyright is with the BioVisionCenter at the University of Zurich.

Issues and PRs for the project are welcome. Be aware that this project is in a proof of concept phase and we don't commit to its API stability. Given that RFC-8 may still evolve, we expect to adapt new RFC-8 changes as they come and break existing functionality when needed.
