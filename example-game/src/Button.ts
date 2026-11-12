/** Кнопка управления игрой; общие стили добавляются в document.head. */

import {injectStyles} from "./injectStyles.ts";

export type Props = {
  label: string;
  /** SVG-разметка иконки перед текстом (опционально). */
  icon?: string;
  disabled?: boolean;
  onClick?: () => void;
};

const STYLE_ID = "example-button-styles";
const BUTTON_CLASS = "example-button";

type ButtonSpec = {
  type: "button";
  className: string;
  text: string;
  icon?: string;
  disabled: boolean;
  onClick?: () => void;
};

function buttonSpec(props: Props): ButtonSpec {
  return {
    type: "button",
    className: BUTTON_CLASS,
    text: props.label,
    icon: props.icon,
    disabled: props.disabled ?? false,
    onClick: props.onClick,
  };
}

function buttonStyles(className: string): string {
  return `
    .${className} {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 10px 0 12px;
      padding: 10px 28px;
      border: 2px solid #1565c0;
      border-radius: 12px;
      background: #121212;
      color: #fefefe;
      font: 700 15px/1 sans-serif;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
      touch-action: manipulation;
      transition: background-color 150ms, border-color 150ms, color 150ms, transform 100ms, opacity 150ms;
    }
    .${className}__icon { display: inline-flex; }
    .${className}__icon svg { width: 18px; height: 18px; }
    .${className}:not(:disabled):hover {
      background: #1565c0;
      border-color: #1565c0;
      color: #ffffff;
    }
    .${className}:not(:disabled):active {
      transform: translateY(1px) scale(0.98);
    }
    .${className}:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .${className}:not(:disabled):focus-visible {
      outline: 2px solid #1565c0;
      outline-offset: 3px;
    }
    @media (prefers-color-scheme: dark) {
      .${className} {
        border-color: #64b5f6;
        color: #64b5f6;
      }
      .${className}:not(:disabled):hover {
        background: #64b5f6;
        border-color: #64b5f6;
        color: #121212;
      }
      .${className}:not(:disabled):focus-visible {
        outline-color: #64b5f6;
      }
    }
  `;
}

function renderButton(parent: HTMLElement, spec: ButtonSpec): {element: HTMLButtonElement; label: Text} {
  const button = document.createElement("button");
  button.type = spec.type;
  button.className = spec.className;
  button.disabled = spec.disabled;
  if (spec.icon) {
    const icon = document.createElement("span");
    icon.className = `${spec.className}__icon`;
    icon.innerHTML = spec.icon;
    button.appendChild(icon);
  }
  const label = document.createTextNode(spec.text);
  button.appendChild(label);
  if (spec.onClick) button.addEventListener("click", spec.onClick);
  parent.appendChild(button);
  return {element: button, label};
}

export class Button {
  private readonly element: HTMLButtonElement;
  private readonly label: Text;

  constructor(parent: HTMLElement, props: Props) {
    injectStyles(STYLE_ID, buttonStyles(BUTTON_CLASS));
    const rendered = renderButton(parent, buttonSpec(props));
    this.element = rendered.element;
    this.label = rendered.label;
  }

  setDisabled(disabled: boolean): void {
    this.element.disabled = disabled;
  }

  setLabel(label: string): void {
    this.label.textContent = label;
  }
}
