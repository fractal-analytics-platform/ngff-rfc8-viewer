import { CSS_CLASS_PREFIX } from './constants';

const EXAMPLES_BASE =
  'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-viewer/main/examples/data';

const exampleSources = [
  [
    'Basic example: two images in a scene, one a label image',
    `${EXAMPLES_BASE}/example1/zarr.json`
  ],
  ['Many images in a collection (10 images, 5 scales each)', `${EXAMPLES_BASE}/example2/zarr.json`],
  [
    'HCS plate: plate / well / acquisition traits, wells as JSON documents',
    `${EXAMPLES_BASE}/example4/zarr.json`
  ],
  [
    'Use http paths to add the examples above into 1 collection',
    `${EXAMPLES_BASE}/example3/root.json`
  ],
  [
    'Extensions: extension manifest, URI traits and a URI node type (table with CSV path)',
    `${EXAMPLES_BASE}/example5/zarr.json`
  ],
  [
    'Pre-revision RFC-8 document (shows the legacy format error)',
    `${EXAMPLES_BASE}/invalid/legacy/root.json`
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
