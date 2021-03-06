import { get, getValidationObject, getAttribute } from './utils'
import baseErrorsMixin from './base-errors-mixin'

export default {
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
      default: () => ({})
    },
    showSingleError: {
      type: Boolean,
      default: false
    }
  },
  extends: baseErrorsMixin,
  computed: {
    preferredValidator () {
      // if validator is passed is present on propsData, user has explicitly provided it.
      if (this.$options.propsData.hasOwnProperty('validator')) return this.validator
      return this.name ? get(this.formValidator, this.name, this.validator) : this.validator
    },
    errors () {
      const vualidateParams = this.preferredValidator.$params
      const remappedValidation = this.$vuelidateErrorExtractor.validationKeys
      // Map all the params in the validator object. They correspond to every validation rule.
      return Object.keys(vualidateParams).map((key) => {
        const vuelidateValidatorObject = vualidateParams[key]
        // Check of we have defined our validation remap in the settings
        if (typeof remappedValidation !== 'undefined' && remappedValidation.hasOwnProperty(key)) {
          const params = remappedValidation[key].params.reduce((all, paramKey) => {
            // Use the extra supplied data via validator-params prop or use the one from vuelidate
            all[paramKey.ext] = this.validatorParams.hasOwnProperty(paramKey.other) ? this.validatorParams[paramKey.other] : vuelidateValidatorObject[paramKey.vue]
            return all
          }, {})
          return getValidationObject.call(this, remappedValidation[key].validationKey, key, params)
        }
        const params = Object.assign({}, vuelidateValidatorObject, this.validatorParams)
        delete params.type
        // We are using the Vuelidate keys
        return getValidationObject.call(this, key, key, params)
      })
    },
    events () {
      return { input: () => this.preferredValidator.$touch() }
    },
    isValid () {
      return this.preferredValidator.$dirty ? !this.hasErrors : null
    },
    resolvedAttribute () {
      return getAttribute(this.$vuelidateErrorExtractor.attributes, this.attribute, this.label, this.name)
    }
  }
}
