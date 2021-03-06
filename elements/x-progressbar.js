
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";
import {normalize} from "../utils/math.js";

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        box-sizing: border-box;
        height: 4px;
        width: 100%;
        position: relative;
        contain: strict;
        overflow: hidden;
        background: #acece6;
        cursor: default;
        --bar-background: #3B99FB;
        --bar-box-shadow: 0px 0px 0px 1px #3385DB;
      }
      :host([hidden]) {
        display: none;
      }

      #indeterminate-bars {
        width: 100%;
        height: 100%;
      }

      #determinate-bar {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        width: 0%;
        height: 100%;
        background: var(--bar-background);
        box-shadow: var(--bar-box-shadow);
        transition: width 0.4s ease-in-out;
        will-change: left, right;
      }
      :host([value="-1"]) #determinate-bar {
        visibility: hidden;
      }

      #primary-indeterminate-bar {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        height: 100%;
        background: var(--bar-background);
        will-change: left, right;
      }

      #secondary-indeterminate-bar {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        height: 100%;
        background: var(--bar-background);
        will-change: left, right;
      }
    </style>

    <div id="determinate-bar"></div>

    <div id="indeterminate-bars">
      <div id="primary-indeterminate-bar"></div>
      <div id="secondary-indeterminate-bar"></div>
    </div>
  </template>
`;

export class XProgressbarElement extends HTMLElement {
  static get observedAttributes() {
    return ["value", "max", "disabled"];
  }

  // @info
  //   Current progress, in procentages.
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
  //   number?
  // @default
  //   null
  // @attribute
  get max() {
    return this.hasAttribute("max") ? parseFloat(this.getAttribute("max")) : 1;
  }
  set max(max) {
    this.setAttribute("max", max);
  }

  // @info
  //   Whether this button is disabled.
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
  }

  connectedCallback() {
    this._update();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "value") {
      this._update();
    }
    else if (name === "disabled") {
      this._update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _update() {
    // Determinate bar
    {
      // Hide
      if (this.value === null || this.value === -1 || this.disabled) {
        this["#determinate-bar"].style.width = "0%";
      }
      // Show
      else {
        this["#determinate-bar"].style.width = ((this.value / this.max) * 100) + "%";
      }
    }

    // Indeterminate bars
    {
      // Hide
      if (this.value !== null || this.disabled) {
        if (this._indeterminateAnimations) {
          for (let animation of this._indeterminateAnimations) {
            animation.cancel();
          }

          this._indeterminateAnimations = null;
        }
      }
      // Show
      else {
        if (!this._indeterminateAnimations) {
          this._indeterminateAnimations = [
            this["#primary-indeterminate-bar"].animate(
              [
                { left: "-35%", right: "100%", offset: 0.0 },
                { left: "100%", right: "-90%", offset: 0.6 },
                { left: "100%", right: "-90%", offset: 1.0 }
              ],
              {
                duration: 2000,
                easing: "ease-in-out",
                iterations: Infinity
              }
            ),
            this["#secondary-indeterminate-bar"].animate(
              [
                { left: "-100%", right: "100%", offset: 0.0 },
                { left:  "110%", right: "-30%", offset: 0.8 },
                { left:  "110%", right: "-30%", offset: 1.0 }
              ],
              {
                duration: 2000,
                delay: 1000,
                easing: "ease-in-out",
                iterations: Infinity
              }
            )
          ];
        }
      }
    }
  }
}

customElements.define("x-progressbar", XProgressbarElement);
