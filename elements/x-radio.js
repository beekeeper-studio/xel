
// @info
//   Radio widget.
// @doc
//   http://w3c.github.io/aria/aria/aria.html#radio
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html, closest} from "../utils/element.js";

let $oldTabIndex = Symbol();

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        position: relative;
        border: 3px solid black;
        width: 20px;
        height: 20px;
        border-radius: 99px;
        --dot-color: black;
        --dot-transform: scale(0);
        --dot-box-shadow: none;
      }
      :host([toggled]) {
        --dot-transform: scale(0.6);
      }
      :host(:focus) {
        outline: none;
      }
      :host([disabled]) {
        opacity: 0.4;
        pointer-events: none;
      }
      :host([hidden]) {
        display: none;
      }

      #main {
        border-radius: 99px;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #dot {
        width: 100%;
        height: 100%;
        background: var(--dot-color);
        border-radius: 99px;
        box-shadow: var(--dot-box-shadow);
        transform: var(--dot-transform);
        transition: all 0.15s ease-in-out;
      }
      :host([mixed][toggled]) #dot {
        height: 33%;
        border-radius: 0;
      }
    </style>

    <main id="main">
      <div id="dot"></div>
    </main>
  </template>
`;

// @events
//   toggle
export class XRadioElement extends HTMLElement {
  static get observedAttributes() {
    return ["toggled", "disabled"];
  }

  // @info
  //   Values associated with this widget.
  // @type
  //   string
  // @default
  //   ""
  // @attribute
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : null;
  }
  set value(value) {
    value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get toggled() {
    return this.hasAttribute("toggled");
  }
  set toggled(toggled) {
    toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get mixed() {
    return this.hasAttribute("mixed");
  }
  set mixed(mixed) {
    mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "open"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
  }

  connectedCallback() {
    this._updateAccessabilityAttributes();
  }

  attributeChangedCallback(name) {
    if (name === "toggled") {
      this._onToggledAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateAccessabilityAttributes() {
    this.setAttribute("role", "radio");
    this.setAttribute("aria-checked", this.toggled);
    this.setAttribute("aria-disabled", this.disabled);

    if (!this.closest("x-radios")) {
      if (this.disabled) {
        this[$oldTabIndex] = (this.tabIndex > 0 ? this.tabIndex : 0);
        this.tabIndex = -1;
      }
      else {
        if (this.tabIndex < 0) {
          this.tabIndex = (this[$oldTabIndex] > 0) ? this[$oldTabIndex] : 0;
        }

        delete this[$oldTabIndex];
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onToggledAttributeChange() {
    this.setAttribute("aria-checked", this.toggled);
  }

  _onDisabledAttributeChange() {
    this._updateAccessabilityAttributes();
  }

  _onClick(event) {
    if (!this.closest("x-radios")) {
      if (this.toggled && this.mixed) {
        this.mixed = false;
      }
      else {
        this.mixed = false;
        this.toggled = !this.toggled;
      }

      this.dispatchEvent(new CustomEvent("toggle", {bubbles: true}));
    }
  }

  _onPointerDown(event) {
    // Don't focus the widget with pointer, instead focus the closest ancestor focusable element
    if (this.matches(":focus") === false) {
      event.preventDefault();

      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
      }
    }
  }

  _onKeyDown(event) {
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      this.click();
    }
  }
};

customElements.define("x-radio", XRadioElement);
