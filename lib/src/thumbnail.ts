import { CSS_CLASS_PREFIX } from './constants';
import type { D3Node, OmeNode } from './types';
import * as omezarr from 'ome-zarr.js';
import { documentDirectory, resolveHref } from './paths';

const defaultWidth = 200;

type DatasetTransformation =
  { type: 'scale'; scale: number[] } | { type: 'translation'; translation: number[] };

/**
 * Builds OME-Zarr 0.5 `multiscales` attributes from a revision-1 multiscale node, so that ome-zarr.js
 * can render it. `documentUrl` is the metadata file of the multiscale document: scale hrefs are
 * resolved against it to absolute URLs, which ome-zarr.js opens in their own store (see
 * `openArrayOrGroup` in ome-zarr.js: paths starting with `http` get a dedicated `FetchStore`).
 */
export function buildMultiscaleAttrs(node: OmeNode, documentUrl: string) {
  const scales = node.scales;
  if (!scales || scales.length === 0) {
    throw new Error('Multiscale has no scales (document not loaded?)');
  }
  const systems = node.coordinate_systems ?? [];
  if (systems.length === 0) {
    throw new Error('Multiscale has no coordinate systems');
  }
  const outputRef = scales[0].coordinate_transformations?.find(
    (t) => t.output?.type === 'coordinate_system'
  )?.output?.ref;
  const system = systems.find((cs) => cs.id === outputRef) ?? systems[0];

  const datasets = scales.map((scale) => {
    const transformations: DatasetTransformation[] = [];
    for (const t of scale.coordinate_transformations ?? []) {
      if (t.type === 'scale' && Array.isArray(t.scale)) {
        transformations.push({ type: 'scale', scale: t.scale });
      } else if (t.type === 'translation' && Array.isArray(t.translation)) {
        transformations.push({ type: 'translation', translation: t.translation });
      }
    }
    if (!transformations.some((t) => t.type === 'scale')) {
      throw new Error(`Scale "${scale.id}" (${scale.path.href}) has no scale transformation`);
    }
    return {
      path: resolveHref(scale.path, documentUrl),
      coordinateTransformations: transformations
    };
  });

  const multiscale: omezarr.Multiscale = {
    axes: system.axes,
    datasets: datasets as [omezarr.Dataset, ...omezarr.Dataset[]]
  };
  return {
    ome: {
      version: '0.5',
      multiscales: [multiscale] as [omezarr.Multiscale, ...omezarr.Multiscale[]]
    }
  };
}

export function createThumbnailImg(node: D3Node, width: number = defaultWidth): HTMLDivElement {
  const imgElement = document.createElement('img');
  // set initial source for the image to data:url for a blank image
  imgElement.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

  const container = document.createElement('div');
  // set the container's width and height - css will 'fit' the image within it
  container.style.width = `${width}px`;
  container.style.height = `${width}px`;
  container.classList.add(`${CSS_CLASS_PREFIX}spinner`);
  container.classList.add(`${CSS_CLASS_PREFIX}thumbnail-container`);
  container.appendChild(imgElement);

  // the multiscale document: the one the node points to, or the one it is the root of
  const documentUrl = node.targetUrl ?? node.documentUrl;

  let attrs: ReturnType<typeof buildMultiscaleAttrs>;
  try {
    attrs = buildMultiscaleAttrs(node.omeNode, documentUrl);
  } catch (err) {
    showThumbnailError(container, err instanceof Error ? err.message : String(err));
    return container;
  }

  omezarr.NgffImage.load(documentDirectory(documentUrl), { attrs })
    .then(async (ngffImg) => {
      // render the thumbnail image
      imgElement.src = await ngffImg.render({ targetSize: 200, autoBoost: true });
      container.classList.remove(`${CSS_CLASS_PREFIX}spinner`);
      // add other info to tooltip
      const scaleInfo = ngffImg.getScales();
      const shapeInfo = await ngffImg.getShape();
      const calcShapesInfo = await ngffImg.calcShapes();
      imgElement.title = `Full-size Shape: ${JSON.stringify(shapeInfo)}
Scales: ${JSON.stringify(scaleInfo)}
Shapes from Scales: ${JSON.stringify(calcShapesInfo)}`;
    })
    .catch((error) => {
      // handle error by displaying a 'X' and add an error message to the tooltip
      console.log('multiscale attrs', attrs);
      console.error('Error loading NGFF image:', error);
      showThumbnailError(container, error.toString());
    });

  return container;
}

function showThumbnailError(container: HTMLDivElement, message: string) {
  container.classList.remove(`${CSS_CLASS_PREFIX}spinner`);
  container.classList.add(`${CSS_CLASS_PREFIX}thumbnail-error`);
  container.title = message;
  container.appendChild(document.createElement('div')).innerHTML = '&#10005;';
}
