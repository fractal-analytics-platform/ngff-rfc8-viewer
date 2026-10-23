import { CSS_CLASS_PREFIX } from './constants';
import NGFFControlPanel from './control';
import { NGFFGraph } from './graph';
import { createHomepage } from './homepage';
import { NGFFLoader } from './loader';
import { NGFFSidebar } from './sidebar';
import { TreeView } from './views/tree';
import { ListView } from './views/list';
import { ImagesView } from './views/images';

export default class NGFFViewer {
  private graph: NGFFGraph | null = null;
  private graphContainerId: string | null = null;
  private view: TreeView | ListView | ImagesView | null = null;

  constructor(elementId: string, source: string | null, autoloadDepth: number, validate: boolean) {
    const element = document.getElementById(elementId);
    element?.classList.add(`${CSS_CLASS_PREFIX}body`);
    if (!element) {
      console.warn(`Unable to find element with id ${elementId}`);
      return;
    }

    this.load(element, source, autoloadDepth, validate);

    this.initHistory();
  }

  initHistory() {
    window.addEventListener('popstate', () => {
      console.log('NGFFViewer: popstate event triggered');
      this.refreshView();
    });
  }

  refreshView() {
    console.log('NGFFViewer: refreshView()');
    if (this.view) {
      this.view.destroy();
    }

    const queryParams = new URLSearchParams(window.location.search);
    // Determine which view to use based on the query parameter

    switch (queryParams.get('view')) {
      case 'images':
        this.view = new ImagesView(this.graph!, this.graphContainerId!);
        break;
      case 'list':
        this.view = new ListView(this.graph!, this.graphContainerId!);
        break;
      default:
        this.view = new TreeView(this.graph!, this.graphContainerId!);
    }
    // this.view.onNodeSelect((node) => {
    //   sidebarHandler.showInfo(node);

    //   // Update the URL hash with hierarchy path of the selected node
    //   const idsToNode = graph.getParentsIds(node).join('/');
    //   window.location.hash = idsToNode;
    // });
    // view.onBackgroundClick(() => sidebarHandler.hide());
    // const control = new NGFFControlPanel(document.getElementById(`${graphContainerId}-control-panel`)!, graph, view, sidebarHandler);
    // graph.onLoading((loading) =>
    //   loading ? control.setLoadingState() : control.unsetLoadingState()
    // );
    // return view;
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

      // control listens to graph events and calls viewer.refreshView() when necessary
      new NGFFControlPanel(controlPanel, this.graph, this);

      // When page loads, we first load the graph's root...
      console.log('graph root loading...');
      const rootLoaded = await this.graph.loadRoot();
      const selectedPath = window.location.hash.slice(1);
      // ...the handle any hash of nodeIds e.g. #root/child/grandchild
      if (rootLoaded && selectedPath) {
        try {
          await this.graph.loadNodeAtPath(decodeURIComponent(selectedPath));
        } catch (err) {
          this.graph.signalError(err instanceof Error ? err.message : 'Unexpected error');
        }
      }
    } catch (err) {
      console.error(err);
      const error = err instanceof Error ? err.message : 'Unexpected error';
      this.showAlert(element, error, 'error');
    }

    // finally we create the View
    console.log('NGFFViewer: initializing view');
    this.refreshView();
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
