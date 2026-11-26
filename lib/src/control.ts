import { CSS_CLASS_PREFIX } from './constants';
import type { NGFFGraphPage } from './pages/graph';
import type NGFFViewer from './viewer';

export default class NGFFControlPanel {
  private viewer: NGFFViewer;
  private graphPage: NGFFGraphPage;

  private element: HTMLElement;
  private spinner: HTMLElement;
  private loadAllBtn: HTMLButtonElement;
  private loadNextBtn: HTMLButtonElement;

  constructor(viewer: NGFFViewer, graphPage: NGFFGraphPage) {
    this.viewer = viewer;
    this.graphPage = graphPage;
    // Add all the buttons to the control panel

    this.element = document.createElement('div');
    this.spinner = document.createElement('div');
    const { loadNextBtn, loadAllBtn } = this.buildButtons(this.element);
    this.loadNextBtn = loadNextBtn;
    this.loadAllBtn = loadAllBtn;
  }

  public render(): HTMLElement {
    this.element.classList.add(`${CSS_CLASS_PREFIX}control-panel`);

    this.spinner.classList.add(
      `${CSS_CLASS_PREFIX}control-spinner`,
      `${CSS_CLASS_PREFIX}spinner`,
      `${CSS_CLASS_PREFIX}hide`
    );
    this.element.appendChild(this.spinner);

    // spacer
    const spacer = document.createElement('div');
    spacer.style.flexGrow = '1';
    this.element.appendChild(spacer);

    // GitHub link
    const githubLink = document.createElement('a');
    githubLink.href = 'https://github.com/fractal-analytics-platform/ngff-rfc8-viewer';
    githubLink.target = '_blank';
    githubLink.classList.add(`${CSS_CLASS_PREFIX}github`, `${CSS_CLASS_PREFIX}bi`);
    this.element.appendChild(githubLink);

    return this.element;
  }

  private buildButtons(element: HTMLElement): {
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
      history.pushState(null, '', `?${params.toString()}`);
      this.viewer.showHome();
    });

    addButton(
      `${CSS_CLASS_PREFIX}arrow-left-square`,
      btnGroup,
      'Back to root of current collection',
      () => {
        const params = new URLSearchParams(window.location.search);
        params.delete('select');
        history.pushState(null, '', `?${params.toString()}`);
        this.graphPage.backToRoot();
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
      this.graphPage.setView('tree');
    });
    addButton(`${CSS_CLASS_PREFIX}list-nested`, btnGroup, 'View List', () => {
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'list');
      history.pushState(null, '', `?${params.toString()}`);
      this.graphPage.setView('list');
    });
    addButton(`${CSS_CLASS_PREFIX}ui-checks`, btnGroup, 'View Images', () => {
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'images');
      history.pushState(null, '', `?${params.toString()}`);
      this.graphPage.setView('images');
    });

    // Validate button - toggle true/false
    const validate = new URLSearchParams(window.location.search).get('validate') === 'true';
    const valBtn = addButton(
      validate ? `${CSS_CLASS_PREFIX}shield-fill-check` : `${CSS_CLASS_PREFIX}shield-check`,
      element,
      'Validate selected node with JSON Schema',
      () => {
        const params = new URLSearchParams(window.location.search);
        const validate = params.get('validate') === 'true';
        params.set('validate', validate ? 'false' : 'true');
        history.pushState(null, '', `?${params.toString()}`);
        this.graphPage.setValidation(!validate);

        // change of validation state...
        valBtn.classList.remove(
          `${CSS_CLASS_PREFIX}shield-fill-check`,
          `${CSS_CLASS_PREFIX}shield-check`
        );
        valBtn.classList.add(
          this.graphPage.getValidation()
            ? `${CSS_CLASS_PREFIX}shield-fill-check`
            : `${CSS_CLASS_PREFIX}shield-check`
        );
      }
    );
    valBtn.id = `${CSS_CLASS_PREFIX}validate-btn`;
    valBtn.classList.add(`${CSS_CLASS_PREFIX}hide`);

    return { loadNextBtn, loadAllBtn };
  }

  private async loadAll() {
    this.setLoadingState(true);
    try {
      await this.graphPage.recursiveLoad(Infinity);
    } finally {
      this.setLoadingState(false);
    }
  }

  private async loadNext() {
    this.setLoadingState(true);
    try {
      await this.graphPage.recursiveLoad(1);
    } finally {
      this.setLoadingState(false);
    }
  }

  public setLoadingState(loading: boolean) {
    if (loading) {
      this.loadAllBtn.disabled = true;
      this.loadNextBtn.disabled = true;
      this.spinner.classList.remove(`${CSS_CLASS_PREFIX}hide`);
    } else {
      this.loadAllBtn.disabled = false;
      this.loadNextBtn.disabled = false;
      this.spinner.classList.add(`${CSS_CLASS_PREFIX}hide`);
    }
  }
}
