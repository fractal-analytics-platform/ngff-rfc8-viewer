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
  ]
];

export function createHomepage(): HTMLDivElement {
  const container = document.createElement('div');
  container.classList.add(`${CSS_CLASS_PREFIX}homepage`);
  container.appendChild(document.createElement('h1')).textContent = 'ngff-rfc8-viewer';
  const list = document.createElement('ul');
  container.appendChild(list);

  const queryParams = new URLSearchParams(window.location.search);
  const currentUrl = window.location.href;

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
