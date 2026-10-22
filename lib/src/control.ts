import { CSS_CLASS_PREFIX } from './constants';
import type { NGFFGraph } from './graph';
import type { NGFFSidebar } from './sidebar';

export default class NGFFControlPanel {
  private graph: NGFFGraph;
  private view: { renderTree: () => void };
  private sidebar: NGFFSidebar;

  private spinner: HTMLElement;
  private loadAllBtn: HTMLButtonElement;
  private loadNextBtn: HTMLButtonElement;

  constructor(
    element: HTMLElement,
    graph: NGFFGraph,
    view: { renderTree: () => void },
    sidebar: NGFFSidebar
  ) {
    this.graph = graph;
    this.view = view;
    this.sidebar = sidebar;

    element.classList.add(`${CSS_CLASS_PREFIX}control-panel`);

    this.spinner = document.createElement('div');
    this.spinner.classList.add(
      `${CSS_CLASS_PREFIX}control-spinner`,
      `${CSS_CLASS_PREFIX}spinner`,
      `${CSS_CLASS_PREFIX}hide`
    );

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

    const params = new URLSearchParams(window.location.search);

    // Button group for home buttons
    let btnGroup = document.createElement('div');
    btnGroup.classList.add(`${CSS_CLASS_PREFIX}btn-group`);
    element.appendChild(btnGroup);

    addButton(`${CSS_CLASS_PREFIX}house-door-fill`, btnGroup, 'Home', () => {
      window.location.hash = '';
      params.delete('source');
      window.location.search = params.toString();
    });

    addButton(
      `${CSS_CLASS_PREFIX}arrow-left-square`,
      btnGroup,
      'Back to root of current collection',
      () => {
        window.location.hash = '';
        window.location.reload();
      }
    );

    // Button group for load buttons
    btnGroup = document.createElement('div');
    btnGroup.classList.add(`${CSS_CLASS_PREFIX}btn-group`);
    element.appendChild(btnGroup);

    this.loadAllBtn = document.createElement('button');
    this.loadAllBtn.textContent = 'Load All';
    this.loadAllBtn.style.lineHeight = '16.5px';
    this.loadAllBtn.title = 'Load all nodes';
    this.loadAllBtn.setAttribute('type', 'button');
    this.loadAllBtn.addEventListener('click', () => this.loadAll());
    btnGroup.appendChild(this.loadAllBtn);

    this.loadNextBtn = document.createElement('button');
    this.loadNextBtn.textContent = '+1';
    this.loadNextBtn.style.lineHeight = '16.5px';
    this.loadNextBtn.title = 'Load next level';
    this.loadNextBtn.setAttribute('type', 'button');
    this.loadNextBtn.addEventListener('click', () => this.loadNext());
    btnGroup.appendChild(this.loadNextBtn);

    // Button group for view buttons
    btnGroup = document.createElement('div');
    btnGroup.classList.add(`${CSS_CLASS_PREFIX}btn-group`);
    element.appendChild(btnGroup);

    addButton(`${CSS_CLASS_PREFIX}diagram-3-fill`, btnGroup, 'View Tree', () => {
      params.set('view', 'tree');
      window.location.search = params.toString();
    });

    addButton(`${CSS_CLASS_PREFIX}list-nested`, btnGroup, 'View List', () => {
      params.set('view', 'list');
      window.location.search = params.toString();
    });

    // Validate button - toggle true/false
    const validate = params.get('validate') == 'true';
    addButton(
      validate ? `${CSS_CLASS_PREFIX}shield-fill-check` : `${CSS_CLASS_PREFIX}shield-check`,
      element,
      'Validate selected node with JSON Schema',
      () => {
        params.set('validate', validate ? 'false' : 'true');
        window.location.search = params.toString();
      }
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
  }

  async loadAll() {
    this.sidebar.hide();
    this.setLoadingState();
    try {
      await this.graph.recursiveLoad(Infinity);
      this.view.renderTree();
    } finally {
      this.unsetLoadingState();
    }
  }

  async loadNext() {
    this.sidebar.hide();
    this.setLoadingState();
    try {
      await this.graph.recursiveLoad(1);
      this.view.renderTree();
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
