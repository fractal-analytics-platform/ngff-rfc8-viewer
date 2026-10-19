import type { D3Node, SinglescaleOmeNode } from './types';
import * as omezarr from 'ome-zarr.js';
import * as zarr from 'zarrita';

const defaultWidth = 200;

export function createThumbnailImg(node: D3Node, width: number = defaultWidth): HTMLDivElement {
  const storePath = node.resolvedPath;
  const store = new zarr.FetchStore(storePath);

  const rfc8multiscales = node.omeNode;
  if (!('nodes' in rfc8multiscales) || rfc8multiscales.nodes?.length === 0) {
    throw new Error('RFC8 multiscales node does not contain any nodes');
  }

  const ssNodes = rfc8multiscales.nodes?.map((node) => node as SinglescaleOmeNode);
  if (!(ssNodes && ssNodes.length > 0)) {
    throw new Error('No singlescale OME nodes found');
  }

  const ds: omezarr.Dataset[] = ssNodes.map((node) => {
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
  });

  const ds0 = ds[0];
  const ms: omezarr.Multiscale = {
    axes: rfc8multiscales.attributes?.coordinateSystems[0].axes,
    datasets: [ds0]
  };

  const v05Attrs = {
    ome: {
      version: '0.5',
      multiscales: [ms] as [omezarr.Multiscale, ...omezarr.Multiscale[]]
    }
  };

  const imgElement = document.createElement('img');
  imgElement.classList.add('thumbnail');
  // set initial source for the image to data:url for a blank image
  imgElement.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

  const container = document.createElement('div');
  // set the container's width and height - css will 'fit' the image within it
  container.style.width = `${width}px`;
  container.style.height = `${width}px`;
  container.classList.add('spinner');
  container.classList.add('thumbnail-container');
  container.appendChild(imgElement);

  omezarr.NgffImage.load(store, { attrs: v05Attrs }).then(async (ngffImg) => {
    const rfc8Src = await ngffImg.render({ targetSize: 200, autoBoost: true });
    imgElement.src = rfc8Src;
    container.classList.remove('spinner');
  });

  return container;
}
