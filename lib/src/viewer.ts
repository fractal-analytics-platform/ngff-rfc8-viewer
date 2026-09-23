import { CSS_CLASS_PREFIX } from './constants';
import NGFFControlPanel from './control';
import { NGFFGraph } from './graph';
import { NGFFLoader } from './loader';
import { NGFFSidebar } from './sidebar';

export default class NGFFViewer {
  constructor(elementId: string, source: string | null, autoloadDepth: number) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Unable to find element with id ${elementId}`);
      return;
    }

    this.load(element, source, autoloadDepth);
  }

  async load(element: HTMLElement, source: string | null, autoloadDepth: number) {
    if (!source) {
      this.showAlert(element, 'Missing source parameter', 'warning');
      return;
    }

    const viewerContainer = document.createElement('div');
    viewerContainer.classList.add(`${CSS_CLASS_PREFIX}container`);

    const graphContainer = document.createElement('div');
    graphContainer.classList.add(`${CSS_CLASS_PREFIX}graph-container`);
    graphContainer.id = `${element.id}-graph-container`;

    const sidebar = document.createElement('div');
    const sidebarHandler = new NGFFSidebar(sidebar);

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
    alert.innerText = message;
    element.innerHTML = '';
    element.appendChild(alert);
  }
}
