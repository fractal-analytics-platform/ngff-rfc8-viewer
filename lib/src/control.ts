import { CSS_CLASS_PREFIX } from './constants';
import type { NGFFGraph } from './graph';
import type { NGFFSidebar } from './sidebar';

export default class NGFFControlPanel {
  private graph: NGFFGraph;
  private sidebar: NGFFSidebar;

  private spinner: HTMLElement;
  private loadAllBtn: HTMLButtonElement;
  private loadNextBtn: HTMLButtonElement;

  constructor(element: HTMLElement, graph: NGFFGraph, sidebar: NGFFSidebar) {
    this.graph = graph;
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

    element.appendChild(this.spinner);
  }

  async loadAll() {
    this.sidebar.hide();
    this.setLoadingState();
    try {
      await this.graph.recusiveLoad(Infinity);
      this.graph.renderTree();
    } finally {
      this.unsetLoadingState();
    }
  }

  async loadNext() {
    this.sidebar.hide();
    this.setLoadingState();
    try {
      await this.graph.recusiveLoad(1);
      this.graph.renderTree();
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
