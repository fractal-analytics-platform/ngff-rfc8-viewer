import { CSS_CLASS_PREFIX } from './constants';

const exampleSources = [
  [
    'Basic example',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-viewer/refs/heads/main/examples/data/example1/root.json'
  ],
  [
    'Basic example, with many images in a collection',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-viewer/refs/heads/main/examples/data/example2/root.json'
  ],
  [
    'Plate with multiple fields',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-viewer/main/examples/data/example4/root.json'
  ],
  [
    'Plate with multiple acquisitions of the same field',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-viewer/main/examples/data/example5/root.json'
  ],
  [
    'Basic example of invalid attributes (click on multiscale node)',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-viewer/main/examples/data/invalid/missing-multiscale-coordinate-systems.json'
  ],
  [
    'IDR v0.5 images converted to RFC-8',
    'https://raw.githubusercontent.com/BioVisionCenter/ngio-collections/refs/heads/main/examples/data/v05_idr_multi_doc/collection.json'
  ],
  [
    'Plate with 6 Wells as separate files',
    'https://raw.githubusercontent.com/BioVisionCenter/ngio-collections/refs/heads/main/examples/data/v05_plate_to_multi_doc/collection.json'
  ]
];

export function createHomepage(): HTMLDivElement {
  const container = document.createElement('div');
  container.classList.add(`${CSS_CLASS_PREFIX}homepage`);
  container.appendChild(document.createElement('h1')).textContent = 'ngff-rfc8-viewer';

  const queryParams = new URLSearchParams(window.location.search);
  const currentUrl = window.location.href;

  const form = document.createElement('form');
  container.appendChild(form);
  const input = document.createElement('input');
  input.placeholder = 'Enter source URL...';
  input.name = 'source';
  form.method = 'get';
  form.action = currentUrl.split('?')[0];
  form.appendChild(input);

  // Add a list of example sources
  const list = document.createElement('ul');
  container.appendChild(list);

  function createLink(url: string, text: string, parent: HTMLElement): HTMLAnchorElement {
    const link = document.createElement('a');
    queryParams.set('source', url);
    link.href = `${currentUrl.split('?')[0]}?${queryParams.toString()}`;
    link.textContent = text;
    parent.appendChild(link);
    return link;
  }

  for (const [text, url] of exampleSources) {
    const listItem = document.createElement('li');
    createLink(url, text, listItem);
    list.appendChild(listItem);
  }

  return container;
}
