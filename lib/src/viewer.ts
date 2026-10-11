import { CSS_CLASS_PREFIX } from './constants';
import NGFFControlPanel from './control';
import { NGFFGraph } from './graph';
import { NGFFLoader } from './loader';
import { NGFFSidebar } from './sidebar';

const exampleSources = [
  [
    'basic example',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-viewer/refs/heads/main/examples/data/example1/root.json'
  ],
  [
    'many images',
    'https://raw.githubusercontent.com/fractal-analytics-platform/ngff-rfc8-viewer/refs/heads/main/examples/data/example2/root.json'
  ],
  [
    'plate with multiple fields',
    'https://raw.githubusercontent.com/tcompa/example-collections/refs/heads/main/plate/dataset/dataset.json'
  ]
];

export default class NGFFViewer {
  constructor(elementId: string, source: string | null, autoloadDepth: number, validate: boolean) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Unable to find element with id ${elementId}`);
      return;
    }

    this.load(element, source, autoloadDepth, validate);
  }

  async load(
    element: HTMLElement,
    source: string | null,
    autoloadDepth: number,
    validate: boolean
  ) {
    if (!source) {
      let queryParams = new URLSearchParams(window.location.search);
      let currentUrl = window.location.href;

      let linksHtml = exampleSources
        .map(([name, url]) => {
          queryParams.set('source', url);
          return `<a href="${currentUrl.split('?')[0]}?${queryParams.toString()}">${name}</a>`;
        })
        .join('<br>');
      this.showAlert(
        element,
        `Missing source parameter. Try one of the examples:<br>${linksHtml}`,
        'warning'
      );
      return;
    }

    const viewerContainer = document.createElement('div');
    viewerContainer.classList.add(`${CSS_CLASS_PREFIX}container`);

    const graphContainer = document.createElement('div');
    graphContainer.classList.add(`${CSS_CLASS_PREFIX}graph-container`);
    graphContainer.id = `${element.id}-graph-container`;

    const sidebar = document.createElement('div');
    const sidebarHandler = new NGFFSidebar(sidebar, validate);

    const controlPanel = document.createElement('div');
    graphContainer.append(controlPanel);

    viewerContainer.appendChild(graphContainer);
    viewerContainer.appendChild(sidebar);

    element.appendChild(viewerContainer);

    try {
      const loader = new NGFFLoader(source);
      const graph = new NGFFGraph(graphContainer.id, loader, sidebarHandler, autoloadDepth);
      const control = new NGFFControlPanel(controlPanel, graph, sidebarHandler);
      graph.onLoading((loading) =>
        loading ? control.setLoadingState() : control.unsetLoadingState()
      );
      graph.loadRoot();
    } catch (err) {
      console.error(err);
      const error = err instanceof Error ? err.message : 'Unexpected error';
      this.showAlert(element, error, 'error');
    }
  }

  showAlert(element: HTMLElement, message: string, type: 'warning' | 'error') {
    const alert = document.createElement('div');
    alert.classList.add(`${CSS_CLASS_PREFIX}alert`);
    alert.classList.add(`${CSS_CLASS_PREFIX}${type}`);
    alert.classList.remove(`${CSS_CLASS_PREFIX}hide`);
    alert.innerHTML = message;
    element.innerHTML = '';
    element.appendChild(alert);
  }
}
