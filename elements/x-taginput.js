
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let $oldTabIndex = Symbol()

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: flex;
        align-items: center;
        position: relative;
        box-sizing: border-box;
        min-height: 24px;
        background: white;
        border: 1px solid #BFBFBF;
        font-size: 12px;
        --close-button-path-d: path(
          "M 25 16 L 50 41 L 75 16 L 84 25 L 59 50 L 84 75 L 75 84 L 50 59 L 25 84 L 16 75 L 41 50 L 16 25 Z"
        );
        --selection-color: currentColor;
        --selection-background: #B2D7FD;
        --tag-background: rgba(0, 0, 0, 0.04);
        --tag-border: 1px solid #cccccc;
        --tag-color: currentColor;
      }
      :host(:focus) {
        outline: 1px solid blue;
      }
      :host([error]) {
        --selection-color: white;
        --selection-background: #d50000;
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.5;
      }
      :host([hidden]) {
        display: none;
      }

      ::selection {
        color: var(--selection-color);
        background: var(--selection-background);
      }

      #main {
        width: 100%;
        height: 100%;
        min-height: inherit;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-start;
        align-items: center;
        align-content: flex-start;
        cursor: text;
      }

      #items {
        display: flex;
        flex-wrap: wrap;
        padding: 2px;
      }
      :host([mixed]) #items {
        opacity: 0.7;
      }

      .item {
        height: 100%;
        margin: 2px;
        padding: 0px 3px 0 6px;
        display: flex;
        line-height: 1.2;
        align-items: center;
        justify-content: center;
        background: var(--tag-background);
        border: var(--tag-border);
        color: var(--tag-color);
        font-size: inherit;
        cursor: default;
        user-select: none;
      }
      .item#editable-item {
        color: inherit;
        outline: none;
        background: none;
        border: 1px solid transparent;
        flex-grow: 1;
        align-items: center;
        justify-content: flex-start;
        white-space: pre;
        cursor: text;
        user-select: text;
      }

      .item .close-button {
        color: inherit;
        opacity: 0.8;
        width: 11px;
        height: 11px;
        vertical-align: middle;
        margin-left: 4px;
      }
      .item .close-button:hover {
        background: rgba(0, 0, 0, 0.1);
        opacity: 1;
      }

      .item .close-button-path {
        fill: currentColor;
        d: var(--close-button-path-d);
      }
    </style>

    <main id="main">
      <div id="items">
        <span id="editable-item" class="item" spellcheck="false"></span>
      </div>
      <slot></slot>
    </main>
  </template>
`;

// @events
//   input
//   change
//   textinputmodestart
//   textinputmodeend
export class XTagInputElement extends HTMLElement {
  static get observedAttributes() {
    return ["value", "spellcheck", "disabled"];
  }

  // @type
  //   Array<string>
  // @default
  //   []
  // @attribute
  get value() {
    if (this.hasAttribute("value")) {
      return this.getAttribute("value").split(this.delimiter).map($0 => $0.trim()).filter($0 => $0 !== "");
    }
    else {
      return [];
    }
  }
  set value(value) {
    if (value.length === 0) {
      this.removeAttribute("value");
    }
    else {
      this.setAttribute("value", value.join(this.delimiter));
    }
  }

  // @type
  //   string
  get delimiter() {
    return this.hasAttribute("delimiter") ? this.getAttribute("delimiter") : ",";
  }
  set delimiter(delimiter) {
    this.setAttribute("delimiter", delimiter);
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get spellcheck() {
    return this.hasAttribute("spellcheck");
  }
  set spellcheck(spellcheck) {
    spellcheck ? this.setAttribute("spellcheck", "") : this.removeAttribute("spellcheck");
  }

  // @type
  //   string
  get prefix() {
    return this.hasAttribute("prefix") ? this.getAttribute("prefix") : "";
  }
  set prefix(prefix) {
    prefix === "" ? this.removeAttribute("prefix") : this.setAttribute("prefix", prefix);
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

    this._shadowRoot = this.attachShadow({mode: "open", delegatesFocus: true});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("focusin", (event) => this._onFocusIn(event));
    this.addEventListener("focusout", (event) => this._onFocusOut(event));
    this._shadowRoot.addEventListener("pointerdown", (event) => this._onShadowRootPointerDown(event));
    this._shadowRoot.addEventListener("click", (event) => this._onShadowRootClick(event));
    this["#editable-item"].addEventListener("keydown", (event) => this._onInputKeyDown(event));
    this["#editable-item"].addEventListener("input", (event) => this._onInputInput(event));
  }

  connectedCallback() {
    this._update();
    this._updateAccessabilityAttributes();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "value") {
      this._onValueAttributeChange();
    }
    else if (name === "spellcheck") {
      this._onSpellcheckAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  // @info
  //   Override this method if you want the entered tags to match specific criteria.
  // @type
  //   (string) => boolean
  validateTag(tag) {
    return true;
  }

  _commitInput() {
    this._updateValidityState();

    if (this.hasAttribute("error") === false) {
      let tag = this["#editable-item"].textContent.trim();
      this["#editable-item"].textContent = "";

      if (tag.length > 0) {
        if (this.value.includes(tag) === false) {
          let value = this.value.filter($0 => $0 !== tag);
          this.value = [...value, tag];
          this.dispatchEvent(new CustomEvent("change"));
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _update() {
    for (let item of [...this["#items"].children]) {
      if (item !== this["#editable-item"]) {
        item.remove();
      }
    }

    for (let tag of this.value) {
      this["#editable-item"].insertAdjacentHTML("beforebegin", `
        <div class="item" data-tag="${tag}">
          <label>${this.prefix}${tag}</label>
          <svg class="close-button" viewBox="0 0 100 100"><path class="close-button-path"></path></svg>
        </div>
      `);
    }

    this._updatePlaceholderVisibility();
  }

  _updateValidityState() {
    let tag = this["#editable-item"].textContent.trim();

    if (this.validateTag(tag) === true || tag.length === 0) {
      this.removeAttribute("error");
    }
    else {
      this.setAttribute("error", "");
    }
  }

  _updatePlaceholderVisibility() {
    let placeholder = this.querySelector(":scope > x-label");

    if (placeholder) {
      placeholder.hidden = (this.value.length > 0 || this["#editable-item"].textContent.length > 0);
    }
  }

  _updateAccessabilityAttributes() {
    this.setAttribute("role", "input");
    this.setAttribute("aria-disabled", this.disabled);

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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onValueAttributeChange() {
    this._update();
  }

  _onSpellcheckAttributeChange() {
    this["#editable-item"].spellcheck = this.spellcheck;
  }

  _onDisabledAttributeChange() {
    this._updateAccessabilityAttributes();
  }

  _onFocusIn() {
    this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
  }

  _onFocusOut() {
    this._commitInput();
    this["#editable-item"].removeAttribute("contenteditable");
    this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));

    if (this.hasAttribute("error")) {
      this["#editable-item"].textContent = "";
      this.removeAttribute("error");
    }
  }

  _onShadowRootPointerDown(event) {
    if (event.target === this["#main"] || event.target === this["#items"]) {
      event.preventDefault();

      this["#editable-item"].setAttribute("contenteditable", "");

      let range = new Range();
      range.selectNodeContents(this["#editable-item"]);
      range.collapse(false);

      let selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    else if (event.target.matches(`.item, .item > *`)) {
      let item = event.target.closest(".item");
      let closeButton = event.target.closest(".close-button");

      if (item !== this["#editable-item"] && !closeButton) {
        event.preventDefault();
        event.stopPropagation();
        this["#editable-item"].focus();
        this._commitInput();
      }
    }
  }

  _onShadowRootClick(event) {
    if (event.target.closest(".close-button")) {
      this._onCloseButtonClick(event);
    }
  }

  _onCloseButtonClick(event) {
    let item = event.target.closest(".item");
    this.value = this.value.filter(tag => tag !== item.getAttribute("data-tag"));
    this.dispatchEvent(new CustomEvent("change"));
  }

  _onInputKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      this._commitInput();
    }
    else if (event.key === "Backspace") {
      let value = this["#editable-item"].textContent;

      if (value.length === 0) {
        this.value = this.value.slice(0, this.value.length - 1);
        this.dispatchEvent(new CustomEvent("change"));
      }
    }
  }

  _onInputInput() {
    let value = this["#editable-item"].textContent;

    if (value.includes(this.delimiter)) {
      this._commitInput();
    }

    this._updatePlaceholderVisibility();

    if (this.hasAttribute("error")) {
      this._updateValidityState();
    }

    this.dispatchEvent(new CustomEvent("input"));
  }
};

customElements.define("x-taginput", XTagInputElement);
