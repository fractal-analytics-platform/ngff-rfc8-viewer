import { CSS_CLASS_PREFIX } from './constants';
import type { NGFFGraph } from './graph';

export class ErrorAlert {
  private errorAlert: HTMLDivElement;

  constructor(graph: NGFFGraph, containerId: string) {
    this.errorAlert = document.createElement('div');
    this.errorAlert.classList.add(
      `${CSS_CLASS_PREFIX}alert`,
      `${CSS_CLASS_PREFIX}error`,
      `${CSS_CLASS_PREFIX}alert-fixed`,
      `${CSS_CLASS_PREFIX}hide`
    );
    document.getElementById(containerId)?.appendChild(this.errorAlert);

    graph.addErrorListener((message: string | null) =>
      message === null ? this.hideErrorAlert() : this.showErrorAlert(message)
    );
  }

  showErrorAlert(message: string) {
    this.errorAlert.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = message;
    this.errorAlert.appendChild(span);
    const button = document.createElement('button');
    button.innerHTML = '&times;';
    button.onclick = () => this.hideErrorAlert();
    this.errorAlert.appendChild(button);
    this.errorAlert.classList.remove(`${CSS_CLASS_PREFIX}hide`);
  }

  hideErrorAlert() {
    this.errorAlert.classList.add(`${CSS_CLASS_PREFIX}hide`);
  }
}
