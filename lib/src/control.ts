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
  private viewTreeButton: HTMLButtonElement;
  private viewListButton: HTMLButtonElement;

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
    this.spinner.classList.add(`${CSS_CLASS_PREFIX}spinner`, `${CSS_CLASS_PREFIX}hide`);

    this.loadAllBtn = document.createElement('button');
    this.loadAllBtn.textContent = 'Load all nodes';
    this.loadAllBtn.setAttribute('type', 'button');
    this.loadAllBtn.addEventListener('click', () => this.loadAll());
    element.appendChild(this.loadAllBtn);

    this.loadNextBtn = document.createElement('button');
    this.loadNextBtn.textContent = 'Load next level';
    this.loadNextBtn.setAttribute('type', 'button');
    this.loadNextBtn.addEventListener('click', () => this.loadNext());
    element.appendChild(this.loadNextBtn);

    this.viewTreeButton = document.createElement('button');
    this.viewTreeButton.textContent = 'View Tree';
    this.viewTreeButton.setAttribute('type', 'button');
    this.viewTreeButton.addEventListener('click', () => {
      window.location.search = new URLSearchParams({
        ...Object.fromEntries(new URLSearchParams(window.location.search)),
        view: 'tree'
      }).toString();
    });
    element.appendChild(this.viewTreeButton);

    this.viewListButton = document.createElement('button');
    this.viewListButton.textContent = 'View List';
    this.viewListButton.setAttribute('type', 'button');
    this.viewListButton.addEventListener('click', () => {
      window.location.search = new URLSearchParams({
        ...Object.fromEntries(new URLSearchParams(window.location.search)),
        view: 'list'
      }).toString();
    });
    element.appendChild(this.viewListButton);

    element.appendChild(this.spinner);
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
