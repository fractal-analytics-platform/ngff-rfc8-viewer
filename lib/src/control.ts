import { CSS_CLASS_PREFIX } from './constants';
import type { NGFFGraph } from './graph';
import { ImagesView } from './views/images';
import { ListView } from './views/list';
import { TreeView } from './views/tree';
import { ErrorAlert } from './error';

export default class NGFFControlPanel {
  private graph: NGFFGraph;

  private spinner: HTMLElement;
  private loadAllBtn: HTMLButtonElement;
  private loadNextBtn: HTMLButtonElement;
  private view: TreeView | ListView | ImagesView | null = null;
  private graphContainerId: string;
  private ignoreEvents: boolean = false;

  constructor(element: HTMLElement, graph: NGFFGraph, containerId: string) {
    this.graphContainerId = containerId;
    this.graph = graph;
    element.classList.add(`${CSS_CLASS_PREFIX}control-panel`);

    new ErrorAlert(graph, containerId);

    // Add all the buttons to the control panel
    const { loadNextBtn, loadAllBtn } = this.buildButtons(element);
    this.loadNextBtn = loadNextBtn;
    this.loadAllBtn = loadAllBtn;

    this.spinner = document.createElement('div');
    this.spinner.classList.add(
      `${CSS_CLASS_PREFIX}control-spinner`,
      `${CSS_CLASS_PREFIX}spinner`,
      `${CSS_CLASS_PREFIX}hide`
    );
    element.appendChild(this.spinner);

    // spacer
    const spacer = document.createElement('div');
    spacer.style.flexGrow = '1';
    element.appendChild(spacer);

    // GitHub link
    const githubLink = document.createElement('a');
    githubLink.href = 'https://github.com/fractal-analytics-platform/ngff-rfc8-viewer';
    githubLink.target = '_blank';
    githubLink.classList.add(`${CSS_CLASS_PREFIX}github`, `${CSS_CLASS_PREFIX}bi`);
    element.appendChild(githubLink);

    this.init();
  }

  async init() {
    // initial refreshView...
    this.refreshView();

    // start listening to popstate events for browser navigation
    this.initHistory();

    // start listening to node selection events
    this.initListeners();
  }

  initListeners() {
    this.graph.addLoadingListener((loading) =>
      loading ? this.setLoadingState() : this.unsetLoadingState()
    );

    this.graph.addNodeSelectedListener((node) => {
      if (this.ignoreEvents) {
        return;
      }
      const params = new URLSearchParams(window.location.search);
      let idsToNode = '';
      if (node) {
        idsToNode = this.graph.getParentsIds(node).join('/');
      }
      params.set('select', idsToNode);
      history.pushState(null, '', `?${params.toString()}`);
    });
  }

  initHistory() {
    window.addEventListener('popstate', () => {
      this.refreshView();
    });
  }

  buildButtons(element: HTMLElement): {
    loadNextBtn: HTMLButtonElement;
    loadAllBtn: HTMLButtonElement;
  } {
    // add buttons to the control panel
    function addButton(className: string, parent: HTMLElement, title: string, onClick: () => void) {
      const button = document.createElement('button');
      button.classList.add(className, `${CSS_CLASS_PREFIX}bi`);
      button.setAttribute('type', 'button');
      if (title) {
        button.title = title;
      }
      button.addEventListener('click', onClick);
      parent.appendChild(button);
      return button;
    }

    // Button group for home buttons
    let btnGroup = document.createElement('div');
    btnGroup.classList.add(`${CSS_CLASS_PREFIX}btn-group`);
    element.appendChild(btnGroup);

    addButton(`${CSS_CLASS_PREFIX}house-door-fill`, btnGroup, 'Home', () => {
      const params = new URLSearchParams(window.location.search);
      params.delete('source');
      params.delete('select');
      window.location.search = params.toString();
    });

    addButton(
      `${CSS_CLASS_PREFIX}arrow-left-square`,
      btnGroup,
      'Back to root of current collection',
      () => {
        const params = new URLSearchParams(window.location.search);
        params.delete('select');
        // reloads the page to reset the collection to unloaded state
        window.location.search = params.toString();
      }
    );

    // Button group for load buttons
    btnGroup = document.createElement('div');
    btnGroup.classList.add(`${CSS_CLASS_PREFIX}btn-group`);
    element.appendChild(btnGroup);

    const loadNextBtn = addButton(`${CSS_CLASS_PREFIX}node-plus`, btnGroup, 'Load next level', () =>
      this.loadNext()
    );

    const loadAllBtn = addButton(`${CSS_CLASS_PREFIX}node-plus`, btnGroup, 'Load all nodes', () =>
      this.loadAll()
    );
    loadAllBtn.classList.add(`${CSS_CLASS_PREFIX}icon-margin`);
    loadAllBtn.textContent = 'all';

    // Button group for view buttons
    btnGroup = document.createElement('div');
    btnGroup.classList.add(`${CSS_CLASS_PREFIX}btn-group`);
    element.appendChild(btnGroup);

    // All the view buttons update the URL and refresh the viewer accordingly
    addButton(`${CSS_CLASS_PREFIX}diagram-3-fill`, btnGroup, 'View Tree', () => {
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'tree');
      history.pushState(null, '', `?${params.toString()}`);
      this.refreshView();
    });
    addButton(`${CSS_CLASS_PREFIX}list-nested`, btnGroup, 'View List', () => {
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'list');
      history.pushState(null, '', `?${params.toString()}`);
      this.refreshView();
    });
    addButton(`${CSS_CLASS_PREFIX}ui-checks`, btnGroup, 'View Images', () => {
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'images');
      history.pushState(null, '', `?${params.toString()}`);
      this.refreshView();
    });

    // Validate button - toggle true/false
    const validate = new URLSearchParams(window.location.search).get('validate') == 'true';
    const vBtn = addButton(
      validate ? `${CSS_CLASS_PREFIX}shield-fill-check` : `${CSS_CLASS_PREFIX}shield-check`,
      element,
      'Validate selected node with JSON Schema',
      () => {
        const params = new URLSearchParams(window.location.search);
        params.set('validate', params.get('validate') == 'true' ? 'false' : 'true');
        history.pushState(null, '', `?${params.toString()}`);
        this.refreshView();
      }
    );
    vBtn.id = `${CSS_CLASS_PREFIX}validate-btn`;

    return { loadNextBtn, loadAllBtn };
  }

  async refreshView() {
    // Update the UI based on the current URL query parameters...

    // we don't want graph events to add to history while we're refreshing the view
    this.ignoreEvents = true;

    const queryParams = new URLSearchParams(window.location.search);

    // 'select' -> set selected Node
    const selectedPath = queryParams.get('select');
    if (selectedPath) {
      try {
        await this.graph.loadNodeAtPath(selectedPath);
      } catch (err) {
        this.graph.signalError(err instanceof Error ? err.message : 'Unexpected error');
      }
    } else {
      this.graph.selectNode();
    }

    // 'validate' -> set the appropriate validation state
    const validate = queryParams.get('validate') == 'true';
    const valBtn = document.getElementById(`${CSS_CLASS_PREFIX}validate-btn`);
    // change of validation state...
    if (valBtn) {
      valBtn.classList.remove(
        `${CSS_CLASS_PREFIX}shield-fill-check`,
        `${CSS_CLASS_PREFIX}shield-check`
      );
      valBtn.classList.add(
        validate ? `${CSS_CLASS_PREFIX}shield-fill-check` : `${CSS_CLASS_PREFIX}shield-check`
      );
    }
    this.graph.setValidation(validate);

    // 'view' -> set the appropriate view (images, list, tree)
    switch (queryParams.get('view')) {
      case 'images':
        // If the current view exists and is ImagesView - do nothing, otherwise...
        if (!(this.view && this.view instanceof ImagesView)) {
          // destroy if different view exists
          if (this.view) {
            this.view.destroy();
          }
          this.view = new ImagesView(this.graph, this.graphContainerId!);
        }
        break;
      case 'list':
        if (!(this.view && this.view instanceof ListView)) {
          if (this.view) {
            this.view.destroy();
          }
          this.view = new ListView(this.graph, this.graphContainerId!);
        }
        break;
      default:
        if (!(this.view && this.view instanceof TreeView)) {
          if (this.view) {
            this.view.destroy();
          }
          this.view = new TreeView(this.graph, this.graphContainerId!);
        }
    }
    this.ignoreEvents = false;
  }

  async loadAll() {
    this.setLoadingState();
    try {
      await this.graph.recursiveLoad(Infinity);
    } finally {
      this.unsetLoadingState();
    }
  }

  async loadNext() {
    this.setLoadingState();
    try {
      await this.graph.recursiveLoad(1);
    } finally {
      this.unsetLoadingState();
    }
  }

  setLoadingState() {
    this.loadAllBtn.disabled = true;
    this.loadNextBtn.disabled = true;
    this.spinner.classList.remove(`${CSS_CLASS_PREFIX}hide`);
  }

  unsetLoadingState() {
    this.loadAllBtn.disabled = false;
    this.loadNextBtn.disabled = false;
    this.spinner.classList.add(`${CSS_CLASS_PREFIX}hide`);
  }
}
