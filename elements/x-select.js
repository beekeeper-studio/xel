
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html, closest, createElement} from "../utils/element.js";
import {throttle} from "../utils/time.js";

let debug = false;
let windowPadding = 7;
let $itemChild = Symbol();
let $oldTabIndex = Symbol()

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        width: fit-content;
        height: fit-content;
        max-width: 100%;
        box-sizing: border-box;
        outline: none;
        font-size: 15px;
        user-select: none;
        --arrow-width: 13px;
        --arrow-height: 13px;
        --arrow-min-width: 13px;
        --arrow-margin: 0 2px 0 11px;
        --arrow-color: currentColor;
        --arrow-d: path(
          "M 25 41 L 50 16 L 75 41 L 83 34 L 50 1 L 17 34 Z M 17 66 L 50 100 L 83 66 L 75 59 L 50 84 L 25 59 Z"
        );
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.5;
      }
      :host([hidden]) {
        display: none;
      }
      :host(:hover) {
        cursor: default;
      }

      #button {
        display: flex;
        flex-flow: row;
        align-items: center;
        justify-content: flex-start;
        flex: 1;
        width: 100%;
        height: 100%;
      }

      :host([mixed]) #button > * {
        opacity: 0.7;
      }

      #button > x-label {
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }

      #button > #arrow-container {
        margin: 0 0 0 auto;
        z-index: 999;
      }

      #button > #arrow-container #arrow {
        display: flex;
        width: var(--arrow-width);
        height: var(--arrow-height);
        min-width: var(--arrow-min-width);
        margin: var(--arrow-margin);
        color: var(--arrow-color);
        d: var(--arrow-d);
      }

      #button > #arrow-container #arrow path {
        fill: currentColor;
        d: inherit;
      }
    </style>

    <div id="button">
      <div id="arrow-container">
        <svg id="arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path></path>
        </svg>
      </div>
    </div>

    <slot></slot>
  </template>
`;

// @event
//   change {oldValue: string?, newValue: string?}
export class XSelectElement extends HTMLElement {
  static get observedAttributes() {
    return ["disabled"];
  }

  // @type
  //   string?
  // @default
  //   null
  get value() {
    let item = this.querySelector(`x-menuitem[toggled]`);
    return item ? item.value : null;
  }
  set value(value) {
    for (let item of this.querySelectorAll("x-menuitem")) {
      item.toggled = (item.value === value && value !== null);
    }
  }

  // @info
  //   Whether this select has "mixed" state.
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

    this._wasFocusedBeforeExpanding = false;
    this._updateButtonTh300 = throttle(this._updateButton, 300, this);

    this._mutationObserver = new MutationObserver((args) => this._onMutation(args));
    this._resizeObserver = new ResizeObserver(() => this._updateButtonChildrenSize());

    this._shadowRoot = this.attachShadow({mode: "open"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#backdrop"] = createElement("x-backdrop");
    this["#backdrop"].style.opacity = "0";
    this["#backdrop"].ownerElement = this;
    this["#backdrop"].addEventListener("click", (event) => this._onBackdropClick(event));

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("toggle", (event) => this._onMenuItemToggle(event));
    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));

  }

  connectedCallback() {
    this._mutationObserver.observe(this, {childList: true, attributes: true, characterData: true, subtree: true});
    this._resizeObserver.observe(this);

    this._updateButton();
    this._updateAccessabilityAttributes();

    if (debug) {
      this.setAttribute("debug", "");
    }
  }

  disconnectedCallback() {
    this._mutationObserver.disconnect();
    this._resizeObserver.disconnect();
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _expand() {
    if (this._canExpand() === false) {
      return;
    }

    this._wasFocusedBeforeExpanding = this.matches(":focus");

    this["#backdrop"].show(false);

    window.addEventListener("resize", this._resizeListener = () => {
      this._collapse();
    });

    window.addEventListener("blur", this._blurListener = () => {
      if (debug === false) {
        this._collapse()
      }
    });

    let menu = this.querySelector(":scope > x-menu");

    // Ensure all items are togglable, there is at most one toggled menu item and all other items are not toggled
    {
      let toggledItem = null;

      for (let item of menu.querySelectorAll("x-menuitem")) {
        item.togglable = true;

        if (item.toggled) {
          if (toggledItem === null) {
            toggledItem = item;
          }
          else {
            item.toggled = false;
          }
        }
      }
    }

    // Open the menu
    {
      let toggledItem = menu.querySelector(`x-menuitem[toggled]`);

      if (toggledItem) {
        let buttonChild = this["#button"].querySelector("x-label") || this["#button"].firstElementChild;
        let itemChild = buttonChild[$itemChild];

        menu.openOverElement(buttonChild, itemChild);
      }
      else {
        let item = menu.querySelector("x-menuitem").firstElementChild;
        menu.openOverElement(this["#button"], item);
      }
    }

    // Increase menu width if it is narrower than the button
    {
      let menuBounds = menu.getBoundingClientRect();
      let buttonBounds = this["#button"].getBoundingClientRect();
      let hostPaddingRight = parseFloat(getComputedStyle(this).paddingRight);

      if (menuBounds.right - hostPaddingRight < buttonBounds.right) {
        menu.style.minWidth = (buttonBounds.right - menuBounds.left + hostPaddingRight) + "px";
      }
    }

    // Reduce menu width if it oveflows the right client bound
    {
      let menuBounds = this.getBoundingClientRect();

      if (menuBounds.right + windowPadding > window.innerWidth) {
        this.style.maxWidth = (window.innerWidth - menuBounds.left - windowPadding) + "px";
      }
    }
  }

  async _collapse(whenTriggerEnd = null) {
    if (this._canCollapse() === false) {
      return;
    }

    let menu = this.querySelector(":scope > x-menu");
    menu.setAttribute("closing", "");
    await whenTriggerEnd;
    this["#backdrop"].hide(false);

    if (this._wasFocusedBeforeExpanding) {
      this.focus();
    }
    else {
      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
      }
    }

    window.removeEventListener("resize", this._resizeListener);
    window.removeEventListener("blur", this._blurListener);

    await menu.close();
    menu.removeAttribute("closing");
  }

  _canExpand() {
    if (this.disabled) {
      return false;
    }
    else {
      let menu = this.querySelector(":scope > x-menu");
      let item = menu.querySelector("x-menuitem");
      return menu !== null && menu.opened === false && menu.hasAttribute("closing") === false && item !== null;
    }
  }

  _canCollapse() {
    if (this.disabled) {
      return false;
    }
    else {
      let menu = this.querySelector(":scope > x-menu");
      let item = menu.querySelector("x-menuitem");
      return menu !== null && menu.opened === true && menu.hasAttribute("closing") === false;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateButton() {
    let toggledItem = this.querySelector(`:scope > x-menu x-menuitem[toggled]`);
    this["#button"].innerHTML = "";

    if (toggledItem) {
      for (let itemChild of toggledItem.children) {
        let buttonChild = itemChild.cloneNode(true);
        buttonChild[$itemChild] = itemChild;
        buttonChild.removeAttribute("id");
        buttonChild.removeAttribute("style");
        this["#button"].append(buttonChild);
      }

      this._updateButtonChildrenSize();
    }

    this["#button"].append(this["#arrow-container"]);
  }

  _updateButtonChildrenSize() {
    for (let buttonChild of this["#button"].children) {
      if (buttonChild !== this["#arrow-container"]) {
        let {width, height, margin, padding, border} = getComputedStyle(buttonChild[$itemChild]);

        if (["x-icon", "x-swatch", "img", "svg"].includes(buttonChild[$itemChild].localName)) {
          buttonChild.style.width = width;
          buttonChild.style.height = height;
          buttonChild.style.minWidth = width;
        }

        buttonChild.style.margin = margin;
        buttonChild.style.padding = padding;
        buttonChild.style.border = border;
      }
    }
  }

  _updateAccessabilityAttributes() {
    this.setAttribute("aria-disabled", this.disabled);

    // Update "tabindex" attribute
    {
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

    // Update "role" attributes
    {
      this.setAttribute("role", "button");
      let menu = this.querySelector(":scope > x-menu");

      if (menu) {
        menu.setAttribute("role", "listbox");

        for (let item of menu.querySelectorAll("x-menuitem")) {
          item.setAttribute("role", "option");
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onDisabledAttributeChange() {
    this._updateAccessabilityAttributes();
  }

  _onMutation(records) {
    for (let record of records) {
      if (record.type === "attributes" && record.target.localName === "x-menuitem" && record.attributeName === "toggled") {
        this._updateButtonTh300();
      }
    }
  }

  _onPointerDown(event) {
    // Don't focus the widget with pointer
    if (!event.target.closest("x-menu") && this.matches(":focus") === false) {
      event.preventDefault();
    }
  }

  _onClick(event) {
    if (event.button !== 0) {
      return;
    }

    if (this._canExpand()) {
      this._expand();
    }
    else if (this._canCollapse()) {
      let clickedItem = event.target.closest("x-menuitem");

      if (clickedItem) {
        let oldValue = this.value;
        let newValue = clickedItem.value;

        for (let item of this.querySelectorAll("x-menuitem")) {
          item.toggled = (item === clickedItem);
        }

        if (oldValue !== newValue || this.mixed) {
          this.mixed = false;
          this.dispatchEvent(new CustomEvent("change", {bubbles: true, detail: {oldValue, newValue}}));
        }

        this._collapse(clickedItem.whenTriggerEnd);
      }
    }
  }

  _onMenuItemToggle(event) {
    // We will toggle the menu items manually
    event.preventDefault();
  }

  _onBackdropClick(event) {
    this._collapse();
  }

  _onKeyDown(event) {
    if (event.defaultPrevented === false) {
      let menu = this.querySelector(":scope > x-menu");

      if (event.key === "Enter" || event.key === "Space" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        if (this._canExpand()) {
          event.preventDefault();
          this._expand();
        }
      }

      else if (event.key === "Escape") {
        if (this._canCollapse()) {
          event.preventDefault();
          this._collapse();
        }
      }
    }
  }
}

customElements.define("x-select", XSelectElement);
