import { CSS_CLASS_PREFIX } from './constants';

export class ErrorAlert {
  private errorAlert: HTMLDivElement;

  constructor() {
    this.errorAlert = document.createElement('div');
  }

  public render(): HTMLElement {
    this.errorAlert.classList.add(
      `${CSS_CLASS_PREFIX}alert`,
      `${CSS_CLASS_PREFIX}error`,
      `${CSS_CLASS_PREFIX}alert-fixed`,
      `${CSS_CLASS_PREFIX}hide`
    );
    return this.errorAlert;
  }

  public signalError(err: unknown) {
    if (err) {
      console.trace(err); // to enable debugging of where the error originated
      const message =
        typeof err === 'string' ? err : err instanceof Error ? err.message : 'Unexpected error';
      this.showErrorAlert(message);
    } else {
      this.hideErrorAlert();
    }
  }

  private showErrorAlert(message: string) {
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

  private hideErrorAlert() {
    this.errorAlert.classList.add(`${CSS_CLASS_PREFIX}hide`);
  }
}
