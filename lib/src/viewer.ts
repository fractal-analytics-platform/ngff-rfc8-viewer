import { CSS_CLASS_PREFIX } from './constants';
import NGFFControlPanel from './control';
import { NGFFGraph } from './graph';
import { createHomepage } from './homepage';
import { NGFFLoader } from './loader';
import { NGFFSidebar } from './sidebar';
import { TreeView } from './views/tree';
import { ListView } from './views/list';
import { ImagesView } from './views/images';
import { labelsSourceEdges } from './edges';

export default class NGFFViewer {
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
    if (!source) {
      element.innerHTML = '';
      element.appendChild(createHomepage());
      return;
    }

    const viewerContainer = document.createElement('div');
    viewerContainer.classList.add(`${CSS_CLASS_PREFIX}container`);

    const graphContainer = document.createElement('div');
    graphContainer.classList.add(`${CSS_CLASS_PREFIX}graph-container`);
    graphContainer.id = `${element.id}-graph-container`;

    const sidebar = document.createElement('div');

    const controlPanel = document.createElement('div');
    graphContainer.append(controlPanel);

    viewerContainer.appendChild(graphContainer);
    viewerContainer.appendChild(sidebar);

    element.appendChild(viewerContainer);

    try {
      const loader = new NGFFLoader(source);
      const graph = new NGFFGraph(loader, autoloadDepth, labelsSourceEdges);
      // sidebar listens to graph update and load events
      const sidebarHandler = new NGFFSidebar(sidebar, validate, graph);
      const queryParams = new URLSearchParams(window.location.search);
      // Determine which view to use based on the query parameter
      let view;
      switch (queryParams.get('view')) {
        case 'images':
          view = new ImagesView(graph, graphContainer.id);
          break;
        case 'list':
          view = new ListView(graph, graphContainer.id);
          break;
        default:
          view = new TreeView(graph, graphContainer.id);
      }
      view.onNodeSelect((node) => {
        sidebarHandler.showInfo(node);

        // Update the URL hash with hierarchy path of the selected node
        const idsToNode = graph.getParentsIds(node).join('/');
        window.location.hash = idsToNode;
      });
      view.onBackgroundClick(() => sidebarHandler.hide());
      const control = new NGFFControlPanel(controlPanel, graph, view, sidebarHandler);
      graph.onLoading((loading) =>
        loading ? control.setLoadingState() : control.unsetLoadingState()
      );

      // When page loads, we first load the graph's root...
      const rootLoaded = await graph.loadRoot();
      const selectedPath = window.location.hash.slice(1);
      // ...the handle any hash of nodeIds e.g. #root/child/grandchild
      if (rootLoaded && selectedPath) {
        try {
          const node = await graph.loadNodeAtPath(decodeURIComponent(selectedPath));
          view.selectNode(node);
          view.renderTree();
        } catch (err) {
          graph.signalError(err instanceof Error ? err.message : 'Unexpected error');
        }
      }
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
