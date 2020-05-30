
// @copyright
//   © 2016-2017 Jarosław Foksa

import {createElement, html, closest} from "../utils/element.js";
import {sleep} from "../utils/time.js";

let {max} = Math;

let easing = "cubic-bezier(0.4, 0, 0.2, 1)";

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: flex;
        align-items: center;
        position: relative;
        width: 100%;
        height: 100%;
        max-width: 200px;
        flex: 1 0 0;
        transition-property: max-width, padding, order;
        transition-duration: 0.15s;
        transition-timing-function: cubic-bezier(0.4, 0.0, 0.2, 1);
        cursor: default;
        padding: 0 4px 0 16px;
        user-select: none;
        touch-action: pan-y;
        box-sizing: border-box;
        overflow: hidden;
        contain: strict;
        will-change: max-width;
        z-index: 0;
        -webkit-app-region: no-drag;
        --ripple-type: none; /* bounded, none */
        --ripple-background: currentColor;
        --ripple-opacity: 0.2;
        --selection-indicator-height: 3px;
        --selection-indicator-color: var(--accent-color);
        --close-button-position: static;
        --close-button-left: 0;
        --close-button-right: initial;
        --close-button-width: 18px;
        --close-button-height: 18px;
        --close-button-margin: 0 0 0 auto;
        --close-button-opacity: 0.8;
        --close-button-path-d: path(
          "M 74 31 L 69 26 L 50 45 L 31 26 L 26 31 L 45 50 L 26 69 L 31 74 L 50 55 L 69 74 L 74 69 L 55 50 Z"
        );
      }
      :host([edited]) {
        --close-button-path-d: path(
          "M 68 50 C 68 60 60 68 50 68 C 40 68 32 60 32 50 C 32 40 40 32 50 32 C 60 32 68 40 68 50 Z"
        );
      }
      :host(:focus) {
        outline: none;
      }
      :host([closing]) {
        pointer-events: none;
      }
      :host([selected]) {
        z-index: 1;
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.5;
      }

      /**
       * Close button
       */

      #close-button {
        display: flex;
        align-items: center;
        justify-content: center;
        position: var(--close-button-position);
        left: var(--close-button-left);
        right: var(--close-button-right);
        width: var(--close-button-width);
        height: var(--close-button-height);
        margin: var(--close-button-margin);
        opacity: var(--close-button-opacity);
        padding: 1px;
      }
      #close-button:hover {
        background: rgba(0, 0, 0, 0.08);
        opacity: 1;
      }

      #close-button-path {
        pointer-events: none;
        d: var(--close-button-path-d);
        fill: currentColor;
      }

      /**
       * Ripples
       */

      #ripples {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        z-index: -1;
        contain: strict;
      }

      #ripples .ripple {
        position: absolute;
        top: 0;
        left: 0;
        width: 200px;
        height: 200px;
        background: var(--ripple-background);
        opacity: var(--ripple-opacity);
        border-radius: 999px;
        will-change: opacity, transform;
        pointer-events: none;
      }

      /**
       * Selection indicator
       */

      #selection-indicator {
        display: none;
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: var(--selection-indicator-height);
        background: var(--selection-indicator-color);
        pointer-events: none;
      }
      :host([selected]) #selection-indicator {
        display: block;
      }
      :host-context(x-doctabs[animatingindicator]) #selection-indicator {
        display: none;
      }
    </style>

    <div id="ripples"></div>
    <div id="selection-indicator"></div>

    <slot></slot>

    <svg id="close-button" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path id="close-button-path"></path>
    </svg>
  </template>
`;

// @events
//   close
export class XDocTabElement extends HTMLElement {
  static get observedAttributes() {
    return ["selected", "disabled"];
  }

  // @type
  //   XDocTabsElement
  // @readOnly
  get ownerTabs() {
    return this.closest("x-doctabs");
  }

  // @info
  //   Value associated with this tab.
  // @type
  //   string
  // @default
  //   ""
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "";
  }
  set value(value) {
    this.setAttribute("value", value);
  }

  // @property
  //   reflected
  // @type
  //   boolean
  // @default
  //   false
  get selected() {
    return this.hasAttribute("selected");
  }
  set selected(selected) {
    selected ? this.setAttribute("selected", "") : this.removeAttribute("selected");
  }

  // @property
  //   reflected
  // @type
  //   boolean
  // @default
  //   false
  get edited() {
    return this.hasAttribute("edited");
  }
  set edited(edited) {
    edited ? this.setAttribute("edited", "") : this.removeAttribute("edited");
  }

  // @property
  //   reflected
  // @type
  //   boolean
  // @default
  //   false
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled === true ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "open"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#close-button"].addEventListener("pointerdown", (event) => this._onCloseButtonPointerDown(event));
    this["#close-button"].addEventListener("click", (event) => this._onCloseButtonClick(event));
    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("click", (event) => this._onClick(event));
  }

  connectedCallback() {
    this.setAttribute("tabindex", this.selected ? "0" : "-1");
    this.setAttribute("role", "tab");
    this.setAttribute("aria-selected", this.selected);
    this.setAttribute("aria-disabled", this.disabled);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "selected") {
      this._onSelectedAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onSelectedAttributeChange() {
    this.setAttribute("aria-selected", this.selected);
    this.setAttribute("tabindex", this.selected ? "0" : "-1");
  }

  _onDisabledAttributeChange() {
    this.setAttribute("aria-disabled", this.disabled);
    this.setAttribute("tabindex", this.selected ? "0" : "-1");
  }

  _onPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      pointerDownEvent.preventDefault();
      return;
    }

    // Don't focus the widget with pointer, instead focus the closest ancestor focusable element
    if (this.matches(":focus") === false) {
      pointerDownEvent.preventDefault();

      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
      }
    }

    // Provide "pressed" attribute for theming purposes
    {
      let pointerDownTimeStamp = Date.now();

      this.setAttribute("pressed", "");
      this.setPointerCapture(pointerDownEvent.pointerId);

      this.addEventListener("lostpointercapture", async (event) => {
        if (this.selected === true) {
          let pressedTime = Date.now() - pointerDownTimeStamp;
          let minPressedTime = 100;

          if (pressedTime < minPressedTime) {
            await sleep(minPressedTime - pressedTime);
          }
        }

        this.removeAttribute("pressed");
      }, {once: true});
    }

    // Ripple
    {
      let rippleType = getComputedStyle(this).getPropertyValue("--ripple-type").trim();

      if (rippleType === "bounded") {
        let rect = this["#ripples"].getBoundingClientRect();
        let size = max(rect.width, rect.height) * 1.5;
        let top  = pointerDownEvent.clientY - rect.y - size/2;
        let left = pointerDownEvent.clientX - rect.x - size/2;

        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple pointer-down-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
        this["#ripples"].append(ripple);

        let inAnimation = ripple.animate({ transform: ["scale(0)", "scale(1)"]}, { duration: 300, easing });

        // Pointer capture is set on the owner tabs rather than this tab intentionally. Owner tabs might be
        // already capturing the pointer and hijacking it would disrupt the currently performed tab move
        // operation.
        this.ownerTabs.setPointerCapture(pointerDownEvent.pointerId);

        this.ownerTabs.addEventListener("lostpointercapture", async () => {
          await inAnimation.finished;

          let fromOpacity = getComputedStyle(ripple).opacity;
          let outAnimation = ripple.animate({ opacity: [fromOpacity, "0"]}, { duration: 300, easing });
          await outAnimation.finished;

          ripple.remove();
        }, {once: true});
      }
    }
  }

  async _onClick(event) {
    if (event.button !== 0) {
      return;
    }

    // Ripple
    if (this["#ripples"].querySelector(".pointer-down-ripple") === null) {
      let rippleType = getComputedStyle(this).getPropertyValue("--ripple-type").trim();

      if (rippleType === "bounded") {
        let rect = this["#ripples"].getBoundingClientRect();
        let size = max(rect.width, rect.height) * 1.5;
        let top  = (rect.y + rect.height/2) - rect.y - size/2;
        let left = (rect.x + rect.width/2) - rect.x - size/2;

        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple click-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
        this["#ripples"].append(ripple);

        let inAnimation = ripple.animate({ transform: ["scale(0)", "scale(1)"]}, { duration: 300, easing });
        await inAnimation.finished;

        let fromOpacity = getComputedStyle(ripple).opacity;
        let outAnimation = ripple.animate({ opacity: [fromOpacity, "0"] }, { duration: 300, easing });
        await outAnimation.finished;

        ripple.remove();
      }
    }
  }

  _onCloseButtonPointerDown(event) {
    if (event.buttons !== 1) {
      return;
    }

    event.stopPropagation();
  }

  _onCloseButtonClick(event) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();

    let customEvent = new CustomEvent("close", {bubbles: true, cancelable: true, detail: this});
    this.dispatchEvent(customEvent);

    if (customEvent.defaultPrevented === false) {
      this.ownerTabs.closeTab(this);
    }
  }
};

customElements.define("x-doctab", XDocTabElement);
