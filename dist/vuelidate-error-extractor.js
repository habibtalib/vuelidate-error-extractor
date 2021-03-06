/*!
 * vuelidate-error-extractor v2.2.2 
 * (c) 2018 Dobromir Hristov
 * Released under the MIT License.
 */
var VuelidateErrorExtractor = (function (exports) {
  'use strict';

  /*!
   * isobject <https://github.com/jonschlinkert/isobject>
   *
   * Copyright (c) 2014-2017, Jon Schlinkert.
   * Released under the MIT License.
   */

  var isobject = function isObject(val) {
    return val != null && typeof val === 'object' && Array.isArray(val) === false;
  };

  /*!
   * get-value <https://github.com/jonschlinkert/get-value>
   *
   * Copyright (c) 2014-2018, Jon Schlinkert.
   * Released under the MIT License.
   */



  var getValue = function(target, path, options) {
    if (!isobject(options)) {
      options = { default: options };
    }

    if (!isValidObject(target)) {
      return typeof options.default !== 'undefined' ? options.default : target;
    }

    if (typeof path === 'number') {
      path = String(path);
    }

    var isArray = Array.isArray(path);
    var isString = typeof path === 'string';
    var splitChar = options.separator || '.';
    var joinChar = options.joinChar || (typeof splitChar === 'string' ? splitChar : '.');

    if (!isString && !isArray) {
      return target;
    }

    if (isString && path in target) {
      return isValid(path, target, options) ? target[path] : options.default;
    }

    var segs = isArray ? path : split(path, splitChar, options);
    var len = segs.length;
    var idx = 0;

    do {
      var prop = segs[idx];
      if (typeof prop === 'number') {
        prop = String(prop);
      }

      while (prop && prop.slice(-1) === '\\') {
        prop = join([prop.slice(0, -1), segs[++idx] || ''], joinChar, options);
      }

      if (prop in target) {
        if (!isValid(prop, target, options)) {
          return options.default;
        }

        target = target[prop];
      } else {
        var hasProp = false;
        var n = idx + 1;

        while (n < len) {
          prop = join([prop, segs[n++]], joinChar, options);

          if ((hasProp = prop in target)) {
            if (!isValid(prop, target, options)) {
              return options.default;
            }

            target = target[prop];
            idx = n - 1;
            break;
          }
        }

        if (!hasProp) {
          return options.default;
        }
      }
    } while (++idx < len && isValidObject(target));

    if (idx === len) {
      return target;
    }

    return options.default;
  };

  function join(segs, joinChar, options) {
    if (typeof options.join === 'function') {
      return options.join(segs);
    }
    return segs[0] + joinChar + segs[1];
  }

  function split(path, splitChar, options) {
    if (typeof options.split === 'function') {
      return options.split(path);
    }
    return path.split(splitChar);
  }

  function isValid(key, target, options) {
    if (typeof options.isValid === 'function') {
      return options.isValid(key, target);
    }
    return true;
  }

  function isValidObject(val) {
    return isobject(val) || Array.isArray(val) || typeof val === 'function';
  }

  function get (obj, path, def) {
    return getValue(obj, path, { default: def })
  }

  function formatErrorMessage (message) {
    return ("[vuelidate-error-extractor]: " + message)
  }

  /**
   * Replace dot notated strings in curly braces for values
   * @param {String} template - Template to search
   * @param {Object} object - Object with data to traverse
   * @return {string}
   */
  function template (template, object) {
    if (typeof template !== 'string') {
      throw new TypeError(formatErrorMessage(("Expected a string in the first argument, got " + (typeof template))))
    }

    if (typeof object !== 'object') {
      throw new TypeError(formatErrorMessage(("Expected an Object/Array in the second argument, got " + (typeof object))))
    }
    var regx = /{(.*?)}/g;

    return template.replace(regx, function (_, key) { return get(object, key) || ''; })
  }

  /**
   * Return the proper validation object
   * @param {String} validationKey - Key by which we will get the translation
   * @param {String} key - Key to get the error status from
   * @param {Object} params - All the extra params that will be merged with the Given validatorParams prop.
   * @return {Object}
   */
  function getValidationObject (validationKey, key, params) {
    if ( params === void 0 ) params = {};

    return {
      validationKey: validationKey,
      hasError: !this.preferredValidator[key],
      $params: this.preferredValidator.$params[key],
      $dirty: this.preferredValidator.$dirty,
      $error: this.preferredValidator.$error,
      $invalid: this.preferredValidator.$invalid,
      // Add the label for the :attribute parameter that is used in most Laravel validations
      params: Object.assign({}, {
        attribute: this.resolvedAttribute,
        label: this.label
      }, params, this.validatorParams)
    }
  }

  function getAttribute (attributes, attribute, label, name) {
    if ( name === void 0 ) name = '';

    if (attribute) { return attribute }
    if (!name) { return label }
    // strip out the $each
    var normalizedName = name.replace(/\$each\.\d\./g, '');
    return attributes[normalizedName] || normalizedName
  }

  function flattenValidatorObjects (validator, propName) {
    return Object.entries(validator)
      .filter(function (ref) {
        var key = ref[0];
        var value = ref[1];

        return !key.startsWith('$') || key === '$each';
    })
      .reduce(function (errors, ref) {
        var key = ref[0];
        var value = ref[1];

        // its probably a deeply nested object
        if (typeof value === 'object') {
          var nestedValidatorName =
            (key === '$each' || !isNaN(parseInt(key))) ? propName
              : propName ? (propName + "." + key)
              : key;
          return errors.concat(flattenValidatorObjects(value, nestedValidatorName))
        } // else its the validated prop
        var params = Object.assign({}, validator.$params[key]);
        delete params.type;
        errors.push({
          propName: propName,
          validationKey: key,
          hasError: !value,
          params: params,
          $dirty: validator.$dirty,
          $error: validator.$error,
          $invalid: validator.$invalid
        });
        return errors
      }, [])
  }

  function getErrorString (messages, key, params) {
    var msg = get(messages, key, false);
    if (!msg) {
      return key
    }
    return template(msg, params)
  }

  var baseErrorsMixin = {
    inject: {
      formValidator: { default: false },
      formMessages: { default: function () { return ({}); } }
    },
    props: {
      validator: {
        type: Object,
        default: function () { return ({
          $dirty: false,
          $error: false,
          $invalid: true,
          $pending: false,
          $params: []
        }); }
      },
      messages: {
        type: Object,
        default: function () { return ({}); }
      }
    },
    computed: {
      /**
       * Filters out only the active errors
       * @return {Array}
       */
      activeErrors: function activeErrors () {
        return this.errors.filter(function (error) { return error.hasError && error.$dirty; })
      },
      mergedMessages: function mergedMessages () {
        return Object.assign({}, this.$vuelidateErrorExtractor.messages, this.formMessages, this.messages)
      },
      firstError: function firstError () {
        return this.activeErrors.length ? this.activeErrors[0] : ''
      },
      firstErrorMessage: function firstErrorMessage () {
        return this.activeErrors.length ? this.activeErrorMessages[0] : ''
      },
      hasErrors: function hasErrors () {
        return this.preferredValidator.$error
      },
      activeErrorMessages: function activeErrorMessages () {
        var this$1 = this;

        return this.activeErrors.map(function (error) { return this$1.getErrorMessage(error.validationKey, error.params); })
      }
    },
    methods: {
      getErrorMessage: function getErrorMessage (key, params) {
        return this.$vuelidateErrorExtractor.i18n ? this.getI18nMessage(key, params) : this.getPlainMessage(key, params)
      },
      getI18nMessage: function getI18nMessage (key, params) {
        return this.$t(this.$vuelidateErrorExtractor.i18n + '.' + key, params)
      },
      getPlainMessage: function getPlainMessage (key, params) {
        return getErrorString(this.mergedMessages, key, params)
      }
    }
  };

  var singleErrorExtractorMixin = {
    props: {
      label: { type: String, default: '' },
      attribute: { type: String, default: '' },
      name: { type: String, default: '' },
      /**
       * Params that are passed for the validation.
       * Example: {other: $t('auth.password')} when using a sameAs validation and we need a translated "other" field.
       */
      validatorParams: {
        type: Object,
        default: function () { return ({}); }
      },
      showSingleError: {
        type: Boolean,
        default: false
      }
    },
    extends: baseErrorsMixin,
    computed: {
      preferredValidator: function preferredValidator () {
        // if validator is passed is present on propsData, user has explicitly provided it.
        if (this.$options.propsData.hasOwnProperty('validator')) { return this.validator }
        return this.name ? get(this.formValidator, this.name, this.validator) : this.validator
      },
      errors: function errors () {
        var this$1 = this;

        var vualidateParams = this.preferredValidator.$params;
        var remappedValidation = this.$vuelidateErrorExtractor.validationKeys;
        // Map all the params in the validator object. They correspond to every validation rule.
        return Object.keys(vualidateParams).map(function (key) {
          var vuelidateValidatorObject = vualidateParams[key];
          // Check of we have defined our validation remap in the settings
          if (typeof remappedValidation !== 'undefined' && remappedValidation.hasOwnProperty(key)) {
            var params$1 = remappedValidation[key].params.reduce(function (all, paramKey) {
              // Use the extra supplied data via validator-params prop or use the one from vuelidate
              all[paramKey.ext] = this$1.validatorParams.hasOwnProperty(paramKey.other) ? this$1.validatorParams[paramKey.other] : vuelidateValidatorObject[paramKey.vue];
              return all
            }, {});
            return getValidationObject.call(this$1, remappedValidation[key].validationKey, key, params$1)
          }
          var params = Object.assign({}, vuelidateValidatorObject, this$1.validatorParams);
          delete params.type;
          // We are using the Vuelidate keys
          return getValidationObject.call(this$1, key, key, params)
        })
      },
      events: function events () {
        var this$1 = this;

        return { input: function () { return this$1.preferredValidator.$touch(); } }
      },
      isValid: function isValid () {
        return this.preferredValidator.$dirty ? !this.hasErrors : null
      },
      resolvedAttribute: function resolvedAttribute () {
        return getAttribute(this.$vuelidateErrorExtractor.attributes, this.attribute, this.label, this.name)
      }
    }
  };

  //

  var script = {
    mixins: [singleErrorExtractorMixin],
    computed: {
      attributes: function attributes () {
        return {
          class: { 'is-invalid-input': this.hasErrors }
        }
      }
    }
  };

  /* script */
              var __vue_script__ = script;
              
  /* template */
  var __vue_render__ = function() {
    var _vm = this;
    var _h = _vm.$createElement;
    var _c = _vm._self._c || _h;
    return _c(
      "div",
      { staticClass: "form-group", class: { error: _vm.hasErrors } },
      [
        _vm._t("label", [
          _vm.label
            ? _c("label", { class: { "is-invalid-label": _vm.hasErrors } }, [
                _vm._v(_vm._s(_vm.label) + " " + _vm._s(_vm.errors ? "*" : ""))
              ])
            : _vm._e()
        ]),
        _vm._v(" "),
        _vm._t("default", null, {
          attributes: _vm.attributes,
          errorMessages: _vm.activeErrorMessages,
          errors: _vm.activeErrors,
          events: _vm.events,
          firstErrorMessage: _vm.firstErrorMessage,
          hasErrors: _vm.hasErrors,
          validator: _vm.preferredValidator
        }),
        _vm._v(" "),
        _vm._t(
          "errors",
          [
            _vm.hasErrors
              ? _c(
                  "div",
                  { staticClass: "form-error is-visible" },
                  [
                    _vm.showSingleError
                      ? _c(
                          "span",
                          {
                            attrs: {
                              "data-validation-attr": _vm.firstError.validationKey
                            }
                          },
                          [
                            _vm._v(
                              "\n        " +
                                _vm._s(_vm.firstErrorMessage) +
                                "\n      "
                            )
                          ]
                        )
                      : _vm._l(_vm.activeErrorMessages, function(error, index) {
                          return _c(
                            "span",
                            {
                              key: _vm.activeErrors[index].validationKey,
                              attrs: {
                                "data-validation-attr":
                                  _vm.activeErrors[index].validationKey
                              }
                            },
                            [
                              _vm._v(
                                "\n          " + _vm._s(error) + "\n        "
                              )
                            ]
                          )
                        })
                  ],
                  2
                )
              : _vm._e()
          ],
          {
            errors: _vm.activeErrors,
            errorMessages: _vm.activeErrorMessages,
            hasErrors: _vm.hasErrors,
            firstErrorMessage: _vm.firstErrorMessage
          }
        )
      ],
      2
    )
  };
  var __vue_staticRenderFns__ = [];
  __vue_render__._withStripped = true;

    /* style */
    var __vue_inject_styles__ = undefined;
    /* scoped */
    var __vue_scope_id__ = undefined;
    /* module identifier */
    var __vue_module_identifier__ = undefined;
    /* functional template */
    var __vue_is_functional_template__ = false;
    /* component normalizer */
    function __vue_normalize__(
      template, style, script$$1,
      scope, functional, moduleIdentifier,
      createInjector, createInjectorSSR
    ) {
      var component = (typeof script$$1 === 'function' ? script$$1.options : script$$1) || {};

      {
        component.__file = "D:\\web\\public-projects\\vuelidate-error-extractor\\src\\templates\\single-error-extractor\\foundation6.vue";
      }

      if (!component.render) {
        component.render = template.render;
        component.staticRenderFns = template.staticRenderFns;
        component._compiled = true;

        if (functional) { component.functional = true; }
      }

      component._scopeId = scope;

      return component
    }
    /* style inject */
    function __vue_create_injector__() {
      var head = document.head || document.getElementsByTagName('head')[0];
      var styles = __vue_create_injector__.styles || (__vue_create_injector__.styles = {});
      var isOldIE =
        typeof navigator !== 'undefined' &&
        /msie [6-9]\\b/.test(navigator.userAgent.toLowerCase());

      return function addStyle(id, css) {
        if (document.querySelector('style[data-vue-ssr-id~="' + id + '"]')) { return } // SSR styles are present.

        var group = isOldIE ? css.media || 'default' : id;
        var style = styles[group] || (styles[group] = { ids: [], parts: [], element: undefined });

        if (!style.ids.includes(id)) {
          var code = css.source;
          var index = style.ids.length;

          style.ids.push(id);

          if (isOldIE) {
            style.element = style.element || document.querySelector('style[data-group=' + group + ']');
          }

          if (!style.element) {
            var el = style.element = document.createElement('style');
            el.type = 'text/css';

            if (css.media) { el.setAttribute('media', css.media); }
            if (isOldIE) {
              el.setAttribute('data-group', group);
              el.setAttribute('data-next-index', '0');
            }

            head.appendChild(el);
          }

          if (isOldIE) {
            index = parseInt(style.element.getAttribute('data-next-index'));
            style.element.setAttribute('data-next-index', index + 1);
          }

          if (style.element.styleSheet) {
            style.parts.push(code);
            style.element.styleSheet.cssText = style.parts
              .filter(Boolean)
              .join('\n');
          } else {
            var textNode = document.createTextNode(code);
            var nodes = style.element.childNodes;
            if (nodes[index]) { style.element.removeChild(nodes[index]); }
            if (nodes.length) { style.element.insertBefore(textNode, nodes[index]); }
            else { style.element.appendChild(textNode); }
          }
        }
      }
    }
    /* style inject SSR */
    

    
    var foundation6 = __vue_normalize__(
      { render: __vue_render__, staticRenderFns: __vue_staticRenderFns__ },
      __vue_inject_styles__,
      __vue_script__,
      __vue_scope_id__,
      __vue_is_functional_template__,
      __vue_module_identifier__,
      __vue_create_injector__,
      undefined
    );

  //

  var script$1 = {
    mixins: [singleErrorExtractorMixin],
    computed: {
      attributes: function attributes () {
        return {
          class: { 'form-control': true },
          name: this.name || undefined
        }
      }
    }
  };

  /* script */
              var __vue_script__$1 = script$1;
              
  /* template */
  var __vue_render__$1 = function() {
    var _vm = this;
    var _h = _vm.$createElement;
    var _c = _vm._self._c || _h;
    return _c(
      "div",
      {
        staticClass: "form-group",
        class: { "has-error": _vm.hasErrors, "has-success": _vm.isValid }
      },
      [
        _vm._t("label", [
          _vm.label
            ? _c("label", { staticClass: "control-label" }, [
                _vm._v(
                  "\n      " +
                    _vm._s(_vm.label) +
                    " " +
                    _vm._s(_vm.errors ? "*" : "") +
                    "\n    "
                )
              ])
            : _vm._e()
        ]),
        _vm._v(" "),
        _vm._t("default", null, {
          attributes: _vm.attributes,
          errors: _vm.activeErrors,
          events: _vm.events,
          firstErrorMessage: _vm.firstErrorMessage,
          hasErrors: _vm.hasErrors,
          validator: _vm.preferredValidator
        }),
        _vm._v(" "),
        _vm._t(
          "errors",
          [
            _vm.hasErrors
              ? _c(
                  "div",
                  { staticClass: "help-block" },
                  [
                    _vm.showSingleError
                      ? _c(
                          "span",
                          {
                            attrs: {
                              "data-validation-attr": _vm.firstError.validationKey
                            }
                          },
                          [
                            _vm._v(
                              "\n        " +
                                _vm._s(_vm.firstErrorMessage) +
                                "\n      "
                            )
                          ]
                        )
                      : _vm._e(),
                    _vm._v(" "),
                    !_vm.showSingleError
                      ? _vm._l(_vm.activeErrors, function(error) {
                          return _c(
                            "span",
                            {
                              key: error.validationKey,
                              attrs: {
                                "data-validation-attr": error.validationKey
                              }
                            },
                            [
                              _vm._v(
                                "\n          " +
                                  _vm._s(
                                    _vm.getErrorMessage(
                                      error.validationKey,
                                      error.params
                                    )
                                  ) +
                                  "\n        "
                              )
                            ]
                          )
                        })
                      : _vm._e()
                  ],
                  2
                )
              : _vm._e()
          ],
          {
            errors: _vm.activeErrors,
            errorMessages: _vm.activeErrorMessages,
            hasErrors: _vm.hasErrors,
            firstErrorMessage: _vm.firstErrorMessage
          }
        )
      ],
      2
    )
  };
  var __vue_staticRenderFns__$1 = [];
  __vue_render__$1._withStripped = true;

    /* style */
    var __vue_inject_styles__$1 = undefined;
    /* scoped */
    var __vue_scope_id__$1 = undefined;
    /* module identifier */
    var __vue_module_identifier__$1 = undefined;
    /* functional template */
    var __vue_is_functional_template__$1 = false;
    /* component normalizer */
    function __vue_normalize__$1(
      template, style, script,
      scope, functional, moduleIdentifier,
      createInjector, createInjectorSSR
    ) {
      var component = (typeof script === 'function' ? script.options : script) || {};

      {
        component.__file = "D:\\web\\public-projects\\vuelidate-error-extractor\\src\\templates\\single-error-extractor\\bootstrap3.vue";
      }

      if (!component.render) {
        component.render = template.render;
        component.staticRenderFns = template.staticRenderFns;
        component._compiled = true;

        if (functional) { component.functional = true; }
      }

      component._scopeId = scope;

      return component
    }
    /* style inject */
    function __vue_create_injector__$1() {
      var head = document.head || document.getElementsByTagName('head')[0];
      var styles = __vue_create_injector__$1.styles || (__vue_create_injector__$1.styles = {});
      var isOldIE =
        typeof navigator !== 'undefined' &&
        /msie [6-9]\\b/.test(navigator.userAgent.toLowerCase());

      return function addStyle(id, css) {
        if (document.querySelector('style[data-vue-ssr-id~="' + id + '"]')) { return } // SSR styles are present.

        var group = isOldIE ? css.media || 'default' : id;
        var style = styles[group] || (styles[group] = { ids: [], parts: [], element: undefined });

        if (!style.ids.includes(id)) {
          var code = css.source;
          var index = style.ids.length;

          style.ids.push(id);

          if (isOldIE) {
            style.element = style.element || document.querySelector('style[data-group=' + group + ']');
          }

          if (!style.element) {
            var el = style.element = document.createElement('style');
            el.type = 'text/css';

            if (css.media) { el.setAttribute('media', css.media); }
            if (isOldIE) {
              el.setAttribute('data-group', group);
              el.setAttribute('data-next-index', '0');
            }

            head.appendChild(el);
          }

          if (isOldIE) {
            index = parseInt(style.element.getAttribute('data-next-index'));
            style.element.setAttribute('data-next-index', index + 1);
          }

          if (style.element.styleSheet) {
            style.parts.push(code);
            style.element.styleSheet.cssText = style.parts
              .filter(Boolean)
              .join('\n');
          } else {
            var textNode = document.createTextNode(code);
            var nodes = style.element.childNodes;
            if (nodes[index]) { style.element.removeChild(nodes[index]); }
            if (nodes.length) { style.element.insertBefore(textNode, nodes[index]); }
            else { style.element.appendChild(textNode); }
          }
        }
      }
    }
    /* style inject SSR */
    

    
    var bootstrap3 = __vue_normalize__$1(
      { render: __vue_render__$1, staticRenderFns: __vue_staticRenderFns__$1 },
      __vue_inject_styles__$1,
      __vue_script__$1,
      __vue_scope_id__$1,
      __vue_is_functional_template__$1,
      __vue_module_identifier__$1,
      __vue_create_injector__$1,
      undefined
    );

  //

  var script$2 = {
    name: 'Bootstrap4',
    mixins: [singleErrorExtractorMixin],
    computed: {
      attributes: function attributes () {
        return {
          class: { 'form-control': true, 'is-invalid': this.hasErrors, 'is-valid': this.isValid },
          name: this.name || undefined
        }
      }
    }
  };

  /* script */
              var __vue_script__$2 = script$2;
              
  /* template */
  var __vue_render__$2 = function() {
    var _vm = this;
    var _h = _vm.$createElement;
    var _c = _vm._self._c || _h;
    return _c(
      "div",
      [
        _vm._t("label", [_c("label", [_vm._v(_vm._s(_vm.label))])]),
        _vm._v(" "),
        _vm._t("default", null, {
          attributes: _vm.attributes,
          errors: _vm.activeErrors,
          events: _vm.events,
          firstErrorMessage: _vm.firstErrorMessage,
          hasErrors: _vm.hasErrors,
          validator: _vm.preferredValidator
        }),
        _vm._v(" "),
        _vm._t(
          "errors",
          [
            _vm.hasErrors
              ? _c(
                  "div",
                  {
                    class: {
                      "invalid-feedback": _vm.hasErrors,
                      "valid-feedback": !_vm.hasErrors
                    }
                  },
                  [
                    _vm.showSingleError
                      ? [_vm._v(_vm._s(_vm.firstErrorMessage))]
                      : _vm._l(_vm.activeErrorMessages, function(errorMessage) {
                          return _c("div", { key: errorMessage }, [
                            _vm._v(
                              "\n          " + _vm._s(errorMessage) + "\n        "
                            )
                          ])
                        })
                  ],
                  2
                )
              : _vm._e()
          ],
          {
            errors: _vm.activeErrors,
            errorMessages: _vm.activeErrorMessages,
            hasErrors: _vm.hasErrors,
            firstErrorMessage: _vm.firstErrorMessage
          }
        )
      ],
      2
    )
  };
  var __vue_staticRenderFns__$2 = [];
  __vue_render__$2._withStripped = true;

    /* style */
    var __vue_inject_styles__$2 = undefined;
    /* scoped */
    var __vue_scope_id__$2 = undefined;
    /* module identifier */
    var __vue_module_identifier__$2 = undefined;
    /* functional template */
    var __vue_is_functional_template__$2 = false;
    /* component normalizer */
    function __vue_normalize__$2(
      template, style, script,
      scope, functional, moduleIdentifier,
      createInjector, createInjectorSSR
    ) {
      var component = (typeof script === 'function' ? script.options : script) || {};

      {
        component.__file = "D:\\web\\public-projects\\vuelidate-error-extractor\\src\\templates\\single-error-extractor\\bootstrap4.vue";
      }

      if (!component.render) {
        component.render = template.render;
        component.staticRenderFns = template.staticRenderFns;
        component._compiled = true;

        if (functional) { component.functional = true; }
      }

      component._scopeId = scope;

      return component
    }
    /* style inject */
    function __vue_create_injector__$2() {
      var head = document.head || document.getElementsByTagName('head')[0];
      var styles = __vue_create_injector__$2.styles || (__vue_create_injector__$2.styles = {});
      var isOldIE =
        typeof navigator !== 'undefined' &&
        /msie [6-9]\\b/.test(navigator.userAgent.toLowerCase());

      return function addStyle(id, css) {
        if (document.querySelector('style[data-vue-ssr-id~="' + id + '"]')) { return } // SSR styles are present.

        var group = isOldIE ? css.media || 'default' : id;
        var style = styles[group] || (styles[group] = { ids: [], parts: [], element: undefined });

        if (!style.ids.includes(id)) {
          var code = css.source;
          var index = style.ids.length;

          style.ids.push(id);

          if (isOldIE) {
            style.element = style.element || document.querySelector('style[data-group=' + group + ']');
          }

          if (!style.element) {
            var el = style.element = document.createElement('style');
            el.type = 'text/css';

            if (css.media) { el.setAttribute('media', css.media); }
            if (isOldIE) {
              el.setAttribute('data-group', group);
              el.setAttribute('data-next-index', '0');
            }

            head.appendChild(el);
          }

          if (isOldIE) {
            index = parseInt(style.element.getAttribute('data-next-index'));
            style.element.setAttribute('data-next-index', index + 1);
          }

          if (style.element.styleSheet) {
            style.parts.push(code);
            style.element.styleSheet.cssText = style.parts
              .filter(Boolean)
              .join('\n');
          } else {
            var textNode = document.createTextNode(code);
            var nodes = style.element.childNodes;
            if (nodes[index]) { style.element.removeChild(nodes[index]); }
            if (nodes.length) { style.element.insertBefore(textNode, nodes[index]); }
            else { style.element.appendChild(textNode); }
          }
        }
      }
    }
    /* style inject SSR */
    

    
    var bootstrap4 = __vue_normalize__$2(
      { render: __vue_render__$2, staticRenderFns: __vue_staticRenderFns__$2 },
      __vue_inject_styles__$2,
      __vue_script__$2,
      __vue_scope_id__$2,
      __vue_is_functional_template__$2,
      __vue_module_identifier__$2,
      __vue_create_injector__$2,
      undefined
    );

  var singleErrorExtractor = {
    foundation6: foundation6,
    bootstrap3: bootstrap3,
    bootstrap4: bootstrap4
  };

  var multiErrorExtractorMixin = {
    props: {
      attributes: {
        type: Object,
        default: function () { return ({}); }
      }
    },
    extends: baseErrorsMixin,
    computed: {
      preferredValidator: function preferredValidator () {
        // if validator is passed is present on propsData, user has explicitly provided it.
        if (this.$options.propsData.hasOwnProperty('validator')) { return this.validator }
        return this.formValidator
      },
      mergedAttributes: function mergedAttributes () {
        return Object.assign({}, this.$vuelidateErrorExtractor.attributes, this.attributes)
      },
      errors: function errors () {
        var this$1 = this;

        return flattenValidatorObjects(this.preferredValidator).map(function (error) {
          var params = Object.assign({}, error.params, {
            attribute: get(this$1.mergedAttributes, error.propName, error.propName)
          });
          return Object.assign({}, error, { params: params })
        })
      },
      /**
       * Returns if the form has any errors
       * @return {boolean}
       */
      hasErrors: function hasErrors () {
        return !!this.activeErrors.length
      }
    }
  };

  //

  var script$3 = {
    name: 'baseMultiErrorExtractor',
    extends: multiErrorExtractorMixin
  };

  /* script */
              var __vue_script__$3 = script$3;
              
  /* template */
  var __vue_render__$3 = function() {
    var _vm = this;
    var _h = _vm.$createElement;
    var _c = _vm._self._c || _h;
    return _c(
      "div",
      _vm._l(_vm.activeErrorMessages, function(error, index) {
        return _c(
          "div",
          { key: index },
          [
            _vm._t("default", [_c("div", [_vm._v(_vm._s(error))])], {
              errorMessage: error,
              error: _vm.activeErrors[index]
            })
          ],
          2
        )
      })
    )
  };
  var __vue_staticRenderFns__$3 = [];
  __vue_render__$3._withStripped = true;

    /* style */
    var __vue_inject_styles__$3 = undefined;
    /* scoped */
    var __vue_scope_id__$3 = undefined;
    /* module identifier */
    var __vue_module_identifier__$3 = undefined;
    /* functional template */
    var __vue_is_functional_template__$3 = false;
    /* component normalizer */
    function __vue_normalize__$3(
      template, style, script,
      scope, functional, moduleIdentifier,
      createInjector, createInjectorSSR
    ) {
      var component = (typeof script === 'function' ? script.options : script) || {};

      {
        component.__file = "D:\\web\\public-projects\\vuelidate-error-extractor\\src\\templates\\multi-error-extractor\\baseMultiErrorExtractor.vue";
      }

      if (!component.render) {
        component.render = template.render;
        component.staticRenderFns = template.staticRenderFns;
        component._compiled = true;

        if (functional) { component.functional = true; }
      }

      component._scopeId = scope;

      return component
    }
    /* style inject */
    function __vue_create_injector__$3() {
      var head = document.head || document.getElementsByTagName('head')[0];
      var styles = __vue_create_injector__$3.styles || (__vue_create_injector__$3.styles = {});
      var isOldIE =
        typeof navigator !== 'undefined' &&
        /msie [6-9]\\b/.test(navigator.userAgent.toLowerCase());

      return function addStyle(id, css) {
        if (document.querySelector('style[data-vue-ssr-id~="' + id + '"]')) { return } // SSR styles are present.

        var group = isOldIE ? css.media || 'default' : id;
        var style = styles[group] || (styles[group] = { ids: [], parts: [], element: undefined });

        if (!style.ids.includes(id)) {
          var code = css.source;
          var index = style.ids.length;

          style.ids.push(id);

          if (isOldIE) {
            style.element = style.element || document.querySelector('style[data-group=' + group + ']');
          }

          if (!style.element) {
            var el = style.element = document.createElement('style');
            el.type = 'text/css';

            if (css.media) { el.setAttribute('media', css.media); }
            if (isOldIE) {
              el.setAttribute('data-group', group);
              el.setAttribute('data-next-index', '0');
            }

            head.appendChild(el);
          }

          if (isOldIE) {
            index = parseInt(style.element.getAttribute('data-next-index'));
            style.element.setAttribute('data-next-index', index + 1);
          }

          if (style.element.styleSheet) {
            style.parts.push(code);
            style.element.styleSheet.cssText = style.parts
              .filter(Boolean)
              .join('\n');
          } else {
            var textNode = document.createTextNode(code);
            var nodes = style.element.childNodes;
            if (nodes[index]) { style.element.removeChild(nodes[index]); }
            if (nodes.length) { style.element.insertBefore(textNode, nodes[index]); }
            else { style.element.appendChild(textNode); }
          }
        }
      }
    }
    /* style inject SSR */
    

    
    var baseMultiErrorExtractor = __vue_normalize__$3(
      { render: __vue_render__$3, staticRenderFns: __vue_staticRenderFns__$3 },
      __vue_inject_styles__$3,
      __vue_script__$3,
      __vue_scope_id__$3,
      __vue_is_functional_template__$3,
      __vue_module_identifier__$3,
      __vue_create_injector__$3,
      undefined
    );

  //

  var script$4 = {
    inheritAttrs: false,
    components: {
      baseMultiErrorExtractor: baseMultiErrorExtractor
    }
  };

  /* script */
              var __vue_script__$4 = script$4;
              
  /* template */
  var __vue_render__$4 = function() {
    var _vm = this;
    var _h = _vm.$createElement;
    var _c = _vm._self._c || _h;
    return _c(
      "base-multi-error-extractor",
      _vm._b(
        {
          staticClass: "has-error",
          scopedSlots: _vm._u([
            {
              key: "default",
              fn: function(ref) {
                var errorMessage = ref.errorMessage;
                return [
                  _c("label", { staticClass: "help-block" }, [
                    _vm._v(_vm._s(errorMessage))
                  ])
                ]
              }
            }
          ])
        },
        "base-multi-error-extractor",
        _vm.$attrs,
        false
      )
    )
  };
  var __vue_staticRenderFns__$4 = [];
  __vue_render__$4._withStripped = true;

    /* style */
    var __vue_inject_styles__$4 = undefined;
    /* scoped */
    var __vue_scope_id__$4 = undefined;
    /* module identifier */
    var __vue_module_identifier__$4 = undefined;
    /* functional template */
    var __vue_is_functional_template__$4 = false;
    /* component normalizer */
    function __vue_normalize__$4(
      template, style, script,
      scope, functional, moduleIdentifier,
      createInjector, createInjectorSSR
    ) {
      var component = (typeof script === 'function' ? script.options : script) || {};

      {
        component.__file = "D:\\web\\public-projects\\vuelidate-error-extractor\\src\\templates\\multi-error-extractor\\bootstrap3.vue";
      }

      if (!component.render) {
        component.render = template.render;
        component.staticRenderFns = template.staticRenderFns;
        component._compiled = true;

        if (functional) { component.functional = true; }
      }

      component._scopeId = scope;

      return component
    }
    /* style inject */
    function __vue_create_injector__$4() {
      var head = document.head || document.getElementsByTagName('head')[0];
      var styles = __vue_create_injector__$4.styles || (__vue_create_injector__$4.styles = {});
      var isOldIE =
        typeof navigator !== 'undefined' &&
        /msie [6-9]\\b/.test(navigator.userAgent.toLowerCase());

      return function addStyle(id, css) {
        if (document.querySelector('style[data-vue-ssr-id~="' + id + '"]')) { return } // SSR styles are present.

        var group = isOldIE ? css.media || 'default' : id;
        var style = styles[group] || (styles[group] = { ids: [], parts: [], element: undefined });

        if (!style.ids.includes(id)) {
          var code = css.source;
          var index = style.ids.length;

          style.ids.push(id);

          if (isOldIE) {
            style.element = style.element || document.querySelector('style[data-group=' + group + ']');
          }

          if (!style.element) {
            var el = style.element = document.createElement('style');
            el.type = 'text/css';

            if (css.media) { el.setAttribute('media', css.media); }
            if (isOldIE) {
              el.setAttribute('data-group', group);
              el.setAttribute('data-next-index', '0');
            }

            head.appendChild(el);
          }

          if (isOldIE) {
            index = parseInt(style.element.getAttribute('data-next-index'));
            style.element.setAttribute('data-next-index', index + 1);
          }

          if (style.element.styleSheet) {
            style.parts.push(code);
            style.element.styleSheet.cssText = style.parts
              .filter(Boolean)
              .join('\n');
          } else {
            var textNode = document.createTextNode(code);
            var nodes = style.element.childNodes;
            if (nodes[index]) { style.element.removeChild(nodes[index]); }
            if (nodes.length) { style.element.insertBefore(textNode, nodes[index]); }
            else { style.element.appendChild(textNode); }
          }
        }
      }
    }
    /* style inject SSR */
    

    
    var bootstrap3$1 = __vue_normalize__$4(
      { render: __vue_render__$4, staticRenderFns: __vue_staticRenderFns__$4 },
      __vue_inject_styles__$4,
      __vue_script__$4,
      __vue_scope_id__$4,
      __vue_is_functional_template__$4,
      __vue_module_identifier__$4,
      __vue_create_injector__$4,
      undefined
    );

  //

  var script$5 = {
    inheritAttrs: false,
    components: {
      baseMultiErrorExtractor: baseMultiErrorExtractor
    }
  };

  /* script */
              var __vue_script__$5 = script$5;
              
  /* template */
  var __vue_render__$5 = function() {
    var _vm = this;
    var _h = _vm.$createElement;
    var _c = _vm._self._c || _h;
    return _c(
      "base-multi-error-extractor",
      _vm._b(
        {
          staticClass: "was-validated",
          scopedSlots: _vm._u([
            {
              key: "default",
              fn: function(ref) {
                var errorMessage = ref.errorMessage;
                return [
                  _c("label", { staticClass: "invalid-feedback d-block" }, [
                    _vm._v(_vm._s(errorMessage))
                  ])
                ]
              }
            }
          ])
        },
        "base-multi-error-extractor",
        _vm.$attrs,
        false
      )
    )
  };
  var __vue_staticRenderFns__$5 = [];
  __vue_render__$5._withStripped = true;

    /* style */
    var __vue_inject_styles__$5 = undefined;
    /* scoped */
    var __vue_scope_id__$5 = undefined;
    /* module identifier */
    var __vue_module_identifier__$5 = undefined;
    /* functional template */
    var __vue_is_functional_template__$5 = false;
    /* component normalizer */
    function __vue_normalize__$5(
      template, style, script,
      scope, functional, moduleIdentifier,
      createInjector, createInjectorSSR
    ) {
      var component = (typeof script === 'function' ? script.options : script) || {};

      {
        component.__file = "D:\\web\\public-projects\\vuelidate-error-extractor\\src\\templates\\multi-error-extractor\\bootstrap4.vue";
      }

      if (!component.render) {
        component.render = template.render;
        component.staticRenderFns = template.staticRenderFns;
        component._compiled = true;

        if (functional) { component.functional = true; }
      }

      component._scopeId = scope;

      return component
    }
    /* style inject */
    function __vue_create_injector__$5() {
      var head = document.head || document.getElementsByTagName('head')[0];
      var styles = __vue_create_injector__$5.styles || (__vue_create_injector__$5.styles = {});
      var isOldIE =
        typeof navigator !== 'undefined' &&
        /msie [6-9]\\b/.test(navigator.userAgent.toLowerCase());

      return function addStyle(id, css) {
        if (document.querySelector('style[data-vue-ssr-id~="' + id + '"]')) { return } // SSR styles are present.

        var group = isOldIE ? css.media || 'default' : id;
        var style = styles[group] || (styles[group] = { ids: [], parts: [], element: undefined });

        if (!style.ids.includes(id)) {
          var code = css.source;
          var index = style.ids.length;

          style.ids.push(id);

          if (isOldIE) {
            style.element = style.element || document.querySelector('style[data-group=' + group + ']');
          }

          if (!style.element) {
            var el = style.element = document.createElement('style');
            el.type = 'text/css';

            if (css.media) { el.setAttribute('media', css.media); }
            if (isOldIE) {
              el.setAttribute('data-group', group);
              el.setAttribute('data-next-index', '0');
            }

            head.appendChild(el);
          }

          if (isOldIE) {
            index = parseInt(style.element.getAttribute('data-next-index'));
            style.element.setAttribute('data-next-index', index + 1);
          }

          if (style.element.styleSheet) {
            style.parts.push(code);
            style.element.styleSheet.cssText = style.parts
              .filter(Boolean)
              .join('\n');
          } else {
            var textNode = document.createTextNode(code);
            var nodes = style.element.childNodes;
            if (nodes[index]) { style.element.removeChild(nodes[index]); }
            if (nodes.length) { style.element.insertBefore(textNode, nodes[index]); }
            else { style.element.appendChild(textNode); }
          }
        }
      }
    }
    /* style inject SSR */
    

    
    var bootstrap4$1 = __vue_normalize__$5(
      { render: __vue_render__$5, staticRenderFns: __vue_staticRenderFns__$5 },
      __vue_inject_styles__$5,
      __vue_script__$5,
      __vue_scope_id__$5,
      __vue_is_functional_template__$5,
      __vue_module_identifier__$5,
      __vue_create_injector__$5,
      undefined
    );

  //

  var script$6 = {
    inheritAttrs: false,
    components: {
      baseMultiErrorExtractor: baseMultiErrorExtractor
    }
  };

  /* script */
              var __vue_script__$6 = script$6;
              
  /* template */
  var __vue_render__$6 = function() {
    var _vm = this;
    var _h = _vm.$createElement;
    var _c = _vm._self._c || _h;
    return _c(
      "base-multi-error-extractor",
      _vm._b(
        {
          staticStyle: { "margin-top": "1rem" },
          scopedSlots: _vm._u([
            {
              key: "default",
              fn: function(ref) {
                var errorMessage = ref.errorMessage;
                return [
                  _c("label", { staticClass: "form-error is-visible" }, [
                    _vm._v(_vm._s(errorMessage))
                  ])
                ]
              }
            }
          ])
        },
        "base-multi-error-extractor",
        _vm.$attrs,
        false
      )
    )
  };
  var __vue_staticRenderFns__$6 = [];
  __vue_render__$6._withStripped = true;

    /* style */
    var __vue_inject_styles__$6 = undefined;
    /* scoped */
    var __vue_scope_id__$6 = undefined;
    /* module identifier */
    var __vue_module_identifier__$6 = undefined;
    /* functional template */
    var __vue_is_functional_template__$6 = false;
    /* component normalizer */
    function __vue_normalize__$6(
      template, style, script,
      scope, functional, moduleIdentifier,
      createInjector, createInjectorSSR
    ) {
      var component = (typeof script === 'function' ? script.options : script) || {};

      {
        component.__file = "D:\\web\\public-projects\\vuelidate-error-extractor\\src\\templates\\multi-error-extractor\\foundation6.vue";
      }

      if (!component.render) {
        component.render = template.render;
        component.staticRenderFns = template.staticRenderFns;
        component._compiled = true;

        if (functional) { component.functional = true; }
      }

      component._scopeId = scope;

      return component
    }
    /* style inject */
    function __vue_create_injector__$6() {
      var head = document.head || document.getElementsByTagName('head')[0];
      var styles = __vue_create_injector__$6.styles || (__vue_create_injector__$6.styles = {});
      var isOldIE =
        typeof navigator !== 'undefined' &&
        /msie [6-9]\\b/.test(navigator.userAgent.toLowerCase());

      return function addStyle(id, css) {
        if (document.querySelector('style[data-vue-ssr-id~="' + id + '"]')) { return } // SSR styles are present.

        var group = isOldIE ? css.media || 'default' : id;
        var style = styles[group] || (styles[group] = { ids: [], parts: [], element: undefined });

        if (!style.ids.includes(id)) {
          var code = css.source;
          var index = style.ids.length;

          style.ids.push(id);

          if (isOldIE) {
            style.element = style.element || document.querySelector('style[data-group=' + group + ']');
          }

          if (!style.element) {
            var el = style.element = document.createElement('style');
            el.type = 'text/css';

            if (css.media) { el.setAttribute('media', css.media); }
            if (isOldIE) {
              el.setAttribute('data-group', group);
              el.setAttribute('data-next-index', '0');
            }

            head.appendChild(el);
          }

          if (isOldIE) {
            index = parseInt(style.element.getAttribute('data-next-index'));
            style.element.setAttribute('data-next-index', index + 1);
          }

          if (style.element.styleSheet) {
            style.parts.push(code);
            style.element.styleSheet.cssText = style.parts
              .filter(Boolean)
              .join('\n');
          } else {
            var textNode = document.createTextNode(code);
            var nodes = style.element.childNodes;
            if (nodes[index]) { style.element.removeChild(nodes[index]); }
            if (nodes.length) { style.element.insertBefore(textNode, nodes[index]); }
            else { style.element.appendChild(textNode); }
          }
        }
      }
    }
    /* style inject SSR */
    

    
    var foundation6$1 = __vue_normalize__$6(
      { render: __vue_render__$6, staticRenderFns: __vue_staticRenderFns__$6 },
      __vue_inject_styles__$6,
      __vue_script__$6,
      __vue_scope_id__$6,
      __vue_is_functional_template__$6,
      __vue_module_identifier__$6,
      __vue_create_injector__$6,
      undefined
    );

  var multiErrorExtractor = {
    baseMultiErrorExtractor: baseMultiErrorExtractor,
    bootstrap3: bootstrap3$1,
    bootstrap4: bootstrap4$1,
    foundation6: foundation6$1
  };

  var FormWrapper = {
    name: 'FormWrapper',
    props: {
      validator: {
        type: Object,
        required: true
      },
      messages: {
        type: Object,
        default: function () { return ({}); }
      }
    },
    render: function render (h) {
      return h('div', this.$slots.default)
    },
    provide: function provide () {
      return {
        formValidator: this.validator,
        formMessages: this.messages
      }
    }
  };

  var index = {
    singleErrorExtractor: singleErrorExtractor,
    multiErrorExtractor: multiErrorExtractor,
    FormWrapper: FormWrapper
  };

  var laravel = {
    minLength: {
      validationKey: 'min.string',
      params: [
        {
          vue: 'min',
          ext: 'min'
        }
      ]
    },
    sameAs: {
      validationKey: 'same',
      params: [
        {
          vue: 'eq',
          ext: 'other'
        }
      ]
    }
  };

  var index$1 = {
    laravel: laravel
  };

  function plugin (Vue, opts) {
    if ( opts === void 0 ) opts = {};

    var options = {
      i18n: opts.i18n || false,
      messages: opts.messages || {},
      validationKeys: opts.validationKeys || {},
      attributes: opts.attributes || {}
    };
    if (typeof options.i18n !== 'string' && options.i18n !== false) {
      throw Error(("[vuelidate-error-extractor] options.i18n should be false or a string, " + (options.i18n) + " given."))
    }
    Vue.prototype.$vuelidateErrorExtractor = options;
    if (typeof opts.template !== 'undefined') {
      var name = opts.name || 'formGroup';
      Vue.component(name, opts.template);
    }
  }

  var version = '2.2.2';

  exports.default = plugin;
  exports.singleErrorExtractorMixin = singleErrorExtractorMixin;
  exports.multiErrorExtractorMixin = multiErrorExtractorMixin;
  exports.configs = index$1;
  exports.templates = index;
  exports.version = version;

  return exports;

}({}));
