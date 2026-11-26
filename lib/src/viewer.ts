import { CSS_CLASS_PREFIX } from './constants';
import { ErrorAlert } from './error';
import { NGFFGraphPage } from './pages/graph';
import { NGFFHomePage } from './pages/home';

export default class NGFFViewer {
  private elementId: string;
  private container: HTMLElement;
  private errorAlert: ErrorAlert;

  constructor(elementId: string) {
    this.elementId = elementId;
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Unable to find element with id ${elementId}`);
    }

    element.classList.add(`${CSS_CLASS_PREFIX}body`);

    this.container = document.createElement('div');
    element.appendChild(this.container);

    this.errorAlert = new ErrorAlert();
    element.appendChild(this.errorAlert.render());

    try {
      this.initHistory();
      this.handleRoute();
    } catch (err) {
      this.signalError(err);
    }
  }

  public showHome() {
    this.destroy();
    const homePage = new NGFFHomePage();
    this.setPage(homePage.render());
  }

  public showGraph(source: string, autoloadDepth: number, validate: boolean) {
    this.destroy();
    const graphPage = new NGFFGraphPage(this, source, autoloadDepth, validate);
    this.setPage(graphPage.render());
  }

  private setPage(newPage: HTMLElement) {
    this.container.replaceWith(newPage);
    this.container = newPage;
  }

  public signalError(err: unknown) {
    this.errorAlert.signalError(err);
  }

  public getContainerId() {
    return this.elementId;
  }

  private handleRoute() {
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('source');
    const autoload = urlParams.get('autoload');
    const validate = urlParams.get('validate') === 'true';
    let autoloadDepth = 0;
    if (autoload !== null) {
      autoloadDepth = parseInt(autoload);
      if (isNaN(autoloadDepth)) {
        autoloadDepth = 0;
      }
    }

    if (source) {
      this.showGraph(source, autoloadDepth, validate);
    } else {
      this.showHome();
    }
  }

  private initHistory() {
    window.addEventListener('popstate', () => {
      this.handleRoute();
    });
  }

  private destroy() {
    this.signalError(null);
    this.container.replaceChildren();
  }
}
