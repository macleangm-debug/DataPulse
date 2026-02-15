/**
 * DataPulse - Plugin/Widget SDK
 * Framework for custom question types and UI widgets
 * 
 * Features:
 * - Widget registration system
 * - Custom question type support
 * - Validation hooks
 * - Rendering customization
 * - Event system
 */

// Widget Registry - stores all registered widgets
class WidgetRegistry {
  constructor() {
    this.widgets = new Map();
    this.validators = new Map();
    this.renderers = new Map();
    this.eventHandlers = new Map();
    this.hooks = {
      beforeRender: [],
      afterRender: [],
      beforeValidate: [],
      afterValidate: [],
      beforeSubmit: [],
      afterSubmit: []
    };
  }

  /**
   * Register a custom widget
   * @param {string} type - Unique widget type identifier
   * @param {object} config - Widget configuration
   */
  register(type, config) {
    if (this.widgets.has(type)) {
      console.warn(`Widget type "${type}" is already registered. Overwriting...`);
    }

    const widget = {
      type,
      label: config.label || type,
      icon: config.icon || 'Box',
      category: config.category || 'custom',
      description: config.description || '',
      
      // Component references
      renderComponent: config.renderComponent,
      editorComponent: config.editorComponent,
      previewComponent: config.previewComponent,
      
      // Default configuration
      defaultConfig: {
        required: false,
        readonly: false,
        visible: true,
        ...config.defaultConfig
      },
      
      // Default validation rules
      defaultValidation: config.defaultValidation || {},
      
      // Supported features
      features: {
        supportsMedia: config.features?.supportsMedia || false,
        supportsGPS: config.features?.supportsGPS || false,
        supportsOffline: config.features?.supportsOffline ?? true,
        supportsLogic: config.features?.supportsLogic ?? true,
        supportsTranslation: config.features?.supportsTranslation ?? true,
        ...config.features
      },
      
      // Metadata
      version: config.version || '1.0.0',
      author: config.author || 'DataPulse',
      
      // Lifecycle hooks
      onMount: config.onMount,
      onUnmount: config.onUnmount,
      onChange: config.onChange,
      onValidate: config.onValidate
    };

    this.widgets.set(type, widget);
    
    // Register custom validator if provided
    if (config.validate) {
      this.validators.set(type, config.validate);
    }

    console.log(`Widget "${type}" registered successfully`);
    return widget;
  }

  /**
   * Unregister a widget
   * @param {string} type - Widget type to remove
   */
  unregister(type) {
    if (this.widgets.has(type)) {
      this.widgets.delete(type);
      this.validators.delete(type);
      this.renderers.delete(type);
      console.log(`Widget "${type}" unregistered`);
      return true;
    }
    return false;
  }

  /**
   * Get a registered widget
   * @param {string} type - Widget type
   */
  get(type) {
    return this.widgets.get(type);
  }

  /**
   * Get all registered widgets
   */
  getAll() {
    return Array.from(this.widgets.values());
  }

  /**
   * Get widgets by category
   * @param {string} category - Category name
   */
  getByCategory(category) {
    return this.getAll().filter(w => w.category === category);
  }

  /**
   * Check if a widget type is registered
   * @param {string} type - Widget type
   */
  has(type) {
    return this.widgets.has(type);
  }

  /**
   * Register a global hook
   * @param {string} hookName - Hook name
   * @param {function} callback - Hook callback
   */
  addHook(hookName, callback) {
    if (this.hooks[hookName]) {
      this.hooks[hookName].push(callback);
      return () => {
        this.hooks[hookName] = this.hooks[hookName].filter(cb => cb !== callback);
      };
    }
    console.warn(`Hook "${hookName}" does not exist`);
    return () => {};
  }

  /**
   * Execute hooks
   * @param {string} hookName - Hook name
   * @param {any} data - Data to pass to hooks
   */
  async executeHooks(hookName, data) {
    if (!this.hooks[hookName]) return data;
    
    let result = data;
    for (const hook of this.hooks[hookName]) {
      result = await hook(result) ?? result;
    }
    return result;
  }

  /**
   * Validate a field value
   * @param {string} type - Widget type
   * @param {any} value - Field value
   * @param {object} config - Field configuration
   */
  async validate(type, value, config) {
    // Execute before validate hooks
    const context = await this.executeHooks('beforeValidate', { type, value, config });
    
    const errors = [];
    
    // Run custom validator if registered
    const customValidator = this.validators.get(type);
    if (customValidator) {
      const customErrors = await customValidator(context.value, context.config);
      if (customErrors) {
        errors.push(...(Array.isArray(customErrors) ? customErrors : [customErrors]));
      }
    }
    
    // Run default validations
    if (config.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: config.id, message: 'This field is required' });
    }
    
    if (config.validation?.minLength && typeof value === 'string' && value.length < config.validation.minLength) {
      errors.push({ field: config.id, message: `Minimum length is ${config.validation.minLength}` });
    }
    
    if (config.validation?.maxLength && typeof value === 'string' && value.length > config.validation.maxLength) {
      errors.push({ field: config.id, message: `Maximum length is ${config.validation.maxLength}` });
    }
    
    if (config.validation?.min !== undefined && typeof value === 'number' && value < config.validation.min) {
      errors.push({ field: config.id, message: `Minimum value is ${config.validation.min}` });
    }
    
    if (config.validation?.max !== undefined && typeof value === 'number' && value > config.validation.max) {
      errors.push({ field: config.id, message: `Maximum value is ${config.validation.max}` });
    }
    
    if (config.validation?.pattern && typeof value === 'string') {
      const regex = new RegExp(config.validation.pattern);
      if (!regex.test(value)) {
        errors.push({ field: config.id, message: config.validation.patternMessage || 'Invalid format' });
      }
    }
    
    // Execute after validate hooks
    const result = await this.executeHooks('afterValidate', { errors, type, value, config });
    
    return result.errors;
  }
}

// Create singleton instance
export const widgetRegistry = new WidgetRegistry();

/**
 * Widget Base Class
 * Base class for creating custom widgets
 */
export class WidgetBase {
  constructor(config) {
    this.type = config.type;
    this.label = config.label;
    this.icon = config.icon;
    this.value = null;
    this.errors = [];
    this.config = config;
  }

  setValue(value) {
    this.value = value;
    if (this.onChange) {
      this.onChange(value);
    }
  }

  getValue() {
    return this.value;
  }

  async validate() {
    return await widgetRegistry.validate(this.type, this.value, this.config);
  }

  // Override these methods in subclasses
  render() {
    throw new Error('render() must be implemented');
  }

  renderEditor() {
    return null;
  }

  renderPreview() {
    return this.render();
  }
}

/**
 * Create a widget definition helper
 * @param {object} config - Widget configuration
 */
export function defineWidget(config) {
  return {
    type: config.type,
    label: config.label,
    icon: config.icon,
    category: config.category || 'custom',
    description: config.description,
    
    // React component for rendering the widget
    renderComponent: config.component,
    
    // React component for the field editor
    editorComponent: config.editor,
    
    // Default field configuration
    defaultConfig: config.defaults || {},
    
    // Validation function
    validate: config.validate,
    
    // Feature flags
    features: config.features || {},
    
    // Metadata
    version: config.version || '1.0.0',
    author: config.author
  };
}

/**
 * Register built-in widgets
 */
export function registerBuiltInWidgets() {
  // These are already handled by the form builder
  // This function can be used to add additional built-in widgets
  console.log('Built-in widgets registered');
}

/**
 * Plugin Manager
 * Manages loading and unloading of plugins
 */
class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.loadedScripts = new Set();
  }

  /**
   * Register a plugin
   * @param {object} plugin - Plugin definition
   */
  register(plugin) {
    if (!plugin.id || !plugin.name) {
      throw new Error('Plugin must have an id and name');
    }

    const pluginDef = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version || '1.0.0',
      description: plugin.description || '',
      author: plugin.author || 'Unknown',
      widgets: plugin.widgets || [],
      hooks: plugin.hooks || {},
      dependencies: plugin.dependencies || [],
      enabled: false,
      
      // Lifecycle methods
      onEnable: plugin.onEnable,
      onDisable: plugin.onDisable,
      onInstall: plugin.onInstall,
      onUninstall: plugin.onUninstall
    };

    this.plugins.set(plugin.id, pluginDef);
    console.log(`Plugin "${plugin.name}" (${plugin.id}) registered`);
    
    return pluginDef;
  }

  /**
   * Enable a plugin
   * @param {string} pluginId - Plugin ID
   */
  async enable(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    if (plugin.enabled) {
      console.log(`Plugin "${plugin.name}" is already enabled`);
      return;
    }

    // Check dependencies
    for (const depId of plugin.dependencies) {
      const dep = this.plugins.get(depId);
      if (!dep || !dep.enabled) {
        throw new Error(`Plugin "${plugin.name}" requires "${depId}" to be enabled`);
      }
    }

    // Register widgets
    for (const widget of plugin.widgets) {
      widgetRegistry.register(widget.type, widget);
    }

    // Register hooks
    for (const [hookName, callback] of Object.entries(plugin.hooks)) {
      widgetRegistry.addHook(hookName, callback);
    }

    // Call onEnable
    if (plugin.onEnable) {
      await plugin.onEnable();
    }

    plugin.enabled = true;
    console.log(`Plugin "${plugin.name}" enabled`);
  }

  /**
   * Disable a plugin
   * @param {string} pluginId - Plugin ID
   */
  async disable(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    if (!plugin.enabled) {
      console.log(`Plugin "${plugin.name}" is already disabled`);
      return;
    }

    // Check if other plugins depend on this one
    for (const [id, p] of this.plugins) {
      if (p.enabled && p.dependencies.includes(pluginId)) {
        throw new Error(`Cannot disable "${plugin.name}" because "${p.name}" depends on it`);
      }
    }

    // Unregister widgets
    for (const widget of plugin.widgets) {
      widgetRegistry.unregister(widget.type);
    }

    // Call onDisable
    if (plugin.onDisable) {
      await plugin.onDisable();
    }

    plugin.enabled = false;
    console.log(`Plugin "${plugin.name}" disabled`);
  }

  /**
   * Get all plugins
   */
  getAll() {
    return Array.from(this.plugins.values());
  }

  /**
   * Get enabled plugins
   */
  getEnabled() {
    return this.getAll().filter(p => p.enabled);
  }

  /**
   * Load a plugin from a URL
   * @param {string} url - Plugin script URL
   */
  async loadFromUrl(url) {
    if (this.loadedScripts.has(url)) {
      console.log(`Plugin at "${url}" is already loaded`);
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      
      script.onload = () => {
        this.loadedScripts.add(url);
        console.log(`Plugin script loaded from "${url}"`);
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error(`Failed to load plugin from "${url}"`));
      };
      
      document.head.appendChild(script);
    });
  }
}

export const pluginManager = new PluginManager();

// Export everything
export default {
  widgetRegistry,
  pluginManager,
  WidgetBase,
  defineWidget,
  registerBuiltInWidgets
};
