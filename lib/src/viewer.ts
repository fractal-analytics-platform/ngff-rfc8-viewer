import { CSS_CLASS_PREFIX } from './constants';
import NGFFControlPanel from './control';
import { NGFFGraph } from './graph';
import { createHomepage } from './homepage';
import { NGFFLoader } from './loader';
import { NGFFSidebar } from './sidebar';

export default class NGFFViewer {
  private graph: NGFFGraph | null = null;
  private graphContainerId: string | null = null;
  // private view: TreeView | ListView | ImagesView | null = null;

  constructor(elementId: string, source: string | null, autoloadDepth: number, validate: boolean) {
    const element = document.getElementById(elementId);
    element?.classList.add(`${CSS_CLASS_PREFIX}body`);
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
    console.log('NGFFViewer: load()');
    if (!source) {
      element.innerHTML = '';
      element.appendChild(createHomepage());
      return;
    }

    const viewerContainer = document.createElement('div');
    viewerContainer.classList.add(`${CSS_CLASS_PREFIX}container`);

    const graphContainer = document.createElement('div');
    graphContainer.classList.add(`${CSS_CLASS_PREFIX}graph-container`);
    this.graphContainerId = `${element.id}-graph-container`;
    graphContainer.id = this.graphContainerId;

    const sidebar = document.createElement('div');

    const controlPanel = document.createElement('div');
    graphContainer.append(controlPanel);

    viewerContainer.appendChild(graphContainer);
    viewerContainer.appendChild(sidebar);

    element.appendChild(viewerContainer);

    try {
      const loader = new NGFFLoader(source);
      this.graph = new NGFFGraph(loader, autoloadDepth);
      // sidebar listens to graph update and load events
      new NGFFSidebar(sidebar, validate, this.graph);

      // When page loads, we first load the graph's root...
      await this.graph.loadRoot();

      // control listens to graph events and calls viewer.refreshView() when necessary
      new NGFFControlPanel(controlPanel, this.graph, this.graphContainerId);
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
