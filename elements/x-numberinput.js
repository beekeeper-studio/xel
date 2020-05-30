
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";
import {isNumeric} from "../utils/string.js";
import {debounce, sleep} from "../utils/time.js";
import {normalize, getPrecision, comparePoints, getDistanceBetweenPoints} from "../utils/math.js";

let {isFinite} = Number;
let numericKeys = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "+", ",", "."];
let $oldTabIndex = Symbol();

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        position: relative;
        width: 100px;
        height: 24px;
        box-sizing: border-box;
        color: #000000;
        --selection-color: currentColor;
        --selection-background: #B2D7FD;
        --inner-padding: 0;
      }
      :host(:hover) {
        cursor: text;
      }
      :host([error]) {
        --selection-color: white;
        --selection-background: #d50000;
      }
      :host([mixed]) {
        color: rgba(0, 0, 0, 0.7);
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
        display: flex;
        align-items: center;
        height: 100%;
      }

      #editor-container {
        display: flex;
        align-items: center;
        width: 100%;
        height: 100%;
        padding: var(--inner-padding);
        box-sizing: border-box;
        overflow: hidden;
      }

      #editor {
        width: 100%;
        overflow: auto;
        color: inherit;
        background: none;
        border: none;
        outline: none;
        font-family: inherit;
        font-size: inherit;
        line-height: 10;
        white-space: nowrap;
      }
      #editor::-webkit-scrollbar {
        display: none;
      }
      #editor::before {
        content: attr(data-prefix);
        pointer-events: none;
      }
      #editor::after {
        content: attr(data-suffix);
        pointer-events: none;
      }
      :host([empty]) #editor::before,
      :host([empty]) #editor::after,
      :host(:focus) #editor::before,
      :host(:focus) #editor::after {
        content: "";
      }
    </style>

    <main id="main">
      <div id="editor-container">
        <div id="editor" contenteditable="plaintext-only" spellcheck="false"></div>
      </div>

      <slot></slot>
    </main>
  </template>
`;

// @events
//   change
//   changestart
//   changeend
//   textinputmodestart
//   textinputmodeend
export class XNumberInputElement extends HTMLElement {
  static get observedAttributes() {
    return ["value", "min", "max", "prefix", "suffix", "disabled"];
  }

  // @type
  //   number?
  // @default
  //   null
  // @attribute
  get value() {
    return this.hasAttribute("value") ? parseFloat(this.getAttribute("value")) : null;
  }
  set value(value) {
    value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
  }

  // @type
  //   number
  // @default
  //   -Infinity
  // @attribute
  get min() {
    return this.hasAttribute("min") ? parseFloat(this.getAttribute("min")) : -Infinity;
  }
  set min(min) {
    isFinite(min) ? this.setAttribute("min", min) : this.removeAttribute("min");
  }

  // @type
  //   number
  // @default
  //   Infinity
  // @attribute
  get max() {
    return this.hasAttribute("max") ? parseFloat(this.getAttribute("max")) : Infinity;
  }
  set max(max) {
    isFinite(max) ? this.setAttribute("max", max) : this.removeAttribute("max");
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

  // @info
  //   Maximal number of digits to be shown after the dot. This setting affects only the display value.
  // @type
  //   number
  // @default
  //   20
  // @attribute
  get precision() {
    return this.hasAttribute("precision") ? parseFloat(this.getAttribute("precision")) : 20;
  }
  set precision(value) {
    this.setAttribute("precision", value);
  }

  // @info
  //   Number by which value should be incremented or decremented when up or down arrow key is pressed.
  // @type
  //   number
  // @default
  //   1
  // @attribute
  get step() {
    return this.hasAttribute("step") ? parseFloat(this.getAttribute("step")) : 1;
  }
  set step(step) {
    this.setAttribute("step", step);
  }

  // @type
  //   string
  // @default
  //   ""
  // @attribute
  get prefix() {
    return this.hasAttribute("prefix") ? this.getAttribute("prefix") : "";
  }
  set prefix(prefix) {
    this.setAttribute("prefix", prefix);
  }

  // @type
  //   string
  // @default
  //   ""
  // @attribute
  get suffix() {
    return this.hasAttribute("suffix") ? this.getAttribute("suffix") : "";
  }
  set suffix(suffix) {
    this.setAttribute("suffix", suffix);
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get required() {
    return this.hasAttribute("required");
  }
  set required(required) {
    required ? this.setAttribute("required", "") : this.removeAttribute("required");
  }

  // @info
  //   Whether this input has "mixed" state.
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

  // @type
  //   string?
  // @default
  //   null
  // @attribute
  get error() {
    return this.getAttribute("error");
  }
  set error(error) {
    error === null ? this.removeAttribute("error") : this.setAttribute("error", error);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._isDragging = false;
    this._isChangeStart = false;
    this._isArrowKeyDown = false;
    this._isBackspaceKeyDown = false;
    this._isStepperButtonDown = false;

    this._maybeDispatchChangeEndEvent = debounce(this._maybeDispatchChangeEndEvent, 500, this);

    this._shadowRoot = this.attachShadow({mode: "open", delegatesFocus: true});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this._shadowRoot.addEventListener("pointerdown", (event) => this._onShadowRootPointerDown(event));
    this._shadowRoot.addEventListener("wheel", (event) => this._onWheel(event));
    this["#editor"].addEventListener("paste", (event) => this._onPaste(event));
    this["#editor"].addEventListener("input", (event) => this._onEditorInput(event));
    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
    this.addEventListener("keyup", (event) => this._onKeyUp(event));
    this.addEventListener("keypress", (event) => this._onKeyPress(event));
    this.addEventListener("incrementstart", (event) => this._onStepperIncrementStart(event));
    this.addEventListener("decrementstart", (event) => this._onStepperDecrementStart(event));
    this.addEventListener("focusin", (event) => this._onFocusIn(event));
    this.addEventListener("focusout", (event) => this._onFocusOut(event));
  }

  connectedCallback() {
    this._updateAccessabilityAttributes();

    this._update();
  }

  attributeChangedCallback(name) {
    if (name === "value") {
      this._onValueAttributeChange();
    }
    else if (name === "min") {
      this._onMinAttributeChange();
    }
    else if (name === "max") {
      this._onMaxAttributeChange();
    }
    else if (name === "prefix") {
      this._onPrefixAttributeChange();
    }
    else if (name === "suffix") {
      this._onSuffixAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  // @info
  //   Override this method to validate the input value manually.
  // @type
  //   () => void
  validate() {
    if (this.value < this.min) {
      this.error = "Value is too low";
    }
    else if (this.value > this.max) {
      this.error = "Value is too high";
    }
    else if (this.required && this.value === null) {
      this.error = "This field is required";
    }
    else {
      this.error = null;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _increment(large = false) {
    let oldValue = this.value
    let newValue = this.value;

    if (large) {
      newValue += this.step * 10;
    }
    else {
      newValue += this.step;
    }

    newValue = normalize(newValue, this.min, this.max, getPrecision(this.step));

    if (oldValue !== newValue) {
      this.value = newValue;
    }

    if (this.matches(":focus")) {
      document.execCommand("selectAll");
    }

    this.validate();
    this._updateEmptyState();
  }

  _decrement(large = false) {
    let oldValue = this.value
    let newValue = this.value;

    if (large) {
      newValue -= this.step * 10;
    }
    else {
      newValue -= this.step;
    }

    newValue = normalize(newValue, this.min, this.max, getPrecision(this.step));

    if (oldValue !== newValue) {
      this.value = newValue;
    }

    if (this.matches(":focus")) {
      document.execCommand("selectAll");
    }

    this.validate();
    this._updateEmptyState();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _maybeDispatchChangeStartEvent() {
    if (!this._isChangeStart) {
      this._isChangeStart = true;
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
    }
  }

  _maybeDispatchChangeEndEvent() {
    if (this._isChangeStart && !this._isArrowKeyDown && !this._isBackspaceKeyDown && !this._isStepperButtonDown) {
      this._isChangeStart = false;
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
    }
  }

  _commitEditorChanges() {
    let editorValue = this["#editor"].textContent.trim() === "" ? null : parseFloat(this["#editor"].textContent);
    let normalizedEditorValue = normalize(editorValue, this.min, this.max);

    if (normalizedEditorValue !== this.value) {
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
      this.value = normalizedEditorValue;
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
    }
    else if (editorValue !== this.value) {
      this.value = normalizedEditorValue;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _update() {
    this.validate();

    this._updateEditorTextContent();
    this._updateEmptyState();
    this._updateStepper();
  }

  _updateEditorTextContent() {
    if (this.hasAttribute("value")) {
      this["#editor"].textContent = this.getAttribute("value").trim();
    }
    else {
      this["#editor"].textContent = "";
    }
  }

  _updateEmptyState() {
    let value = null;

    if (this.matches(":focus")) {
      value = this["#editor"].textContent.trim() === "" ? null : parseFloat(this["#editor"].textContent);
    }
    else {
      value = this.value;
    }

    if (value === null) {
      this.setAttribute("empty", "");
    }
    else {
      this.removeAttribute("empty");
    }
  }

  _updateStepper() {
    let stepper = this.querySelector("x-stepper");

    if (stepper) {
      let canDecrement = (this.value > this.min);
      let canIncrement = (this.value < this.max);

      if (canIncrement === true && canDecrement === true) {
        stepper.removeAttribute("disabled");
      }
      else if (canIncrement === false && canDecrement === false) {
        stepper.setAttribute("disabled", "");
      }
      else if (canIncrement === false) {
        stepper.setAttribute("disabled", "increment");
      }
      else if (canDecrement === false) {
        stepper.setAttribute("disabled", "decrement");
      }
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

  _onMinAttributeChange() {
    this._updateStepper();
  }

  _onMaxAttributeChange() {
    this._updateStepper();
  }

  _onPrefixAttributeChange() {
    this["#editor"].setAttribute("data-prefix", this.prefix);
  }

  _onSuffixAttributeChange() {
    this["#editor"].setAttribute("data-suffix", this.suffix);
  }

  _onDisabledAttributeChange() {
    this["#editor"].disabled = this.disabled;
    this._updateAccessabilityAttributes();
  }

  _onFocusIn() {
    document.execCommand("selectAll");
    this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
  }

  _onFocusOut() {
    this._shadowRoot.getSelection().collapse(this["#main"]);
    this["#editor"].scrollLeft = 0;

    this._commitEditorChanges();
    this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));
  }

  _onEditorInput() {
    this.validate();
    this._updateEmptyState();
    this._updateStepper();
  }

  _onWheel(event) {
    if (this.matches(":focus")) {
      event.preventDefault();
      this._maybeDispatchChangeStartEvent();

      if (event.wheelDeltaX > 0 || event.wheelDeltaY > 0) {
        this._increment(event.shiftKey);
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
      else {
        this._decrement(event.shiftKey);
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }

      this._maybeDispatchChangeEndEvent();
    }
  }

  _onClick(event) {
    event.preventDefault();
  }

  _onPointerDown(pointerDownEvent) {
    if (pointerDownEvent.target.localName === "x-stepper") {
      // Don't focus the input when user clicks stepper
      pointerDownEvent.preventDefault();
    }
  }

  _onShadowRootPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1 || pointerDownEvent.isPrimary === false) {
      pointerDownEvent.preventDefault();
      return;
    }

    if (pointerDownEvent.target === this["#editor"]) {
      if (this["#editor"].matches(":focus") === false) {
        pointerDownEvent.preventDefault();

        let initialValue = this.value;
        let cachedClientX = pointerDownEvent.clientX;
        let pointerDownPoint = new DOMPoint(pointerDownEvent.clientX, pointerDownEvent.clientY);
        let pointerMoveListener, lostPointerCaptureListener;

        this.style.cursor = "col-resize";
        this["#editor"].setPointerCapture(pointerDownEvent.pointerId);

        this["#editor"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
          let pointerMovePoint = new DOMPoint(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
          let deltaTime = pointerMoveEvent.timeStamp - pointerDownEvent.timeStamp;
          let isDistinct = pointerMoveEvent.clientX !== cachedClientX;
          let isIntentional = (getDistanceBetweenPoints(pointerDownPoint, pointerMovePoint) > 3 || deltaTime > 80);
          cachedClientX = pointerMoveEvent.clientX;

          if (isDistinct && isIntentional && pointerMoveEvent.isPrimary) {
            if (this._isDragging === false) {
              this._isDragging = true;
              this._isChangeStart = true;
              this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
            }


            let dragOffset = pointerMoveEvent.clientX - pointerDownEvent.clientX;
            let value = initialValue + (dragOffset * this.step);

            value = normalize(value, this.min, this.max, getPrecision(this.step));
            this.value = value;
            this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
          }
        });

        this["#editor"].addEventListener("lostpointercapture",  lostPointerCaptureListener = () => {
          this["#editor"].removeEventListener("pointermove", pointerMoveListener);
          this["#editor"].removeEventListener("lostpointercapture", lostPointerCaptureListener);

          this.style.cursor = null;

          if (this._isDragging === true) {
            this._isDragging = false;
            this._isChangeStart = false;
            this.dispatchEvent(new CustomEvent("changeend", {detail: this.value !== initialValue, bubbles: true}));
          }
          else {
            this["#editor"].focus();
            document.execCommand("selectAll");
          }
        });
      }
    }
  }

  _onStepperIncrementStart(event) {
    let incrementListener, incrementEndListener;

    this._isStepperButtonDown = true;

    this.addEventListener("increment", incrementListener = (event) => {
      this._maybeDispatchChangeStartEvent();
      this._increment(event.detail.shiftKey);
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      this._maybeDispatchChangeEndEvent();
      this._update();
    });

    this.addEventListener("incrementend", incrementEndListener = (event) => {
      this._isStepperButtonDown = false;
      this.removeEventListener("increment", incrementListener);
      this.removeEventListener("incrementend", incrementEndListener);
    });
  }

  _onStepperDecrementStart(event) {
    let decrementListener, decrementEndListener;

    this._isStepperButtonDown = true;

    this.addEventListener("decrement", decrementListener = (event) => {
      this._maybeDispatchChangeStartEvent();
      this._decrement(event.detail.shiftKey);
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      this._maybeDispatchChangeEndEvent();

      this._update();
    });

    this.addEventListener("decrementend", decrementEndListener = (event) => {
      this._isStepperButtonDown = false;
      this.removeEventListener("decrement", decrementListener);
      this.removeEventListener("decrementend", decrementEndListener);
    });
  }

  _onKeyDown(event) {
    if (event.code === "ArrowDown") {
      event.preventDefault();

      this._isArrowKeyDown = true;
      this._maybeDispatchChangeStartEvent();
      this._decrement(event.shiftKey);
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      this._maybeDispatchChangeEndEvent();

      this._update();
    }

    else if (event.code === "ArrowUp") {
      event.preventDefault();

      this._isArrowKeyDown = true;
      this._maybeDispatchChangeStartEvent();
      this._increment(event.shiftKey);
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      this._maybeDispatchChangeEndEvent();

      this._update();
    }

    else if (event.code === "Backspace") {
      this._isBackspaceKeyDown = true;
    }

    else if (event.code === "Enter") {
      this._commitEditorChanges();
      document.execCommand("selectAll");
    }
  }

  _onKeyUp(event) {
    if (event.code === "ArrowDown") {
      this._isArrowKeyDown = false;
      this._maybeDispatchChangeEndEvent();
    }

    else if (event.code === "ArrowUp") {
      this._isArrowKeyDown = false;
      this._maybeDispatchChangeEndEvent();
    }

    else if (event.code === "Backspace") {
      this._isBackspaceKeyDown = false;
    }
  }

  _onKeyPress(event) {
    if (numericKeys.includes(event.key) === false) {
      event.preventDefault();
    }
  }

  async _onPaste(event) {
    // Allow only for pasting numeric text
    event.preventDefault();
    let content = event.clipboardData.getData("text/plain").trim();

    if (isNumeric(content)) {
      // @bugfix: https://github.com/nwjs/nw.js/issues/3403
      await sleep(1);

      document.execCommand("insertText", false, content);
    }
  }
}

customElements.define("x-numberinput", XNumberInputElement);
