import { CSS_CLASS_PREFIX } from './constants';
import type { D3Node, SinglescaleOmeNode, OmeNode } from './types';
import * as omezarr from 'ome-zarr.js';
import * as zarr from 'zarrita';

const defaultWidth = 200;

export function createThumbnailImg(
  node: D3Node,
  width: number = defaultWidth,
  ssChildren?: OmeNode[]
): HTMLDivElement {
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

  function showError(error: string) {
    imgElement.title = error;
    container.classList.remove(`${CSS_CLASS_PREFIX}spinner`);
    container.classList.add(`${CSS_CLASS_PREFIX}thumbnail-error`);
    container.appendChild(document.createElement('div')).innerHTML = '&#10005;';
  }

  const storePath = node.resolvedPath;
  const store = new zarr.FetchStore(storePath);

  const rfc8multiscales = node.omeNode;
  if (
    (!('nodes' in rfc8multiscales) || rfc8multiscales.nodes?.length === 0) &&
    !(ssChildren && ssChildren.length > 0)
  ) {
    showError('RFC8 multiscale node does not contain any nodes');
    return container;
  }

  const ssNodes =
    'nodes' in rfc8multiscales && rfc8multiscales.nodes?.length
      ? rfc8multiscales.nodes?.map((node) => node as SinglescaleOmeNode)
      : ssChildren?.map((node) => node as SinglescaleOmeNode);

  if (!(ssNodes && ssNodes.length > 0)) {
    showError('No singlescale OME nodes found');
    return container;
  }

  function createDataset(node: SinglescaleOmeNode): omezarr.Dataset {
    console.log('Creating dataset for node:', node);
    const scaleTransform = node.attributes.coordinateTransformations.find(
      (ct) => ct.type === 'scale'
    );
    if (!scaleTransform?.scale) {
      throw new Error('No scale transformation found for node: ' + node.path!.path);
    }
    return {
      path: node.path!.path,
      coordinateTransformations: [
        {
          type: 'scale' as const,
          scale: scaleTransform!.scale
        }
      ]
    };
  }

  const ms: omezarr.Multiscale = {
    axes: rfc8multiscales.attributes?.coordinateSystems[0].axes,
    datasets: ssNodes.map(createDataset) as [omezarr.Dataset, ...omezarr.Dataset[]]
  };

  const v05Attrs = {
    ome: {
      version: '0.5',
      multiscales: [ms] as [omezarr.Multiscale, ...omezarr.Multiscale[]]
    }
  };

  omezarr.NgffImage.load(store, { attrs: v05Attrs })
    .then(async (ngffImg) => {
      // render the thumbnail image
      const rfc8Src = await ngffImg.render({ targetSize: 200, autoBoost: true });
      imgElement.src = rfc8Src;
      container.classList.remove(`${CSS_CLASS_PREFIX}spinner`);
      // add other info to tooltip
      const scaleInfo = await ngffImg.getScales();
      const shapeInfo = await ngffImg.getShape();
      const calcShapesInfo = await ngffImg.calcShapes();
      const tooltip = `Full-size Shape: ${JSON.stringify(shapeInfo)}
Scales: ${JSON.stringify(scaleInfo)}
Shapes from Scales: ${JSON.stringify(calcShapesInfo)}`;
      imgElement.title = tooltip;
    })
    .catch((error) => {
      // handle error by displaying a 'X' and add an error message to the tooltip
      console.error('Error loading NGFF image:', error);
      imgElement.title = error.toString();
      container.classList.remove(`${CSS_CLASS_PREFIX}spinner`);
      container.classList.add(`${CSS_CLASS_PREFIX}thumbnail-error`);
      container.appendChild(document.createElement('div')).innerHTML = '&#10005;';
    });

  return container;
}
