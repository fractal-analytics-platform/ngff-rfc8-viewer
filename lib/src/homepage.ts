import { CSS_CLASS_PREFIX } from './constants';

const exampleSources = [
  [
    'Basic example',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-examples/refs/heads/main/data/e01_basic_example/root.json'
  ],
  [
    'Basic example, with many images in a collection',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-examples/refs/heads/main/data/e02_basic_examples_many_images/root.json'
  ],
  [
    'Plate with multiple fields',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-examples/main/data/e04_plate_multiple_fields/root.json'
  ],
  [
    'Use https paths to add the examples above into 1 collection',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-examples/main/data/e03_http_urls_for_other_examples/root.json'
  ],
  [
    'Plate with multiple acquisitions of the same field',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-examples/main/data/e05_plate_multiple_acquisitions/root.json'
  ],
  [
    'Basic example of invalid attributes (click on multiscale node)',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-examples/main/examples/invalid-data/missing-multiscale-coordinate-systems.json'
  ],
  [
    'IDR v0.5 images to RFC-8. Singlescales use https paths',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-examples/refs/heads/main/data/e06_v05_idr_multi_doc/collection.json'
  ],
  [
    'Plate from IDR. Singlescales use https paths',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-examples/refs/heads/main/data/e07_v05_plate_to_multi_doc/collection.json'
  ],
  [
    'Big plate from IDR. Singlescales use https paths',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-examples/refs/heads/main/data/e08_v05_big_plate_to_multi_doc/collection.json'
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
    const jsonLink = document.createElement('a');
    jsonLink.href = url;
    jsonLink.target = '_blank';
    jsonLink.style.marginLeft = '20px';
    jsonLink.textContent = '[view json]';
    parent.appendChild(jsonLink);
    return link;
  }

  for (const [text, url] of exampleSources) {
    const listItem = document.createElement('li');
    listItem.style.marginBottom = '10px';
    createLink(url, text, listItem);
    list.appendChild(listItem);
  }

  return container;
}
