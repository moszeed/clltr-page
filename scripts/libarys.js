require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function() {

    "use strict";

    var $           = require('jquery');
    var _           = require('underscore');
    var Dropbox     = require('dropbox');
    var Backbone    = require('Backbone');
        Backbone.$  = $;

    var contentCache = [];

    var _cache = {};

    function _writeToFileDebounced(filename, fileContent) {

        if (_cache[filename] === void 0) {
            _cache[filename] = _.debounce(_writeToFile, 600);
        }

        _cache[filename](filename, fileContent);
    }

    function _writeToFile(filename, fileContent) {

        var d = $.Deferred();
        Backbone.dropboxClient.writeFile(filename, JSON.stringify(fileContent), function(error, stat) {
            if (error) d.reject(error);
            else {
                d.resolve(stat);
            }

            return true;
        });
        return d;
    }


    function _read(store, model, options) {

        // nothing to do because model has no id
        if (model instanceof Backbone.Model &&
            model.attributes[model.idAttribute] === void 0) {
            return _syncModel(model, [], options);
        }

        var items = contentCache[store].items;

        // handle if model is collection
        if (model instanceof Backbone.Collection) {

            // apply filter
            if (options.filter != void 0) {

                var tmp = null;
                _(options.filter).each(function(value, key) {
                    if (value !== null) {
                        tmp = _.filter(items, function(item) {
                            return _.contains(item[key], value);
                        });
                    }
                });

                if (tmp !== null) items = tmp;
            }

            return _syncModel(model, items, options);
        }

        var search = {}, modelId = model.attributes[model.idAttribute];
            search[model.idAttribute] = modelId;

        var item = _(items).findWhere(search);
        if (item == void 0) {
            options.error('Model not found by ID ' + modelId);
            return true;
        }

        return _syncModel(model, item, options);
    }

    function _create(store, model, options) {
        model.set(model.idAttribute, ++contentCache[store].current);

        var modelData = model.toJSON();
        contentCache[store].items.push(modelData);

        return _syncModel(model, modelData, options);
    }

    function _update(store, model, options) {

        var modelData = model.toJSON();

            contentCache[store].items = _(contentCache[store].items).map(function(item) {
                if (item[model.idAttribute] == modelData[model.idAttribute]) {
                    item = modelData;
                }
                return item;
            });

        return _syncModel(model, modelData, options);
    }

    function _delete(store, model, options) {

        var modelData = model.toJSON();
        contentCache[store].items = _(contentCache[store].items).reject(function(item) {
            return item[model.idAttribute] == model.attributes[model.idAttribute];
        });

        return _syncModel(model, modelData, options);
    }


    function _readFile(filename, opts) {

        opts = opts || {};

        var d = $.Deferred();

        if ((opts.resetCache === void 0 ||
             opts.resetCache === false) &&
             contentCache[filename] !== void 0) {
            d.resolve();
        } else {

            Backbone.dropboxClient.readFile(filename, function(error, fileContent) {

                //extend and clear
                contentCache[filename] = {
                    current:0,
                    items:[]
                };

                if (error) {

                    // create empty model store file if not existing
                    if (Dropbox.ApiError.NOT_FOUND === error.status) {
                        $.when(_writeToFile(filename, contentCache[filename]))
                            .fail(d.reject)
                            .done(d.resolve);
                    }
                    else {
                        d.reject(error);
                    }
                }

                else {

                    if (fileContent.length > 0) {
                        contentCache[filename] = JSON.parse(fileContent);
                    }

                    d.resolve();
                }
            });
        }

        return d;
    }

    function _syncModel(model, items, options) {

        model.trigger('sync', model, items, options);
        options.success(items);
        return true;
    }



    Backbone.setDropboxClient = function(dropboxClient) {

        if (dropboxClient == void 0) {
            throw new Error('no dropbox client');
        }

        Backbone.dropboxClient = dropboxClient;
    };

    Backbone.sync = function(method, model, options) {

        if (Backbone.dropboxClient === void 0) {
            throw new Error('no dropbox client set');
        }

        options         = options           || {};
        options.success = options.success   || function() {};
        options.error   = options.error     || function() {};

        var storeFilename = model.store + '.json';

        var that = this;

        _readFile(storeFilename, options)
            .fail(options.error)
            .done(function() {

                switch(method) {
                    case 'read'  : _read(storeFilename, model, options);   break;
                    case 'create': _create(storeFilename, model, options); break;
                    case 'update': _update(storeFilename, model, options); break;
                    case 'delete': _delete(storeFilename, model, options); break;
                }

                if (method !== 'read') {
                    _writeToFileDebounced(storeFilename, contentCache[storeFilename]);
                }
            });
    };

})();
},{"Backbone":3,"dropbox":"tBYV3e","jquery":"QRCzyp","underscore":"s12qeW"}],2:[function(require,module,exports){
(function() {

    var Template = {};
        Template._promises  = {};
        Template._templates = {};


    var $           = require('jquery');
    var _           = require('underscore');
    var Backbone    = require('Backbone');
        Backbone.$  = $;

    function getTemplate(path) {
        var promise = Template._promises[path] || $.get(path);
        Template._promises[path] = promise;
        return promise;
    }


    //preload templates
    Backbone.View.preLoadTemplates = function(templates) {

        if (templates !== void 0) {
            _(templates).each(function(template) {

                if (Template._templates[template] === void 0) {
                    getTemplate(template);
                }
            });
        }
    };

    //make template function available in views
    Backbone.View.prototype.template = function(params) {

        params          = params            || {};
        params.params   = params.params     || {};
        params.success  = params.success    || function() {};

        if (params.path === void 0) {
            throw Error('no path given');
        }

        var that = this;
        function displayTpl() {
            that.$el.html(Template._templates[params.path](params.params));
            params.success();
        }

        //use precompiled if available
        if (Template._templates[params.path] !== void 0) {
            displayTpl();

            //if promise exist remove
            if (Template._promises[params.path] !== void 0) {
                delete Template._promises[params.path];
            }
            return true;
        }

        //load template
        getTemplate(params.path)
            .done(function(tpl) {
                Template._templates[params.path] = _.template(tpl);
                displayTpl();
            })
            .fail(function() {
                throw Error('fail to get template');
            });
    };

})();

},{"Backbone":3,"jquery":"QRCzyp","underscore":"s12qeW"}],3:[function(require,module,exports){
//     Backbone.js 1.1.2

//     (c) 2010-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(root, factory) {

  // Set up Backbone appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'jquery', 'exports'], function(_, $, exports) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global Backbone.
      root.Backbone = factory(root, exports, _, $);
    });

  // Next for Node.js or CommonJS. jQuery may not be needed as a module.
  } else if (typeof exports !== 'undefined') {
    var _ = require('underscore');
    factory(root, exports, _);

  // Finally, as a browser global.
  } else {
    root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

}(this, function(root, Backbone, _, $) {

  // Initial Setup
  // -------------

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousBackbone = root.Backbone;

  // Create local references to array methods we'll want to use later.
  var array = [];
  var push = array.push;
  var slice = array.slice;
  var splice = array.splice;

  // Current version of the library. Keep in sync with `package.json`.
  Backbone.VERSION = '1.1.2';

  // For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
  // the `$` variable.
  Backbone.$ = $;

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
  // will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
  // set a `X-Http-Method-Override` header.
  Backbone.emulateHTTP = false;

  // Turn on `emulateJSON` to support legacy servers that can't deal with direct
  // `application/json` requests ... will encode the body as
  // `application/x-www-form-urlencoded` instead and will send the model in a
  // form param named `model`.
  Backbone.emulateJSON = false;

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  var Events = Backbone.Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function(name, callback, context) {
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once: function(name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = _.once(function() {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
      if (!name && !callback && !context) {
        this._events = void 0;
        return this;
      }
      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if (events = this._events[name]) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                  (context && context !== ev.context)) {
                retain.push(ev);
              }
            }
          }
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening: function(obj, name, callback) {
      var listeningTo = this._listeningTo;
      if (!listeningTo) return this;
      var remove = !name && !callback;
      if (!callback && typeof name === 'object') callback = this;
      if (obj) (listeningTo = {})[obj._listenId] = obj;
      for (var id in listeningTo) {
        obj = listeningTo[id];
        obj.off(name, callback, this);
        if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
      }
      return this;
    }

  };

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{change: action}`
  // in terms of the existing API.
  var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, l = names.length; i < l; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
  };

  var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  _.each(listenMethods, function(implementation, method) {
    Events[method] = function(obj, name, callback) {
      var listeningTo = this._listeningTo || (this._listeningTo = {});
      var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
      listeningTo[id] = obj;
      if (!callback && typeof name === 'object') callback = this;
      obj[implementation](name, callback, this);
      return this;
    };
  });

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(Backbone, Events);

  // Backbone.Model
  // --------------

  // Backbone **Models** are the basic data object in the framework --
  // frequently representing a row in a table in a database on your server.
  // A discrete chunk of data and a bunch of useful, related methods for
  // performing computations and transformations on that data.

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  var Model = Backbone.Model = function(attributes, options) {
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId('c');
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    attrs = _.defaults({}, attrs, _.result(this, 'defaults'));
    this.set(attrs, options);
    this.changed = {};
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    changed: null,

    // The value returned during the last failed validation.
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // Proxy `Backbone.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    escape: function(attr) {
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    set: function(key, val, options) {
      var attr, attrs, unset, changes, silent, changing, prev, current;
      if (key == null) return this;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Run validation.
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
      unset           = options.unset;
      silent          = options.silent;
      changes         = [];
      changing        = this._changing;
      this._changing  = true;

      if (!changing) {
        this._previousAttributes = _.clone(this.attributes);
        this.changed = {};
      }
      current = this.attributes, prev = this._previousAttributes;

      // Check for changes of `id`.
      if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

      // For each `set` attribute, update or delete the current value.
      for (attr in attrs) {
        val = attrs[attr];
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        if (!_.isEqual(prev[attr], val)) {
          this.changed[attr] = val;
        } else {
          delete this.changed[attr];
        }
        unset ? delete current[attr] : current[attr] = val;
      }

      // Trigger all relevant attribute changes.
      if (!silent) {
        if (changes.length) this._pending = options;
        for (var i = 0, l = changes.length; i < l; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      if (changing) return this;
      if (!silent) {
        while (this._pending) {
          options = this._pending;
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },

    // Clear all attributes on the model, firing `"change"`.
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, {unset: true}));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    hasChanged: function(attr) {
      if (attr == null) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var val, changed = false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      for (var attr in diff) {
        if (_.isEqual(old[attr], (val = diff[attr]))) continue;
        (changed || (changed = {}))[attr] = val;
      }
      return changed;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Fetch the model from the server. If the server's representation of the
    // model differs from its current attributes, they will be overridden,
    // triggering a `"change"` event.
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        if (!model.set(model.parse(resp, options), options)) return false;
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function(key, val, options) {
      var attrs, method, xhr, attributes = this.attributes;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true}, options);

      // If we're not waiting and attributes exist, save acts as
      // `set(attr).save(null, opts)` with validation. Otherwise, check if
      // the model will be valid when the attributes, if any, are set.
      if (attrs && !options.wait) {
        if (!this.set(attrs, options)) return false;
      } else {
        if (!this._validate(attrs, options)) return false;
      }

      // Set temporary attributes if `{wait: true}`.
      if (attrs && options.wait) {
        this.attributes = _.extend({}, attributes, attrs);
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        model.attributes = attributes;
        var serverAttrs = model.parse(resp, options);
        if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
        if (_.isObject(serverAttrs) && !model.set(serverAttrs, options)) {
          return false;
        }
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);

      method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch') options.attrs = attrs;
      xhr = this.sync(method, this, options);

      // Restore attributes.
      if (attrs && options.wait) this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;

      var destroy = function() {
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (options.wait || model.isNew()) destroy();
        if (success) success(model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      if (this.isNew()) {
        options.success();
        return false;
      }
      wrapError(this, options);

      var xhr = this.sync('delete', this, options);
      if (!options.wait) destroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    url: function() {
      var base =
        _.result(this, 'urlRoot') ||
        _.result(this.collection, 'url') ||
        urlError();
      if (this.isNew()) return base;
      return base.replace(/([^\/])$/, '$1/') + encodeURIComponent(this.id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    isNew: function() {
      return !this.has(this.idAttribute);
    },

    // Check if the model is currently in a valid state.
    isValid: function(options) {
      return this._validate({}, _.extend(options || {}, { validate: true }));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
      return false;
    }

  });

  // Underscore methods that we want to implement on the Model.
  var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit'];

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  _.each(modelMethods, function(method) {
    Model.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.attributes);
      return _[method].apply(_, args);
    };
  });

  // Backbone.Collection
  // -------------------

  // If models tend to represent a single row of data, a Backbone Collection is
  // more analagous to a table full of data ... or a small slice or page of that
  // table, or a collection of rows that belong together for a particular reason
  // -- all of the messages in this particular folder, all of the documents
  // belonging to this particular author, and so on. Collections maintain
  // indexes of their models, both in order, and for lookup by `id`.

  // Create a new **Collection**, perhaps to contain a specific type of `model`.
  // If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  var Collection = Backbone.Collection = function(models, options) {
    options || (options = {});
    if (options.model) this.model = options.model;
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, _.extend({silent: true}, options));
  };

  // Default options for `Collection#set`.
  var setOptions = {add: true, remove: true, merge: true};
  var addOptions = {add: true, remove: false};

  // Define the Collection's inheritable methods.
  _.extend(Collection.prototype, Events, {

    // The default model for a collection is just a **Backbone.Model**.
    // This should be overridden in most cases.
    model: Model,

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function(options) {
      return this.map(function(model){ return model.toJSON(options); });
    },

    // Proxy `Backbone.sync` by default.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Add a model, or list of models to the set.
    add: function(models, options) {
      return this.set(models, _.extend({merge: false}, options, addOptions));
    },

    // Remove a model, or a list of models from the set.
    remove: function(models, options) {
      var singular = !_.isArray(models);
      models = singular ? [models] : _.clone(models);
      options || (options = {});
      var i, l, index, model;
      for (i = 0, l = models.length; i < l; i++) {
        model = models[i] = this.get(models[i]);
        if (!model) continue;
        delete this._byId[model.id];
        delete this._byId[model.cid];
        index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;
        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }
        this._removeReference(model, options);
      }
      return singular ? models[0] : models;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set: function(models, options) {
      options = _.defaults({}, options, setOptions);
      if (options.parse) models = this.parse(models, options);
      var singular = !_.isArray(models);
      models = singular ? (models ? [models] : []) : _.clone(models);
      var i, l, id, model, attrs, existing, sort;
      var at = options.at;
      var targetModel = this.model;
      var sortable = this.comparator && (at == null) && options.sort !== false;
      var sortAttr = _.isString(this.comparator) ? this.comparator : null;
      var toAdd = [], toRemove = [], modelMap = {};
      var add = options.add, merge = options.merge, remove = options.remove;
      var order = !sortable && add && remove ? [] : false;

      // Turn bare objects into model references, and prevent invalid models
      // from being added.
      for (i = 0, l = models.length; i < l; i++) {
        attrs = models[i] || {};
        if (attrs instanceof Model) {
          id = model = attrs;
        } else {
          id = attrs[targetModel.prototype.idAttribute || 'id'];
        }

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        if (existing = this.get(id)) {
          if (remove) modelMap[existing.cid] = true;
          if (merge) {
            attrs = attrs === model ? model.attributes : attrs;
            if (options.parse) attrs = existing.parse(attrs, options);
            existing.set(attrs, options);
            if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
          }
          models[i] = existing;

        // If this is a new, valid model, push it to the `toAdd` list.
        } else if (add) {
          model = models[i] = this._prepareModel(attrs, options);
          if (!model) continue;
          toAdd.push(model);
          this._addReference(model, options);
        }

        // Do not add multiple models with the same `id`.
        model = existing || model;
        if (order && (model.isNew() || !modelMap[model.id])) order.push(model);
        modelMap[model.id] = true;
      }

      // Remove nonexistent models if appropriate.
      if (remove) {
        for (i = 0, l = this.length; i < l; ++i) {
          if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
        }
        if (toRemove.length) this.remove(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      if (toAdd.length || (order && order.length)) {
        if (sortable) sort = true;
        this.length += toAdd.length;
        if (at != null) {
          for (i = 0, l = toAdd.length; i < l; i++) {
            this.models.splice(at + i, 0, toAdd[i]);
          }
        } else {
          if (order) this.models.length = 0;
          var orderedModels = order || toAdd;
          for (i = 0, l = orderedModels.length; i < l; i++) {
            this.models.push(orderedModels[i]);
          }
        }
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({silent: true});

      // Unless silenced, it's time to fire all appropriate add/sort events.
      if (!options.silent) {
        for (i = 0, l = toAdd.length; i < l; i++) {
          (model = toAdd[i]).trigger('add', model, this, options);
        }
        if (sort || (order && order.length)) this.trigger('sort', this, options);
      }

      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset: function(models, options) {
      options || (options = {});
      for (var i = 0, l = this.models.length; i < l; i++) {
        this._removeReference(this.models[i], options);
      }
      options.previousModels = this.models;
      this._reset();
      models = this.add(models, _.extend({silent: true}, options));
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    },

    // Add a model to the end of the collection.
    push: function(model, options) {
      return this.add(model, _.extend({at: this.length}, options));
    },

    // Remove a model from the end of the collection.
    pop: function(options) {
      var model = this.at(this.length - 1);
      this.remove(model, options);
      return model;
    },

    // Add a model to the beginning of the collection.
    unshift: function(model, options) {
      return this.add(model, _.extend({at: 0}, options));
    },

    // Remove a model from the beginning of the collection.
    shift: function(options) {
      var model = this.at(0);
      this.remove(model, options);
      return model;
    },

    // Slice out a sub-array of models from the collection.
    slice: function() {
      return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id.
    get: function(obj) {
      if (obj == null) return void 0;
      return this._byId[obj] || this._byId[obj.id] || this._byId[obj.cid];
    },

    // Get the model at the given index.
    at: function(index) {
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where: function(attrs, first) {
      if (_.isEmpty(attrs)) return first ? void 0 : [];
      return this[first ? 'find' : 'filter'](function(model) {
        for (var key in attrs) {
          if (attrs[key] !== model.get(key)) return false;
        }
        return true;
      });
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere: function(attrs) {
      return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function(options) {
      if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      // Run sort based on type of `comparator`.
      if (_.isString(this.comparator) || this.comparator.length === 1) {
        this.models = this.sortBy(this.comparator, this);
      } else {
        this.models.sort(_.bind(this.comparator, this));
      }

      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function(attr) {
      return _.invoke(this.models, 'get', attr);
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var success = options.success;
      var collection = this;
      options.success = function(resp) {
        var method = options.reset ? 'reset' : 'set';
        collection[method](resp, options);
        if (success) success(collection, resp, options);
        collection.trigger('sync', collection, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function(model, options) {
      options = options ? _.clone(options) : {};
      if (!(model = this._prepareModel(model, options))) return false;
      if (!options.wait) this.add(model, options);
      var collection = this;
      var success = options.success;
      options.success = function(model, resp) {
        if (options.wait) collection.add(model, options);
        if (success) success(model, resp, options);
      };
      model.save(null, options);
      return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new collection with an identical list of models as this one.
    clone: function() {
      return new this.constructor(this.models);
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset: function() {
      this.length = 0;
      this.models = [];
      this._byId  = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel: function(attrs, options) {
      if (attrs instanceof Model) return attrs;
      options = options ? _.clone(options) : {};
      options.collection = this;
      var model = new this.model(attrs, options);
      if (!model.validationError) return model;
      this.trigger('invalid', this, model.validationError, options);
      return false;
    },

    // Internal method to create a model's ties to a collection.
    _addReference: function(model, options) {
      this._byId[model.cid] = model;
      if (model.id != null) this._byId[model.id] = model;
      if (!model.collection) model.collection = this;
      model.on('all', this._onModelEvent, this);
    },

    // Internal method to sever a model's ties to a collection.
    _removeReference: function(model, options) {
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function(event, model, collection, options) {
      if ((event === 'add' || event === 'remove') && collection !== this) return;
      if (event === 'destroy') this.remove(model, options);
      if (model && event === 'change:' + model.idAttribute) {
        delete this._byId[model.previous(model.idAttribute)];
        if (model.id != null) this._byId[model.id] = model;
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
  var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
    'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
    'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
    'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
    'tail', 'drop', 'last', 'without', 'difference', 'indexOf', 'shuffle',
    'lastIndexOf', 'isEmpty', 'chain', 'sample'];

  // Mix in each Underscore method as a proxy to `Collection#models`.
  _.each(methods, function(method) {
    Collection.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.models);
      return _[method].apply(_, args);
    };
  });

  // Underscore methods that take a property name as an argument.
  var attributeMethods = ['groupBy', 'countBy', 'sortBy', 'indexBy'];

  // Use attributes instead of properties.
  _.each(attributeMethods, function(method) {
    Collection.prototype[method] = function(value, context) {
      var iterator = _.isFunction(value) ? value : function(model) {
        return model.get(value);
      };
      return _[method](this.models, iterator, context);
    };
  });

  // Backbone.View
  // -------------

  // Backbone Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = Backbone.View = function(options) {
    this.cid = _.uniqueId('view');
    options || (options = {});
    _.extend(this, _.pick(options, viewOptions));
    this._ensureElement();
    this.initialize.apply(this, arguments);
    this.delegateEvents();
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be merged as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **Backbone.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be preferred to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable Backbone.Events listeners.
    remove: function() {
      this.$el.remove();
      this.stopListening();
      return this;
    },

    // Change the view's element (`this.el` property), including event
    // re-delegation.
    setElement: function(element, delegate) {
      if (this.$el) this.undelegateEvents();
      this.$el = element instanceof Backbone.$ ? element : Backbone.$(element);
      this.el = this.$el[0];
      if (delegate !== false) this.delegateEvents();
      return this;
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save',
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    // This only works for delegate-able events: not `focus`, `blur`, and
    // not `change`, `submit`, and `reset` in Internet Explorer.
    delegateEvents: function(events) {
      if (!(events || (events = _.result(this, 'events')))) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[events[key]];
        if (!method) continue;

        var match = key.match(delegateEventSplitter);
        var eventName = match[1], selector = match[2];
        method = _.bind(method, this);
        eventName += '.delegateEvents' + this.cid;
        if (selector === '') {
          this.$el.on(eventName, method);
        } else {
          this.$el.on(eventName, selector, method);
        }
      }
      return this;
    },

    // Clears all callbacks previously bound to the view with `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    undelegateEvents: function() {
      this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        if (this.className) attrs['class'] = _.result(this, 'className');
        var $el = Backbone.$('<' + _.result(this, 'tagName') + '>').attr(attrs);
        this.setElement($el, false);
      } else {
        this.setElement(_.result(this, 'el'), false);
      }
    }

  });

  // Backbone.sync
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  Backbone.sync = function(method, model, options) {
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // Default JSON-request options.
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !options.emulateJSON) {
      params.processData = false;
    }

    // If we're sending a `PATCH` request, and we're in an old Internet Explorer
    // that still has ActiveX enabled by default, override jQuery to use that
    // for XHR instead. Remove this line when jQuery supports `PATCH` on IE8.
    if (params.type === 'PATCH' && noXhrPatch) {
      params.xhr = function() {
        return new ActiveXObject("Microsoft.XMLHTTP");
      };
    }

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  var noXhrPatch =
    typeof window !== 'undefined' && !!window.ActiveXObject &&
      !(window.XMLHttpRequest && (new XMLHttpRequest).dispatchEvent);

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch':  'PATCH',
    'delete': 'DELETE',
    'read':   'GET'
  };

  // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
  // Override this if you'd like to use a different library.
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments);
  };

  // Backbone.Router
  // ---------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  var optionalParam = /\((.*?)\)/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    route: function(route, name, callback) {
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name)) {
        callback = name;
        name = '';
      }
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment);
        router.execute(callback, args);
        router.trigger.apply(router, ['route:' + name].concat(args));
        router.trigger('route', name, args);
        Backbone.history.trigger('route', router, name, args);
      });
      return this;
    },

    // Execute a route handler with the provided parameters.  This is an
    // excellent place to do pre-route setup or post-route cleanup.
    execute: function(callback, args) {
      if (callback) callback.apply(this, args);
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    _bindRoutes: function() {
      if (!this.routes) return;
      this.routes = _.result(this, 'routes');
      var route, routes = _.keys(this.routes);
      while ((route = routes.pop()) != null) {
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&')
                   .replace(optionalParam, '(?:$1)?')
                   .replace(namedParam, function(match, optional) {
                     return optional ? match : '([^/?]+)';
                   })
                   .replace(splatParam, '([^?]*?)');
      return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param, i) {
        // Don't decode the search params.
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  var History = Backbone.History = function() {
    this.handlers = [];
    _.bindAll(this, 'checkUrl');

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for detecting MSIE.
  var isExplorer = /msie [\w.]+/;

  // Cached regex for removing a trailing slash.
  var trailingSlash = /\/$/;

  // Cached regex for stripping urls of hash.
  var pathStripper = /#.*$/;

  // Has the history handling already been started?
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    interval: 50,

    // Are we at the app root?
    atRoot: function() {
      return this.location.pathname.replace(/[^\/]$/, '$&/') === this.root;
    },

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the cross-browser normalized URL fragment, either from the URL,
    // the hash, or the override.
    getFragment: function(fragment, forcePushState) {
      if (fragment == null) {
        if (this._hasPushState || !this._wantsHashChange || forcePushState) {
          fragment = decodeURI(this.location.pathname + this.location.search);
          var root = this.root.replace(trailingSlash, '');
          if (!fragment.indexOf(root)) fragment = fragment.slice(root.length);
        } else {
          fragment = this.getHash();
        }
      }
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    start: function(options) {
      if (History.started) throw new Error("Backbone.history has already been started");
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      this.options          = _.extend({root: '/'}, this.options, options);
      this.root             = this.options.root;
      this._wantsHashChange = this.options.hashChange !== false;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.options.pushState && this.history && this.history.pushState);
      var fragment          = this.getFragment();
      var docMode           = document.documentMode;
      var oldIE             = (isExplorer.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));

      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      if (oldIE && this._wantsHashChange) {
        var frame = Backbone.$('<iframe src="javascript:0" tabindex="-1">');
        this.iframe = frame.hide().appendTo('body')[0].contentWindow;
        this.navigate(fragment);
      }

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._hasPushState) {
        Backbone.$(window).on('popstate', this.checkUrl);
      } else if (this._wantsHashChange && ('onhashchange' in window) && !oldIE) {
        Backbone.$(window).on('hashchange', this.checkUrl);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      // Determine if we need to change the base url, for a pushState link
      // opened by a non-pushState browser.
      this.fragment = fragment;
      var loc = this.location;

      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {

        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
        if (!this._hasPushState && !this.atRoot()) {
          this.fragment = this.getFragment(null, true);
          this.location.replace(this.root + '#' + this.fragment);
          // Return immediately as browser will do redirect to new url
          return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
        } else if (this._hasPushState && this.atRoot() && loc.hash) {
          this.fragment = this.getHash().replace(routeStripper, '');
          this.history.replaceState({}, document.title, this.root + this.fragment);
        }

      }

      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    stop: function() {
      Backbone.$(window).off('popstate', this.checkUrl).off('hashchange', this.checkUrl);
      if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    checkUrl: function(e) {
      var current = this.getFragment();
      if (current === this.fragment && this.iframe) {
        current = this.getFragment(this.getHash(this.iframe));
      }
      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl();
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    loadUrl: function(fragment) {
      fragment = this.fragment = this.getFragment(fragment);
      return _.any(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    navigate: function(fragment, options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: !!options};

      var url = this.root + (fragment = this.getFragment(fragment || ''));

      // Strip the hash for matching.
      fragment = fragment.replace(pathStripper, '');

      if (this.fragment === fragment) return;
      this.fragment = fragment;

      // Don't include a trailing slash on the root.
      if (fragment === '' && url !== '/') url = url.slice(0, -1);

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._hasPushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          if(!options.replace) this.iframe.document.open().close();
          this._updateHash(this.iframe.location, fragment, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent's constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    var Surrogate = function(){ this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error(model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

  return Backbone;

}));

},{"underscore":"s12qeW"}],"backbone":[function(require,module,exports){
module.exports=require('DIOwA5');
},{}],"DIOwA5":[function(require,module,exports){
module.exports=require(3)
},{"underscore":"s12qeW"}],"tBYV3e":[function(require,module,exports){
(function (process,global,Buffer){
// Generated by CoffeeScript 1.8.0
(function() {
  var DbxClient, DbxEnvGlobal, DbxEnvRequire, DbxXhrArrayBufferView, DbxXhrCanSendForms, DbxXhrDoesPreflight, DbxXhrIeMode, DbxXhrRequest, DbxXhrSendArrayBufferView, DbxXhrWrapBlob, Dropbox,
    __hasProp = {}.hasOwnProperty,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Dropbox = (function() {
    function Dropbox() {
      throw new Error("Not implemented. Did you mean to use Dropbox.Client?");
    }

    return Dropbox;

  })();

  Dropbox.Util = (function() {
    function Util() {}

    return Util;

  })();

  Dropbox.Http = (function() {
    function Http() {}

    return Http;

  })();

  Dropbox.File = (function() {
    function File() {}

    return File;

  })();

  if (typeof window !== 'undefined') {
    DbxEnvGlobal = window;
    if (window.Dropbox) {
      (function() {
        var name, value, _ref, _results;
        _ref = window.Dropbox;
        _results = [];
        for (name in _ref) {
          if (!__hasProp.call(_ref, name)) continue;
          value = _ref[name];
          _results.push(Dropbox[name] = value);
        }
        return _results;
      })();
    }
    window.Dropbox = Dropbox;
  } else if (typeof global !== 'undefined') {
    DbxEnvGlobal = global;
  } else if (typeof self !== 'undefined') {
    DbxEnvGlobal = self;
  }

  if (typeof DbxEnvGlobal === 'undefined') {
    throw new Error('dropbox.js loaded in an unsupported JavaScript environment.');
  }

  if (typeof module !== 'undefined' && 'exports' in module) {
    module.exports = Dropbox;
  }

  if (typeof self !== 'undefined' && typeof self.importScripts !== 'undefined') {
    self.Dropbox = Dropbox;
    DbxEnvRequire = self.importScripts.bind(self);
  }

  if (typeof module !== 'undefined' && typeof require !== 'undefined') {
    DbxEnvRequire = require.bind(module);
  }

  Dropbox.Env = (function() {
    function Env() {}

    Env.global = DbxEnvGlobal;

    Env.require = DbxEnvRequire;

    return Env;

  })();

  Dropbox.Util.EventSource = (function() {
    function EventSource(options) {
      this._cancelable = options && options.cancelable;
      this._listeners = [];
    }

    EventSource.prototype.addListener = function(listener) {
      if (typeof listener !== 'function') {
        throw new TypeError('Invalid listener type; expected function');
      }
      if (__indexOf.call(this._listeners, listener) < 0) {
        this._listeners.push(listener);
      }
      return this;
    };

    EventSource.prototype.removeListener = function(listener) {
      var i, index, subscriber, _i, _len, _ref;
      if (this._listeners.indexOf) {
        index = this._listeners.indexOf(listener);
        if (index !== -1) {
          this._listeners.splice(index, 1);
        }
      } else {
        _ref = this._listeners;
        for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
          subscriber = _ref[i];
          if (subscriber === listener) {
            this._listeners.splice(i, 1);
            break;
          }
        }
      }
      return this;
    };

    EventSource.prototype.dispatch = function(event) {
      var listener, returnValue, _i, _len, _ref;
      _ref = this._listeners;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        listener = _ref[_i];
        returnValue = listener(event);
        if (this._cancelable && (returnValue === false)) {
          return false;
        }
      }
      return true;
    };

    return EventSource;

  })();

  Dropbox.AccountInfo = (function() {
    AccountInfo.parse = function(accountInfo) {
      if (accountInfo && typeof accountInfo === 'object') {
        return new Dropbox.AccountInfo(accountInfo);
      } else {
        return accountInfo;
      }
    };

    AccountInfo.prototype.name = null;

    AccountInfo.prototype.email = null;

    AccountInfo.prototype.countryCode = null;

    AccountInfo.prototype.uid = null;

    AccountInfo.prototype.referralUrl = null;

    AccountInfo.prototype.publicAppUrl = null;

    AccountInfo.prototype.quota = null;

    AccountInfo.prototype.usedQuota = null;

    AccountInfo.prototype.privateBytes = null;

    AccountInfo.prototype.sharedBytes = null;

    AccountInfo.prototype.json = function() {
      return this._json;
    };

    function AccountInfo(accountInfo) {
      var lastIndex;
      this._json = accountInfo;
      this.name = accountInfo.display_name;
      this.email = accountInfo.email;
      this.countryCode = accountInfo.country || null;
      this.uid = accountInfo.uid.toString();
      if (accountInfo.public_app_url) {
        this.publicAppUrl = accountInfo.public_app_url;
        lastIndex = this.publicAppUrl.length - 1;
        if (lastIndex >= 0 && this.publicAppUrl.substring(lastIndex) === '/') {
          this.publicAppUrl = this.publicAppUrl.substring(0, lastIndex);
        }
      } else {
        this.publicAppUrl = null;
      }
      this.referralUrl = accountInfo.referral_link;
      this.quota = accountInfo.quota_info.quota;
      this.privateBytes = accountInfo.quota_info.normal || 0;
      this.sharedBytes = accountInfo.quota_info.shared || 0;
      this.usedQuota = this.privateBytes + this.sharedBytes;
    }

    return AccountInfo;

  })();

  Dropbox.ApiError = (function() {
    ApiError.prototype.status = null;

    ApiError.prototype.method = null;

    ApiError.prototype.url = null;

    ApiError.prototype.responseText = null;

    ApiError.prototype.response = null;

    ApiError.NETWORK_ERROR = 0;

    ApiError.NO_CONTENT = 304;

    ApiError.INVALID_PARAM = 400;

    ApiError.INVALID_TOKEN = 401;

    ApiError.OAUTH_ERROR = 403;

    ApiError.NOT_FOUND = 404;

    ApiError.INVALID_METHOD = 405;

    ApiError.NOT_ACCEPTABLE = 406;

    ApiError.CONFLICT = 409;

    ApiError.RATE_LIMITED = 429;

    ApiError.SERVER_ERROR = 503;

    ApiError.OVER_QUOTA = 507;

    function ApiError(xhr, method, url) {
      var text, xhrError;
      this.method = method;
      this.url = url;
      this.status = xhr.status;
      if (xhr.responseType) {
        try {
          text = xhr.response || xhr.responseText;
        } catch (_error) {
          xhrError = _error;
          try {
            text = xhr.responseText;
          } catch (_error) {
            xhrError = _error;
            text = null;
          }
        }
      } else {
        try {
          text = xhr.responseText;
        } catch (_error) {
          xhrError = _error;
          text = null;
        }
      }
      if (text) {
        try {
          this.responseText = text.toString();
          this.response = JSON.parse(text);
        } catch (_error) {
          xhrError = _error;
          this.response = null;
        }
      } else {
        this.responseText = '(no response)';
        this.response = null;
      }
    }

    ApiError.prototype.toString = function() {
      return "Dropbox API error " + this.status + " from " + this.method + " " + this.url + " :: " + this.responseText;
    };

    ApiError.prototype.inspect = function() {
      return this.toString();
    };

    return ApiError;

  })();

  Dropbox.AuthDriver = (function() {
    function AuthDriver() {}

    AuthDriver.prototype.authType = function() {
      return "code";
    };

    AuthDriver.prototype.url = function() {
      return "https://some.url";
    };

    AuthDriver.prototype.doAuthorize = function(authUrl, stateParam, client, callback) {
      return callback({
        code: 'access-code'
      });
    };

    AuthDriver.prototype.getStateParam = function(client, callback) {
      return callback(Dropbox.Util.Oauth.randomAuthStateParam());
    };

    AuthDriver.prototype.resumeAuthorize = function(stateParam, client, callback) {
      return callback({
        code: 'access-code'
      });
    };

    AuthDriver.prototype.onAuthStepChange = function(client, callback) {
      return callback();
    };

    AuthDriver.oauthQueryParams = ['access_token', 'expires_in', 'scope', 'token_type', 'code', 'error', 'error_description', 'error_uri', 'mac_key', 'mac_algorithm'].sort();

    return AuthDriver;

  })();

  Dropbox.AuthDriver.autoConfigure = function(client) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      if (chrome.tabs && chrome.tabs.create) {
        client.authDriver(new Dropbox.AuthDriver.ChromeExtension());
      } else {
        client.authDriver(new Dropbox.AuthDriver.ChromeApp());
      }
      return;
    }
    if (typeof window !== 'undefined') {
      if (window.cordova) {
        client.authDriver(new Dropbox.AuthDriver.Cordova());
        return;
      }
      if (window && window.navigator) {
        client.authDriver(new Dropbox.AuthDriver.Redirect());
      }
    }
  };

  Dropbox.AuthDriver.BrowserBase = (function() {
    function BrowserBase(options) {
      if (options) {
        this.rememberUser = 'rememberUser' in options ? options.rememberUser : true;
        this.scope = options.scope || 'default';
      } else {
        this.rememberUser = true;
        this.scope = 'default';
      }
      this.storageKey = null;
      this.storage = Dropbox.AuthDriver.BrowserBase.localStorage();
      this.stateRe = /^[^#]+\#(.*&)?state=([^&]+)(&|$)/;
    }

    BrowserBase.prototype.authType = function() {
      return 'token';
    };

    BrowserBase.prototype.onAuthStepChange = function(client, callback) {
      this.setStorageKey(client);
      switch (client.authStep) {
        case Dropbox.Client.RESET:
          return this.loadCredentials((function(_this) {
            return function(credentials) {
              if (!credentials) {
                return callback();
              }
              client.setCredentials(credentials);
              if (client.authStep !== Dropbox.Client.DONE) {
                return callback();
              }
              if (!_this.rememberUser) {
                return _this.forgetCredentials(callback);
              }
              client.setCredentials(credentials);
              return callback();
            };
          })(this));
        case Dropbox.Client.DONE:
          if (this.rememberUser) {
            return this.storeCredentials(client.credentials(), callback);
          }
          return this.forgetCredentials(callback);
        case Dropbox.Client.SIGNED_OUT:
          return this.forgetCredentials(callback);
        case Dropbox.Client.ERROR:
          return this.forgetCredentials(callback);
        default:
          callback();
          return this;
      }
    };

    BrowserBase.prototype.setStorageKey = function(client) {
      this.storageKey = "dropbox-auth:" + this.scope + ":" + (client.appHash());
      return this;
    };

    BrowserBase.prototype.storeCredentials = function(credentials, callback) {
      var jsonString, name, storageError, value;
      jsonString = JSON.stringify(credentials);
      try {
        this.storage.setItem(this.storageKey, jsonString);
      } catch (_error) {
        storageError = _error;
        name = encodeURIComponent(this.storageKey);
        value = encodeURIComponent(jsonString);
        document.cookie = "" + name + "=" + value + "; path=/";
      }
      callback();
      return this;
    };

    BrowserBase.prototype.loadCredentials = function(callback) {
      var cookieRegexp, jsonError, jsonString, match, name, nameRegexp, storageError;
      try {
        jsonString = this.storage.getItem(this.storageKey);
      } catch (_error) {
        storageError = _error;
        jsonString = null;
      }
      if (jsonString === null) {
        name = encodeURIComponent(this.storageKey);
        nameRegexp = name.replace(/[.*+()]/g, '\\$&');
        cookieRegexp = new RegExp("(^|(;\\s*))" + name + "=([^;]*)(;|$)");
        if (match = cookieRegexp.exec(document.cookie)) {
          jsonString = decodeURIComponent(match[3]);
        }
      }
      if (!jsonString) {
        callback(null);
        return this;
      }
      try {
        callback(JSON.parse(jsonString));
      } catch (_error) {
        jsonError = _error;
        callback(null);
      }
      return this;
    };

    BrowserBase.prototype.forgetCredentials = function(callback) {
      var expires, name, storageError;
      try {
        this.storage.removeItem(this.storageKey);
      } catch (_error) {
        storageError = _error;
        name = encodeURIComponent(this.storageKey);
        expires = (new Date(0)).toGMTString();
        document.cookie = "" + name + "={}; expires=" + expires + "; path=/";
      }
      callback();
      return this;
    };

    BrowserBase.prototype.locationStateParam = function(url) {
      var location, match;
      location = url || Dropbox.AuthDriver.BrowserBase.currentLocation();
      match = this.stateRe.exec(location);
      if (match) {
        return decodeURIComponent(match[2]);
      }
      return null;
    };

    BrowserBase.prototype.replaceUrlBasename = function(url, basename) {
      var fragments, hashIndex, queryIndex;
      hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        url = url.substring(0, hashIndex);
      }
      queryIndex = url.indexOf('?');
      if (queryIndex !== -1) {
        url = url.substring(0, queryIndex);
      }
      fragments = url.split('/');
      fragments[fragments.length - 1] = basename;
      return fragments.join('/');
    };

    BrowserBase.localStorage = function() {
      var deprecationError;
      if (typeof window !== 'undefined') {
        try {
          return window.localStorage;
        } catch (_error) {
          deprecationError = _error;
          return null;
        }
      } else {
        return null;
      }
    };

    BrowserBase.currentLocation = function() {
      return window.location.href;
    };

    BrowserBase.cleanupLocation = function() {
      var hashIndex, pageUrl;
      if (window.history && window.history.replaceState) {
        pageUrl = this.currentLocation();
        hashIndex = pageUrl.indexOf('#');
        window.history.replaceState({}, document.title, pageUrl.substring(0, hashIndex));
      } else {
        window.location.hash = '';
      }
    };

    return BrowserBase;

  })();

  Dropbox.AuthDriver.Redirect = (function(_super) {
    __extends(Redirect, _super);

    function Redirect(options) {
      Redirect.__super__.constructor.call(this, options);
      this.receiverUrl = this.baseUrl(options);
    }

    Redirect.prototype.baseUrl = function(options) {
      var hashIndex, url;
      url = Dropbox.AuthDriver.BrowserBase.currentLocation();
      if (options) {
        if (options.redirectUrl) {
          return options.redirectUrl;
        }
        if (options.redirectFile) {
          return this.replaceUrlBasename(url, options.redirectFile);
        }
      }
      hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        url = url.substring(0, hashIndex);
      }
      return url;
    };

    Redirect.prototype.url = function() {
      return this.receiverUrl;
    };

    Redirect.prototype.doAuthorize = function(authUrl, stateParam, client) {
      return this.storeCredentials(client.credentials(), function() {
        return window.location.assign(authUrl);
      });
    };

    Redirect.prototype.resumeAuthorize = function(stateParam, client, callback) {
      var pageUrl;
      if (this.locationStateParam() === stateParam) {
        pageUrl = Dropbox.AuthDriver.BrowserBase.currentLocation();
        Dropbox.AuthDriver.BrowserBase.cleanupLocation();
        return callback(Dropbox.Util.Oauth.queryParamsFromUrl(pageUrl));
      } else {
        return this.forgetCredentials(function() {
          return callback({
            error: 'Authorization error'
          });
        });
      }
    };

    return Redirect;

  })(Dropbox.AuthDriver.BrowserBase);

  Dropbox.AuthDriver.Popup = (function(_super) {
    __extends(Popup, _super);

    function Popup(options) {
      Popup.__super__.constructor.call(this, options);
      this.receiverUrl = this.baseUrl(options);
    }

    Popup.prototype.url = function() {
      return this.receiverUrl;
    };

    Popup.prototype.doAuthorize = function(authUrl, stateParam, client, callback) {
      this.listenForMessage(stateParam, callback);
      return this.openWindow(authUrl);
    };

    Popup.prototype.baseUrl = function(options) {
      var url;
      url = Dropbox.AuthDriver.BrowserBase.currentLocation();
      if (options) {
        if (options.receiverUrl) {
          return options.receiverUrl;
        } else if (options.receiverFile) {
          return this.replaceUrlBasename(url, options.receiverFile);
        }
      }
      return url;
    };

    Popup.prototype.openWindow = function(url) {
      return window.open(url, '_dropboxOauthSigninWindow', this.popupWindowSpec(980, 700));
    };

    Popup.prototype.popupWindowSpec = function(popupWidth, popupHeight) {
      var height, popupLeft, popupTop, width, x0, y0, _ref, _ref1, _ref2, _ref3;
      x0 = (_ref = window.screenX) != null ? _ref : window.screenLeft;
      y0 = (_ref1 = window.screenY) != null ? _ref1 : window.screenTop;
      width = (_ref2 = window.outerWidth) != null ? _ref2 : document.documentElement.clientWidth;
      height = (_ref3 = window.outerHeight) != null ? _ref3 : document.documentElement.clientHeight;
      popupLeft = Math.round(x0 + (width - popupWidth) / 2);
      popupTop = Math.round(y0 + (height - popupHeight) / 2.5);
      if (popupLeft < x0) {
        popupLeft = x0;
      }
      if (popupTop < y0) {
        popupTop = y0;
      }
      return ("width=" + popupWidth + ",height=" + popupHeight + ",") + ("left=" + popupLeft + ",top=" + popupTop) + 'dialog=yes,dependent=yes,scrollbars=yes,location=yes';
    };

    Popup.prototype.listenForMessage = function(stateParam, callback) {
      var listener;
      listener = (function(_this) {
        return function(event) {
          var data, jsonError, oauthInfo;
          if (event.data) {
            data = event.data;
          } else {
            data = event;
          }
          try {
            oauthInfo = JSON.parse(data)._dropboxjs_oauth_info;
          } catch (_error) {
            jsonError = _error;
            return;
          }
          if (!oauthInfo) {
            return;
          }
          if (_this.locationStateParam(oauthInfo) === stateParam) {
            stateParam = false;
            window.removeEventListener('message', listener);
            Dropbox.AuthDriver.Popup.onMessage.removeListener(listener);
            return callback(Dropbox.Util.Oauth.queryParamsFromUrl(data));
          }
        };
      })(this);
      window.addEventListener('message', listener, false);
      return Dropbox.AuthDriver.Popup.onMessage.addListener(listener);
    };

    Popup.locationOrigin = function(location) {
      var match;
      match = /^(file:\/\/[^\?\#]*)(\?|\#|$)/.exec(location);
      if (match) {
        return match[1];
      }
      match = /^([^\:]+\:\/\/[^\/\?\#]*)(\/|\?|\#|$)/.exec(location);
      if (match) {
        return match[1];
      }
      return location;
    };

    Popup.oauthReceiver = function() {
      window.addEventListener('load', function() {
        var frameError, ieError, message, opener, pageOrigin, pageUrl;
        pageUrl = window.location.href;
        message = JSON.stringify({
          _dropboxjs_oauth_info: pageUrl
        });
        Dropbox.AuthDriver.BrowserBase.cleanupLocation();
        opener = window.opener;
        if (window.parent !== window.top) {
          opener || (opener = window.parent);
        }
        if (opener) {
          try {
            pageOrigin = window.location.origin || locationOrigin(pageUrl);
            opener.postMessage(message, pageOrigin);
            window.close();
          } catch (_error) {
            ieError = _error;
          }
          try {
            opener.Dropbox.AuthDriver.Popup.onMessage.dispatch(message);
            return window.close();
          } catch (_error) {
            frameError = _error;
          }
        }
      });
    };

    Popup.onMessage = new Dropbox.Util.EventSource;

    return Popup;

  })(Dropbox.AuthDriver.BrowserBase);

  Dropbox.AuthDriver.ChromeBase = (function(_super) {
    __extends(ChromeBase, _super);

    function ChromeBase(options) {
      ChromeBase.__super__.constructor.call(this, options);
      this.storageKey = "dropbox_js_" + this.scope + "_credentials";
    }

    ChromeBase.prototype.onAuthStepChange = function(client, callback) {
      switch (client.authStep) {
        case Dropbox.Client.RESET:
          return this.loadCredentials(function(credentials) {
            if (credentials) {
              client.setCredentials(credentials);
            }
            return callback();
          });
        case Dropbox.Client.DONE:
          return this.storeCredentials(client.credentials(), callback);
        case Dropbox.Client.SIGNED_OUT:
          return this.forgetCredentials(callback);
        case Dropbox.Client.ERROR:
          return this.forgetCredentials(callback);
        default:
          return callback();
      }
    };

    ChromeBase.prototype.url = function() {
      return this.receiverUrl;
    };

    ChromeBase.prototype.storeCredentials = function(credentials, callback) {
      var items;
      items = {};
      items[this.storageKey] = credentials;
      chrome.storage.local.set(items, callback);
      return this;
    };

    ChromeBase.prototype.loadCredentials = function(callback) {
      chrome.storage.local.get(this.storageKey, (function(_this) {
        return function(items) {
          return callback(items[_this.storageKey] || null);
        };
      })(this));
      return this;
    };

    ChromeBase.prototype.forgetCredentials = function(callback) {
      chrome.storage.local.remove(this.storageKey, callback);
      return this;
    };

    return ChromeBase;

  })(Dropbox.AuthDriver.BrowserBase);

  Dropbox.AuthDriver.ChromeApp = (function(_super) {
    __extends(ChromeApp, _super);

    function ChromeApp(options) {
      ChromeApp.__super__.constructor.call(this, options);
      this.receiverUrl = "https://" + chrome.runtime.id + ".chromiumapp.org/";
    }

    ChromeApp.prototype.doAuthorize = function(authUrl, stateParam, client, callback) {
      return chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, (function(_this) {
        return function(redirectUrl) {
          if (_this.locationStateParam(redirectUrl) === stateParam) {
            stateParam = false;
            return callback(Dropbox.Util.Oauth.queryParamsFromUrl(redirectUrl));
          }
        };
      })(this));
    };

    return ChromeApp;

  })(Dropbox.AuthDriver.ChromeBase);

  Dropbox.AuthDriver.ChromeExtension = (function(_super) {
    __extends(ChromeExtension, _super);

    function ChromeExtension(options) {
      var receiverPath;
      ChromeExtension.__super__.constructor.call(this, options);
      receiverPath = (options && options.receiverPath) || 'chrome_oauth_receiver.html';
      this.receiverUrl = chrome.runtime.getURL(receiverPath);
    }

    ChromeExtension.prototype.doAuthorize = function(authUrl, stateParam, client, callback) {
      var listener, oauthTab;
      oauthTab = null;
      listener = (function(_this) {
        return function(message, sender) {
          var receiverHref;
          if (sender && sender.tab) {
            if (sender.tab.url.substring(0, _this.receiverUrl.length) !== _this.receiverUrl) {
              return;
            }
          }
          if (!message.dropbox_oauth_receiver_href) {
            return;
          }
          receiverHref = message.dropbox_oauth_receiver_href;
          if (_this.locationStateParam(receiverHref) === stateParam) {
            stateParam = false;
            if (oauthTab) {
              chrome.tabs.remove(oauthTab.id);
            }
            chrome.runtime.onMessage.removeListener(listener);
            return callback(Dropbox.Util.Oauth.queryParamsFromUrl(receiverHref));
          }
        };
      })(this);
      chrome.runtime.onMessage.addListener(listener);
      return chrome.tabs.create({
        url: authUrl,
        active: true,
        pinned: false
      }, function(tab) {
        return oauthTab = tab;
      });
    };

    ChromeExtension.oauthReceiver = function() {
      return window.addEventListener('load', function() {
        var pageUrl;
        pageUrl = window.location.href;
        window.location.hash = '';
        chrome.runtime.sendMessage({
          dropbox_oauth_receiver_href: pageUrl
        });
        if (window.close) {
          return window.close();
        }
      });
    };

    return ChromeExtension;

  })(Dropbox.AuthDriver.ChromeBase);

  Dropbox.AuthDriver.Cordova = (function(_super) {
    __extends(Cordova, _super);

    function Cordova(options) {
      Cordova.__super__.constructor.call(this, options);
    }

    Cordova.prototype.url = function() {
      return 'https://www.dropbox.com/1/oauth2/redirect_receiver';
    };

    Cordova.prototype.doAuthorize = function(authUrl, stateParam, client, callback) {
      var authHost, browser, onEvent, promptPageLoaded, removed;
      browser = window.open(authUrl, '_blank', 'location=yes,closebuttoncaption=Cancel');
      promptPageLoaded = false;
      authHost = /^[^/]*\/\/[^/]*\//.exec(authUrl)[0];
      removed = false;
      onEvent = (function(_this) {
        return function(event) {
          if (event.url && _this.locationStateParam(event.url) === stateParam) {
            if (removed) {
              return;
            }
            browser.removeEventListener('loadstart', onEvent);
            browser.removeEventListener('loaderror', onEvent);
            browser.removeEventListener('loadstop', onEvent);
            browser.removeEventListener('exit', onEvent);
            removed = true;
            window.setTimeout((function() {
              return browser.close();
            }), 10);
            callback(Dropbox.Util.Oauth.queryParamsFromUrl(event.url));
            return;
          }
          if (event.type === 'exit') {
            if (removed) {
              return;
            }
            browser.removeEventListener('loadstart', onEvent);
            browser.removeEventListener('loaderror', onEvent);
            browser.removeEventListener('loadstop', onEvent);
            browser.removeEventListener('exit', onEvent);
            removed = true;
            callback(new AuthError('error=access_denied&error_description=User+closed+browser+window'));
          }
        };
      })(this);
      browser.addEventListener('loadstart', onEvent);
      browser.addEventListener('loaderror', onEvent);
      browser.addEventListener('loadstop', onEvent);
      return browser.addEventListener('exit', onEvent);
    };

    return Cordova;

  })(Dropbox.AuthDriver.BrowserBase);

  Dropbox.AuthDriver.NodeServer = (function() {
    function NodeServer(options) {
      this._port = (options != null ? options.port : void 0) || 8912;
      if (options != null ? options.tls : void 0) {
        this._tlsOptions = options.tls;
        if (typeof this._tlsOptions === 'string' || this._tlsOptions instanceof Buffer) {
          this._tlsOptions = {
            key: this._tlsOptions,
            cert: this._tlsOptions
          };
        }
      } else {
        this._tlsOptions = null;
      }
      this._fs = Dropbox.Env.require('fs');
      this._http = Dropbox.Env.require('http');
      this._https = Dropbox.Env.require('https');
      this._open = Dropbox.Env.require('open');
      this._callbacks = {};
      this._nodeUrl = Dropbox.Env.require('url');
      this.createApp();
    }

    NodeServer.prototype.authType = function() {
      return "code";
    };

    NodeServer.prototype.url = function() {
      var protocol;
      protocol = this._tlsOptions === null ? 'http' : 'https';
      return "" + protocol + "://localhost:" + this._port + "/oauth_callback";
    };

    NodeServer.prototype.doAuthorize = function(authUrl, stateParam, client, callback) {
      this._callbacks[stateParam] = callback;
      return this.openBrowser(authUrl);
    };

    NodeServer.prototype.openBrowser = function(url) {
      if (!url.match(/^https?:\/\//)) {
        throw new Error("Not a http/https URL: " + url);
      }
      if ('BROWSER' in process.env) {
        return this._open(url, process.env['BROWSER']);
      } else {
        return this._open(url);
      }
    };

    NodeServer.prototype.createApp = function() {
      if (this._tlsOptions) {
        this._app = this._https.createServer(this._tlsOptions, (function(_this) {
          return function(request, response) {
            return _this.doRequest(request, response);
          };
        })(this));
      } else {
        this._app = this._http.createServer((function(_this) {
          return function(request, response) {
            return _this.doRequest(request, response);
          };
        })(this));
      }
      return this._app.listen(this._port);
    };

    NodeServer.prototype.closeServer = function() {
      return this._app.close();
    };

    NodeServer.prototype.doRequest = function(request, response) {
      var data, stateParam, url;
      url = this._nodeUrl.parse(request.url, true);
      if (url.pathname === '/oauth_callback') {
        stateParam = url.query.state;
        if (this._callbacks[stateParam]) {
          this._callbacks[stateParam](url.query);
          delete this._callbacks[stateParam];
        }
      }
      data = '';
      request.on('data', function(dataFragment) {
        return data += dataFragment;
      });
      return request.on('end', (function(_this) {
        return function() {
          return _this.closeBrowser(response);
        };
      })(this));
    };

    NodeServer.prototype.closeBrowser = function(response) {
      var closeHtml;
      closeHtml = "<!doctype html>\n<script type=\"text/javascript\">window.close();</script>\n<p>Please close this window.</p>";
      response.writeHead(200, {
        'Content-Length': closeHtml.length,
        'Content-Type': 'text/html'
      });
      response.write(closeHtml);
      return response.end();
    };

    return NodeServer;

  })();

  Dropbox.AuthError = (function() {
    AuthError.prototype.code = null;

    AuthError.prototype.description = null;

    AuthError.prototype.uri = null;

    AuthError.ACCESS_DENIED = 'access_denied';

    AuthError.INVALID_REQUEST = 'invalid_request';

    AuthError.UNAUTHORIZED_CLIENT = 'unauthorized_client';

    AuthError.INVALID_GRANT = 'invalid_grant';

    AuthError.INVALID_SCOPE = 'invalid_scope';

    AuthError.UNSUPPORTED_GRANT_TYPE = 'unsupported_grant_type';

    AuthError.UNSUPPORTED_RESPONSE_TYPE = 'unsupported_response_type';

    AuthError.SERVER_ERROR = 'server_error';

    AuthError.TEMPORARILY_UNAVAILABLE = 'temporarily_unavailable';

    function AuthError(queryString) {
      var root;
      if (!queryString.error) {
        throw new Error("Not an OAuth 2.0 error: " + (JSON.stringify(queryString)));
      }
      if (typeof queryString.error === 'object' && queryString.error.error) {
        root = queryString.error;
      } else {
        root = queryString;
      }
      this.code = root.error;
      this.description = root.error_description || null;
      this.uri = root.error_uri || null;
    }

    AuthError.prototype.toString = function() {
      return "Dropbox OAuth error " + this.code + " :: " + this.description;
    };

    AuthError.prototype.inspect = function() {
      return this.toString();
    };

    return AuthError;

  })();

  Dropbox.Client = (function() {
    function Client(options) {
      this._serverRoot = options.server || this._defaultServerRoot();
      if ('maxApiServer' in options) {
        this._maxApiServer = options.maxApiServer;
      } else {
        this._maxApiServer = this._defaultMaxApiServer();
      }
      this._authServer = options.authServer || this._defaultAuthServer();
      this._fileServer = options.fileServer || this._defaultFileServer();
      this._downloadServer = options.downloadServer || this._defaultDownloadServer();
      this._notifyServer = options.notifyServer || this._defaultNotifyServer();
      this.onXhr = new Dropbox.Util.EventSource({
        cancelable: true
      });
      this.onError = new Dropbox.Util.EventSource;
      this.onAuthStepChange = new Dropbox.Util.EventSource;
      this._xhrOnErrorHandler = (function(_this) {
        return function(error, callback) {
          return _this._handleXhrError(error, callback);
        };
      })(this);
      this._oauth = new Dropbox.Util.Oauth(options);
      this._uid = options.uid || null;
      this.authStep = this._oauth.step();
      this._driver = null;
      this.authError = null;
      this._credentials = null;
      this.setupUrls();
    }

    Client.prototype.onXhr = null;

    Client.prototype.onError = null;

    Client.prototype.onAuthStepChange = null;

    Client.prototype.authDriver = function(driver) {
      this._driver = driver;
      return this;
    };

    Client.prototype.dropboxUid = function() {
      return this._uid;
    };

    Client.prototype.credentials = function() {
      if (!this._credentials) {
        this._computeCredentials();
      }
      return this._credentials;
    };

    Client.prototype.authenticate = function(options, callback) {
      var interactive, oldAuthStep, _fsmErrorStep, _fsmNextStep, _fsmStep;
      if (!callback && typeof options === 'function') {
        callback = options;
        options = null;
      }
      if (options && 'interactive' in options) {
        interactive = options.interactive;
      } else {
        interactive = true;
      }
      if (!(this._driver || this.authStep === DbxClient.DONE)) {
        Dropbox.AuthDriver.autoConfigure(this);
        if (!this._driver) {
          throw new Error('OAuth driver auto-configuration failed. Call authDriver.');
        }
      }
      if (this.authStep === DbxClient.ERROR) {
        throw new Error('Client got in an error state. Call reset() to reuse it!');
      }
      _fsmNextStep = (function(_this) {
        return function() {
          _this.authStep = _this._oauth.step();
          if (_this.authStep === DbxClient.ERROR) {
            _this.authError = _this._oauth.error();
          }
          _this._credentials = null;
          _this.onAuthStepChange.dispatch(_this);
          return _fsmStep();
        };
      })(this);
      _fsmErrorStep = (function(_this) {
        return function() {
          _this.authStep = DbxClient.ERROR;
          _this._credentials = null;
          _this.onAuthStepChange.dispatch(_this);
          return _fsmStep();
        };
      })(this);
      oldAuthStep = null;
      _fsmStep = (function(_this) {
        return function() {
          var authUrl;
          if (oldAuthStep !== _this.authStep) {
            oldAuthStep = _this.authStep;
            if (_this._driver && _this._driver.onAuthStepChange) {
              _this._driver.onAuthStepChange(_this, _fsmStep);
              return;
            }
          }
          switch (_this.authStep) {
            case DbxClient.RESET:
              if (!interactive) {
                if (callback) {
                  callback(null, _this);
                }
                return;
              }
              if (_this._driver.getStateParam) {
                _this._driver.getStateParam(function(stateParam) {
                  if (_this.client.authStep === DbxClient.RESET) {
                    _this._oauth.setAuthStateParam(stateParam);
                  }
                  return _fsmNextStep();
                });
              }
              _this._oauth.setAuthStateParam(Dropbox.Util.Oauth.randomAuthStateParam());
              return _fsmNextStep();
            case DbxClient.PARAM_SET:
              if (!interactive) {
                if (callback) {
                  callback(null, _this);
                }
                return;
              }
              authUrl = _this.authorizeUrl();
              return _this._driver.doAuthorize(authUrl, _this._oauth.authStateParam(), _this, function(queryParams) {
                _this._oauth.processRedirectParams(queryParams);
                if (queryParams.uid) {
                  _this._uid = queryParams.uid;
                }
                return _fsmNextStep();
              });
            case DbxClient.PARAM_LOADED:
              if (!_this._driver.resumeAuthorize) {
                _this._oauth.setAuthStateParam(_this._oauth.authStateParam());
                _fsmNextStep();
                return;
              }
              return _this._driver.resumeAuthorize(_this._oauth.authStateParam(), _this, function(queryParams) {
                _this._oauth.processRedirectParams(queryParams);
                if (queryParams.uid) {
                  _this._uid = queryParams.uid;
                }
                return _fsmNextStep();
              });
            case DbxClient.AUTHORIZED:
              return _this.getAccessToken(function(error, data) {
                if (error) {
                  _this.authError = error;
                  return _fsmErrorStep();
                } else {
                  _this._oauth.processRedirectParams(data);
                  _this._uid = data.uid;
                  return _fsmNextStep();
                }
              });
            case DbxClient.DONE:
              if (callback) {
                callback(null, _this);
              }
              break;
            case DbxClient.SIGNED_OUT:
              _this.authStep = DbxClient.RESET;
              _this.reset();
              return _fsmStep();
            case DbxClient.ERROR:
              if (callback) {
                callback(_this.authError, _this);
              }
          }
        };
      })(this);
      _fsmStep();
      return this;
    };

    Client.prototype.isAuthenticated = function() {
      return this.authStep === DbxClient.DONE;
    };

    Client.prototype.signOut = function(options, callback) {
      var stopOnXhrError, xhr;
      if (!callback && typeof options === 'function') {
        callback = options;
        options = null;
      }
      stopOnXhrError = options && options.mustInvalidate;
      if (this.authStep !== DbxClient.DONE) {
        throw new Error("This client doesn't have a user's token");
      }
      xhr = new Dropbox.Util.Xhr('POST', this._urls.signOut);
      xhr.signWithOauth(this._oauth);
      return this._dispatchXhr(xhr, (function(_this) {
        return function(error) {
          if (error) {
            if (error.status === Dropbox.ApiError.INVALID_TOKEN) {
              error = null;
            } else if (stopOnXhrError) {
              if (callback) {
                callback(error);
              }
              return;
            }
          }
          _this.authStep = DbxClient.RESET;
          _this.reset();
          _this.authStep = DbxClient.SIGNED_OUT;
          _this.onAuthStepChange.dispatch(_this);
          if (_this._driver && _this._driver.onAuthStepChange) {
            return _this._driver.onAuthStepChange(_this, function() {
              if (callback) {
                return callback(null);
              }
            });
          } else {
            if (callback) {
              return callback(null);
            }
          }
        };
      })(this));
    };

    Client.prototype.signOff = function(options, callback) {
      return this.signOut(options, callback);
    };

    Client.prototype.getAccountInfo = function(options, callback) {
      var httpCache, xhr;
      if ((!callback) && (typeof options === 'function')) {
        callback = options;
        options = null;
      }
      httpCache = false;
      if (options && options.httpCache) {
        httpCache = true;
      }
      xhr = new Dropbox.Util.Xhr('GET', this._urls.accountInfo);
      xhr.signWithOauth(this._oauth, httpCache);
      return this._dispatchXhr(xhr, function(error, accountData) {
        return callback(error, Dropbox.AccountInfo.parse(accountData), accountData);
      });
    };

    Client.prototype.getUserInfo = function(options, callback) {
      return this.getAccountInfo(options, callback);
    };

    Client.prototype.readFile = function(path, options, callback) {
      var httpCache, params, rangeEnd, rangeHeader, rangeStart, responseType, xhr;
      if ((!callback) && (typeof options === 'function')) {
        callback = options;
        options = null;
      }
      params = {};
      responseType = 'text';
      rangeHeader = null;
      httpCache = false;
      if (options) {
        if (options.versionTag) {
          params.rev = options.versionTag;
        } else if (options.rev) {
          params.rev = options.rev;
        }
        if (options.arrayBuffer) {
          responseType = 'arraybuffer';
        } else if (options.blob) {
          responseType = 'blob';
        } else if (options.buffer) {
          responseType = 'buffer';
        } else if (options.binary) {
          responseType = 'b';
        }
        if (options.length) {
          if (options.start != null) {
            rangeStart = options.start;
            rangeEnd = options.start + options.length - 1;
          } else {
            rangeStart = '';
            rangeEnd = options.length;
          }
          rangeHeader = "bytes=" + rangeStart + "-" + rangeEnd;
        } else if (options.start != null) {
          rangeHeader = "bytes=" + options.start + "-";
        }
        if (options.httpCache) {
          httpCache = true;
        }
      }
      xhr = new Dropbox.Util.Xhr('GET', "" + this._urls.getFile + "/" + (this._urlEncodePath(path)));
      xhr.setParams(params).signWithOauth(this._oauth, httpCache);
      xhr.setResponseType(responseType);
      if (rangeHeader) {
        if (rangeHeader) {
          xhr.setHeader('Range', rangeHeader);
        }
        xhr.reportResponseHeaders();
      }
      return this._dispatchXhr(xhr, function(error, data, metadata, headers) {
        var rangeInfo;
        if (headers) {
          rangeInfo = Dropbox.Http.RangeInfo.parse(headers['content-range']);
        } else {
          rangeInfo = null;
        }
        return callback(error, data, Dropbox.File.Stat.parse(metadata), rangeInfo);
      });
    };

    Client.prototype.writeFile = function(path, data, options, callback) {
      var useForm;
      if ((!callback) && (typeof options === 'function')) {
        callback = options;
        options = null;
      }
      useForm = Dropbox.Util.Xhr.canSendForms && typeof data === 'object';
      if (useForm) {
        return this._writeFileUsingForm(path, data, options, callback);
      } else {
        return this._writeFileUsingPut(path, data, options, callback);
      }
    };

    Client.prototype._writeFileUsingForm = function(path, data, options, callback) {
      var fileName, params, slashIndex, xhr;
      slashIndex = path.lastIndexOf('/');
      if (slashIndex === -1) {
        fileName = path;
        path = '';
      } else {
        fileName = path.substring(slashIndex);
        path = path.substring(0, slashIndex);
      }
      params = {
        file: fileName
      };
      if (options) {
        if (options.noOverwrite) {
          params.overwrite = 'false';
        }
        if (options.lastVersionTag) {
          params.parent_rev = options.lastVersionTag;
        } else if (options.parentRev || options.parent_rev) {
          params.parent_rev = options.parentRev || options.parent_rev;
        }
      }
      xhr = new Dropbox.Util.Xhr('POST', "" + this._urls.postFile + "/" + (this._urlEncodePath(path)));
      xhr.setParams(params).signWithOauth(this._oauth).setFileField('file', fileName, data, 'application/octet-stream');
      delete params.file;
      return this._dispatchXhr(xhr, function(error, metadata) {
        if (callback) {
          return callback(error, Dropbox.File.Stat.parse(metadata));
        }
      });
    };

    Client.prototype._writeFileUsingPut = function(path, data, options, callback) {
      var params, xhr;
      params = {};
      if (options) {
        if (options.noOverwrite) {
          params.overwrite = 'false';
        }
        if (options.lastVersionTag) {
          params.parent_rev = options.lastVersionTag;
        } else if (options.parentRev || options.parent_rev) {
          params.parent_rev = options.parentRev || options.parent_rev;
        }
      }
      xhr = new Dropbox.Util.Xhr('POST', "" + this._urls.putFile + "/" + (this._urlEncodePath(path)));
      xhr.setBody(data).setParams(params).signWithOauth(this._oauth);
      return this._dispatchXhr(xhr, function(error, metadata) {
        if (callback) {
          return callback(error, Dropbox.File.Stat.parse(metadata));
        }
      });
    };

    Client.prototype.resumableUploadStep = function(data, cursor, callback) {
      var params, xhr;
      if (cursor) {
        params = {
          offset: cursor.offset
        };
        if (cursor.tag) {
          params.upload_id = cursor.tag;
        }
      } else {
        params = {
          offset: 0
        };
      }
      xhr = new Dropbox.Util.Xhr('POST', this._urls.chunkedUpload);
      xhr.setBody(data).setParams(params).signWithOauth(this._oauth);
      return this._dispatchXhr(xhr, function(error, cursor) {
        if (error && error.status === Dropbox.ApiError.INVALID_PARAM && error.response && error.response.upload_id && error.response.offset) {
          return callback(null, Dropbox.Http.UploadCursor.parse(error.response));
        } else {
          return callback(error, Dropbox.Http.UploadCursor.parse(cursor));
        }
      });
    };

    Client.prototype.resumableUploadFinish = function(path, cursor, options, callback) {
      var params, xhr;
      if ((!callback) && (typeof options === 'function')) {
        callback = options;
        options = null;
      }
      params = {
        upload_id: cursor.tag
      };
      if (options) {
        if (options.lastVersionTag) {
          params.parent_rev = options.lastVersionTag;
        } else if (options.parentRev || options.parent_rev) {
          params.parent_rev = options.parentRev || options.parent_rev;
        }
        if (options.noOverwrite) {
          params.overwrite = 'false';
        }
      }
      xhr = new Dropbox.Util.Xhr('POST', "" + this._urls.commitChunkedUpload + "/" + (this._urlEncodePath(path)));
      xhr.setParams(params).signWithOauth(this._oauth);
      return this._dispatchXhr(xhr, function(error, metadata) {
        if (callback) {
          return callback(error, Dropbox.File.Stat.parse(metadata));
        }
      });
    };

    Client.prototype.stat = function(path, options, callback) {
      var httpCache, params, xhr;
      if ((!callback) && (typeof options === 'function')) {
        callback = options;
        options = null;
      }
      params = {};
      httpCache = false;
      if (options) {
        if (options.versionTag) {
          params.rev = options.versionTag;
        } else if (options.rev) {
          params.rev = options.rev;
        }
        if (options.contentHash) {
          params.hash = options.contentHash;
        } else if (options.hash) {
          params.hash = options.hash;
        }
        if (options.removed || options.deleted) {
          params.include_deleted = 'true';
        }
        if (options.readDir) {
          params.list = 'true';
          if (options.readDir !== true) {
            params.file_limit = options.readDir.toString();
          }
        }
        if (options.cacheHash) {
          params.hash = options.cacheHash;
        }
        if (options.httpCache) {
          httpCache = true;
        }
      }
      params.include_deleted || (params.include_deleted = 'false');
      params.list || (params.list = 'false');
      xhr = new Dropbox.Util.Xhr('GET', "" + this._urls.metadata + "/" + (this._urlEncodePath(path)));
      xhr.setParams(params).signWithOauth(this._oauth, httpCache);
      return this._dispatchXhr(xhr, function(error, metadata) {
        var entries, entry, stat;
        stat = Dropbox.File.Stat.parse(metadata);
        if (metadata != null ? metadata.contents : void 0) {
          entries = (function() {
            var _i, _len, _ref, _results;
            _ref = metadata.contents;
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              entry = _ref[_i];
              _results.push(Dropbox.File.Stat.parse(entry));
            }
            return _results;
          })();
        } else {
          entries = void 0;
        }
        return callback(error, stat, entries);
      });
    };

    Client.prototype.readdir = function(path, options, callback) {
      var statOptions;
      if ((!callback) && (typeof options === 'function')) {
        callback = options;
        options = null;
      }
      statOptions = {
        readDir: true
      };
      if (options) {
        if (options.limit != null) {
          statOptions.readDir = options.limit;
        }
        if (options.versionTag) {
          statOptions.versionTag = options.versionTag;
        } else if (options.rev) {
          statOptions.versionTag = options.rev;
        }
        if (options.contentHash) {
          statOptions.contentHash = options.contentHash;
        } else if (options.hash) {
          statOptions.contentHash = options.hash;
        }
        if (options.removed || options.deleted) {
          statOptions.removed = options.removed || options.deleted;
        }
        if (options.httpCache) {
          statOptions.httpCache = options.httpCache;
        }
      }
      return this.stat(path, statOptions, function(error, stat, entry_stats) {
        var entries, entry_stat;
        if (entry_stats) {
          entries = (function() {
            var _i, _len, _results;
            _results = [];
            for (_i = 0, _len = entry_stats.length; _i < _len; _i++) {
              entry_stat = entry_stats[_i];
              _results.push(entry_stat.name);
            }
            return _results;
          })();
        } else {
          entries = null;
        }
        return callback(error, entries, stat, entry_stats);
      });
    };

    Client.prototype.metadata = function(path, options, callback) {
      return this.stat(path, options, callback);
    };

    Client.prototype.makeUrl = function(path, options, callback) {
      var isDirect, params, url, useDownloadHack, xhr;
      if ((!callback) && (typeof options === 'function')) {
        callback = options;
        options = null;
      }
      if (options && (options['long'] || options.longUrl || options.downloadHack)) {
        params = {
          short_url: 'false'
        };
      } else {
        params = {};
      }
      path = this._urlEncodePath(path);
      url = "" + this._urls.shares + "/" + path;
      isDirect = false;
      useDownloadHack = false;
      if (options) {
        if (options.downloadHack) {
          isDirect = true;
          useDownloadHack = true;
        } else if (options.download) {
          isDirect = true;
          url = "" + this._urls.media + "/" + path;
        }
      }
      xhr = new Dropbox.Util.Xhr('POST', url).setParams(params).signWithOauth(this._oauth);
      return this._dispatchXhr(xhr, (function(_this) {
        return function(error, urlData) {
          if (useDownloadHack && (urlData != null ? urlData.url : void 0)) {
            urlData.url = urlData.url.replace(_this._authServer, _this._downloadServer);
          }
          return callback(error, Dropbox.File.ShareUrl.parse(urlData, isDirect));
        };
      })(this));
    };

    Client.prototype.history = function(path, options, callback) {
      var httpCache, params, xhr;
      if ((!callback) && (typeof options === 'function')) {
        callback = options;
        options = null;
      }
      params = {};
      httpCache = false;
      if (options) {
        if (options.limit != null) {
          params.rev_limit = options.limit;
        }
        if (options.httpCache) {
          httpCache = true;
        }
      }
      xhr = new Dropbox.Util.Xhr('GET', "" + this._urls.revisions + "/" + (this._urlEncodePath(path)));
      xhr.setParams(params).signWithOauth(this._oauth, httpCache);
      return this._dispatchXhr(xhr, function(error, versions) {
        var metadata, stats;
        if (versions) {
          stats = (function() {
            var _i, _len, _results;
            _results = [];
            for (_i = 0, _len = versions.length; _i < _len; _i++) {
              metadata = versions[_i];
              _results.push(Dropbox.File.Stat.parse(metadata));
            }
            return _results;
          })();
        } else {
          stats = void 0;
        }
        return callback(error, stats);
      });
    };

    Client.prototype.revisions = function(path, options, callback) {
      return this.history(path, options, callback);
    };

    Client.prototype.thumbnailUrl = function(path, options) {
      var xhr;
      xhr = this.thumbnailXhr(path, options);
      return xhr.addOauthParams(this._oauth).paramsToUrl().url;
    };

    Client.prototype.readThumbnail = function(path, options, callback) {
      var responseType, xhr;
      if ((!callback) && (typeof options === 'function')) {
        callback = options;
        options = null;
      }
      responseType = 'b';
      if (options) {
        if (options.blob) {
          responseType = 'blob';
        }
        if (options.arrayBuffer) {
          responseType = 'arraybuffer';
        }
        if (options.buffer) {
          responseType = 'buffer';
        }
      }
      xhr = this.thumbnailXhr(path, options);
      xhr.setResponseType(responseType).signWithOauth(this._oauth);
      return this._dispatchXhr(xhr, function(error, data, metadata) {
        return callback(error, data, Dropbox.File.Stat.parse(metadata));
      });
    };

    Client.prototype.thumbnailXhr = function(path, options) {
      var params, xhr;
      params = {};
      if (options) {
        if (options.format) {
          params.format = options.format;
        } else if (options.png) {
          params.format = 'png';
        }
        if (options.size) {
          params.size = options.size;
        }
      }
      xhr = new Dropbox.Util.Xhr('GET', "" + this._urls.thumbnails + "/" + (this._urlEncodePath(path)));
      return xhr.setParams(params);
    };

    Client.prototype.revertFile = function(path, versionTag, callback) {
      var xhr;
      xhr = new Dropbox.Util.Xhr('POST', "" + this._urls.restore + "/" + (this._urlEncodePath(path)));
      xhr.setParams({
        rev: versionTag
      }).signWithOauth(this._oauth);
      return this._dispatchXhr(xhr, function(error, metadata) {
        if (callback) {
          return callback(error, Dropbox.File.Stat.parse(metadata));
        }
      });
    };

    Client.prototype.restore = function(path, versionTag, callback) {
      return this.revertFile(path, versionTag, callback);
    };

    Client.prototype.findByName = function(path, namePattern, options, callback) {
      var httpCache, params, xhr;
      if ((!callback) && (typeof options === 'function')) {
        callback = options;
        options = null;
      }
      params = {
        query: namePattern
      };
      httpCache = false;
      if (options) {
        if (options.limit != null) {
          params.file_limit = options.limit;
        }
        if (options.removed || options.deleted) {
          params.include_deleted = true;
        }
        if (options.httpCache) {
          httpCache = true;
        }
      }
      xhr = new Dropbox.Util.Xhr('GET', "" + this._urls.search + "/" + (this._urlEncodePath(path)));
      xhr.setParams(params).signWithOauth(this._oauth, httpCache);
      return this._dispatchXhr(xhr, function(error, results) {
        var metadata, stats;
        if (results) {
          stats = (function() {
            var _i, _len, _results;
            _results = [];
            for (_i = 0, _len = results.length; _i < _len; _i++) {
              metadata = results[_i];
              _results.push(Dropbox.File.Stat.parse(metadata));
            }
            return _results;
          })();
        } else {
          stats = void 0;
        }
        return callback(error, stats);
      });
    };

    Client.prototype.search = function(path, namePattern, options, callback) {
      return this.findByName(path, namePattern, options, callback);
    };

    Client.prototype.makeCopyReference = function(path, callback) {
      var xhr;
      xhr = new Dropbox.Util.Xhr('GET', "" + this._urls.copyRef + "/" + (this._urlEncodePath(path)));
      xhr.signWithOauth(this._oauth);
      return this._dispatchXhr(xhr, function(error, refData) {
        return callback(error, Dropbox.File.CopyReference.parse(refData));
      });
    };

    Client.prototype.copyRef = function(path, callback) {
      return this.makeCopyReference(path, callback);
    };

    Client.prototype.pullChanges = function(cursor, callback) {
      var params, xhr;
      if ((!callback) && (typeof cursor === 'function')) {
        callback = cursor;
        cursor = null;
      }
      if (cursor) {
        if (cursor.cursorTag) {
          params = {
            cursor: cursor.cursorTag
          };
        } else {
          params = {
            cursor: cursor
          };
        }
      } else {
        params = {};
      }
      xhr = new Dropbox.Util.Xhr('POST', this._urls.delta);
      xhr.setParams(params).signWithOauth(this._oauth);
      return this._dispatchXhr(xhr, function(error, deltaInfo) {
        return callback(error, Dropbox.Http.PulledChanges.parse(deltaInfo));
      });
    };

    Client.prototype.delta = function(cursor, callback) {
      return this.pullChanges(cursor, callback);
    };

    Client.prototype.pollForChanges = function(cursor, options, callback) {
      var params, xhr;
      if ((!callback) && (typeof options === 'function')) {
        callback = options;
        options = null;
      }
      if (cursor.cursorTag) {
        params = {
          cursor: cursor.cursorTag
        };
      } else {
        params = {
          cursor: cursor
        };
      }
      if (options && 'timeout' in options) {
        params.timeout = options.timeout;
      }
      xhr = new Dropbox.Util.Xhr('GET', this._urls.longpollDelta);
      xhr.setParams(params);
      return this._dispatchXhr(xhr, function(error, response) {
        var jsonError;
        if (typeof response === 'string') {
          try {
            response = JSON.parse(response);
          } catch (_error) {
            jsonError = _error;
            response = null;
          }
        }
        return callback(error, Dropbox.Http.PollResult.parse(response));
      });
    };

    Client.prototype.mkdir = function(path, callback) {
      var xhr;
      xhr = new Dropbox.Util.Xhr('POST', this._urls.fileopsCreateFolder);
      xhr.setParams({
        root: 'auto',
        path: this._normalizePath(path)
      }).signWithOauth(this._oauth);
      return this._dispatchXhr(xhr, function(error, metadata) {
        if (callback) {
          return callback(error, Dropbox.File.Stat.parse(metadata));
        }
      });
    };

    Client.prototype.remove = function(path, callback) {
      var xhr;
      xhr = new Dropbox.Util.Xhr('POST', this._urls.fileopsDelete);
      xhr.setParams({
        root: 'auto',
        path: this._normalizePath(path)
      }).signWithOauth(this._oauth);
      return this._dispatchXhr(xhr, function(error, metadata) {
        if (callback) {
          return callback(error, Dropbox.File.Stat.parse(metadata));
        }
      });
    };

    Client.prototype.unlink = function(path, callback) {
      return this.remove(path, callback);
    };

    Client.prototype["delete"] = function(path, callback) {
      return this.remove(path, callback);
    };

    Client.prototype.copy = function(from, toPath, callback) {
      var options, params, xhr;
      if ((!callback) && (typeof options === 'function')) {
        callback = options;
        options = null;
      }
      params = {
        root: 'auto',
        to_path: this._normalizePath(toPath)
      };
      if (from instanceof Dropbox.File.CopyReference) {
        params.from_copy_ref = from.tag;
      } else {
        params.from_path = this._normalizePath(from);
      }
      xhr = new Dropbox.Util.Xhr('POST', this._urls.fileopsCopy);
      xhr.setParams(params).signWithOauth(this._oauth);
      return this._dispatchXhr(xhr, function(error, metadata) {
        if (callback) {
          return callback(error, Dropbox.File.Stat.parse(metadata));
        }
      });
    };

    Client.prototype.move = function(fromPath, toPath, callback) {
      var options, xhr;
      if ((!callback) && (typeof options === 'function')) {
        callback = options;
        options = null;
      }
      xhr = new Dropbox.Util.Xhr('POST', this._urls.fileopsMove);
      xhr.setParams({
        root: 'auto',
        from_path: this._normalizePath(fromPath),
        to_path: this._normalizePath(toPath)
      }).signWithOauth(this._oauth);
      return this._dispatchXhr(xhr, function(error, metadata) {
        if (callback) {
          return callback(error, Dropbox.File.Stat.parse(metadata));
        }
      });
    };

    Client.prototype.appInfo = function(appKey, callback) {
      var xhr;
      if ((!callback) && (typeof appKey === 'function')) {
        callback = appKey;
        appKey = this._oauth.credentials().key;
      }
      xhr = new Dropbox.Util.Xhr('GET', this._urls.appsInfo);
      xhr.setParams({
        app_key: appKey
      });
      return this._dispatchXhr(xhr, function(error, appInfo) {
        return callback(error, Dropbox.Http.AppInfo.parse(appInfo, appKey));
      });
    };

    Client.prototype.isAppDeveloper = function(userId, appKey, callback) {
      var xhr;
      if ((typeof userId === 'object') && ('uid' in userId)) {
        userId = userId.uid;
      }
      if ((!callback) && (typeof appKey === 'function')) {
        callback = appKey;
        appKey = this._oauth.credentials().key;
      } else if ((typeof appKey === 'object') && ('key' in appKey)) {
        appKey = appKey.key;
      }
      xhr = new Dropbox.Util.Xhr('GET', this._urls.appsCheckDeveloper);
      xhr.setParams({
        app_key: appKey,
        uid: userId
      });
      return this._dispatchXhr(xhr, function(error, response) {
        if (response) {
          return callback(error, response.is_developer);
        } else {
          return callback(error);
        }
      });
    };

    Client.prototype.hasOauthRedirectUri = function(redirectUri, appKey, callback) {
      var xhr;
      if ((!callback) && (typeof appKey === 'function')) {
        callback = appKey;
        appKey = this._oauth.credentials().key;
      } else if ((typeof appKey === 'object') && ('key' in appKey)) {
        appKey = appKey.key;
      }
      xhr = new Dropbox.Util.Xhr('GET', this._urls.appsCheckRedirectUri);
      xhr.setParams({
        app_key: appKey,
        redirect_uri: redirectUri
      });
      return this._dispatchXhr(xhr, function(error, response) {
        if (response) {
          return callback(error, response.has_redirect_uri);
        } else {
          return callback(error);
        }
      });
    };

    Client.prototype.reset = function() {
      var oldAuthStep;
      this._uid = null;
      this._oauth.reset();
      oldAuthStep = this.authStep;
      this.authStep = this._oauth.step();
      if (oldAuthStep !== this.authStep) {
        this.onAuthStepChange.dispatch(this);
      }
      this.authError = null;
      this._credentials = null;
      return this;
    };

    Client.prototype.setCredentials = function(credentials) {
      var oldAuthStep;
      oldAuthStep = this.authStep;
      this._oauth.setCredentials(credentials);
      this.authStep = this._oauth.step();
      this._uid = credentials.uid || null;
      this.authError = null;
      this._credentials = null;
      if (oldAuthStep !== this.authStep) {
        this.onAuthStepChange.dispatch(this);
      }
      return this;
    };

    Client.prototype.appHash = function() {
      return this._oauth.appHash();
    };

    Client.prototype.setupUrls = function() {
      this._apiServer = this._chooseApiServer();
      return this._urls = {
        authorize: "" + this._authServer + "/1/oauth2/authorize",
        token: "" + this._apiServer + "/1/oauth2/token",
        signOut: "" + this._apiServer + "/1/unlink_access_token",
        accountInfo: "" + this._apiServer + "/1/account/info",
        getFile: "" + this._fileServer + "/1/files/auto",
        postFile: "" + this._fileServer + "/1/files/auto",
        putFile: "" + this._fileServer + "/1/files_put/auto",
        metadata: "" + this._apiServer + "/1/metadata/auto",
        delta: "" + this._apiServer + "/1/delta",
        longpollDelta: "" + this._notifyServer + "/1/longpoll_delta",
        revisions: "" + this._apiServer + "/1/revisions/auto",
        restore: "" + this._apiServer + "/1/restore/auto",
        search: "" + this._apiServer + "/1/search/auto",
        shares: "" + this._apiServer + "/1/shares/auto",
        media: "" + this._apiServer + "/1/media/auto",
        copyRef: "" + this._apiServer + "/1/copy_ref/auto",
        thumbnails: "" + this._fileServer + "/1/thumbnails/auto",
        chunkedUpload: "" + this._fileServer + "/1/chunked_upload",
        commitChunkedUpload: "" + this._fileServer + "/1/commit_chunked_upload/auto",
        fileopsCopy: "" + this._apiServer + "/1/fileops/copy",
        fileopsCreateFolder: "" + this._apiServer + "/1/fileops/create_folder",
        fileopsDelete: "" + this._apiServer + "/1/fileops/delete",
        fileopsMove: "" + this._apiServer + "/1/fileops/move",
        appsInfo: "" + this._apiServer + "/1/apps/info",
        appsCheckDeveloper: "" + this._apiServer + "/1/apps/check_developer",
        appsCheckRedirectUri: "" + this._apiServer + "/1/apps/check_redirect_uri"
      };
    };

    Client.prototype._chooseApiServer = function() {
      var serverId, serverNumber;
      serverNumber = Math.floor(Math.random() * (this._maxApiServer + 1));
      serverId = serverNumber === 0 ? '' : serverNumber.toString();
      return this._serverRoot.replace('$', serverId);
    };

    Client.prototype.authStep = null;

    Client.ERROR = 0;

    Client.RESET = 1;

    Client.PARAM_SET = 2;

    Client.PARAM_LOADED = 3;

    Client.AUTHORIZED = 4;

    Client.DONE = 5;

    Client.SIGNED_OUT = 6;

    Client.prototype._urlEncodePath = function(path) {
      return Dropbox.Util.Xhr.urlEncodeValue(this._normalizePath(path)).replace(/%2F/gi, '/');
    };

    Client.prototype._normalizePath = function(path) {
      var i;
      if (path.substring(0, 1) === '/') {
        i = 1;
        while (path.substring(i, i + 1) === '/') {
          i += 1;
        }
        return path.substring(i);
      } else {
        return path;
      }
    };

    Client.prototype.authorizeUrl = function() {
      var params;
      params = this._oauth.authorizeUrlParams(this._driver.authType(), this._driver.url());
      return this._urls.authorize + "?" + Dropbox.Util.Xhr.urlEncode(params);
    };

    Client.prototype.getAccessToken = function(callback) {
      var params, xhr;
      params = this._oauth.accessTokenParams(this._driver.url());
      xhr = new Dropbox.Util.Xhr('POST', this._urls.token).setParams(params).addOauthParams(this._oauth);
      return this._dispatchXhr(xhr, function(error, data) {
        if (error && error.status === Dropbox.ApiError.INVALID_PARAM && error.response && error.response.error) {
          error = new Dropbox.AuthError(error.response);
        }
        return callback(error, data);
      });
    };

    Client.prototype._dispatchXhr = function(xhr, callback) {
      var nativeXhr;
      xhr.setCallback(callback);
      xhr.onError = this._xhrOnErrorHandler;
      xhr.prepare();
      nativeXhr = xhr.xhr;
      if (this.onXhr.dispatch(xhr)) {
        xhr.send();
      }
      return nativeXhr;
    };

    Client.prototype._handleXhrError = function(error, callback) {
      if (error.status === Dropbox.ApiError.INVALID_TOKEN && this.authStep === DbxClient.DONE) {
        this.authError = error;
        this.authStep = DbxClient.ERROR;
        this.onAuthStepChange.dispatch(this);
        if (this._driver && this._driver.onAuthStepChange) {
          this._driver.onAuthStepChange(this, (function(_this) {
            return function() {
              _this.onError.dispatch(error);
              return callback(error);
            };
          })(this));
          return null;
        }
      }
      this.onError.dispatch(error);
      callback(error);
    };

    Client.prototype._defaultServerRoot = function() {
      return 'https://api$.dropbox.com';
    };

    Client.prototype._defaultAuthServer = function() {
      return this._serverRoot.replace('api$', 'www');
    };

    Client.prototype._defaultFileServer = function() {
      return this._serverRoot.replace('api$', 'api-content');
    };

    Client.prototype._defaultDownloadServer = function() {
      return 'https://dl.dropboxusercontent.com';
    };

    Client.prototype._defaultNotifyServer = function() {
      return this._serverRoot.replace('api$', 'api-notify');
    };

    Client.prototype._defaultMaxApiServer = function() {
      return 30;
    };

    Client.prototype._computeCredentials = function() {
      var value;
      value = this._oauth.credentials();
      if (this._uid) {
        value.uid = this._uid;
      }
      if (this._serverRoot !== this._defaultServerRoot()) {
        value.server = this._serverRoot;
      }
      if (this._maxApiServer !== this._defaultMaxApiServer()) {
        value.maxApiServer = this._maxApiServer;
      }
      if (this._authServer !== this._defaultAuthServer()) {
        value.authServer = this._authServer;
      }
      if (this._fileServer !== this._defaultFileServer()) {
        value.fileServer = this._fileServer;
      }
      if (this._downloadServer !== this._defaultDownloadServer()) {
        value.downloadServer = this._downloadServer;
      }
      if (this._notifyServer !== this._defaultNotifyServer()) {
        value.notifyServer = this._notifyServer;
      }
      this._credentials = value;
    };

    return Client;

  })();

  DbxClient = Dropbox.Client;

  Dropbox.File.ShareUrl = (function() {
    ShareUrl.parse = function(urlData, isDirect) {
      if (urlData && typeof urlData === 'object') {
        return new Dropbox.File.ShareUrl(urlData, isDirect);
      } else {
        return urlData;
      }
    };

    ShareUrl.prototype.url = null;

    ShareUrl.prototype.expiresAt = null;

    ShareUrl.prototype.isDirect = null;

    ShareUrl.prototype.isPreview = null;

    ShareUrl.prototype.toJSON = function() {
      return this._json || (this._json = {
        url: this.url,
        expires: this.expiresAt.toUTCString(),
        direct: this.isDirect
      });
    };

    ShareUrl.prototype.json = function() {
      return this.toJSON();
    };

    function ShareUrl(urlData, isDirect) {
      this.url = urlData.url;
      this.expiresAt = Dropbox.Util.parseDate(urlData.expires);
      if (isDirect === true) {
        this.isDirect = true;
      } else if (isDirect === false) {
        this.isDirect = false;
      } else {
        if ('direct' in urlData) {
          this.isDirect = urlData.direct;
        } else {
          this.isDirect = Date.now() - this.expiresAt <= 86400000;
        }
      }
      this.isPreview = !this.isDirect;
      this._json = null;
    }

    return ShareUrl;

  })();

  Dropbox.File.CopyReference = (function() {
    CopyReference.parse = function(refData) {
      if (refData && (typeof refData === 'object' || typeof refData === 'string')) {
        return new Dropbox.File.CopyReference(refData);
      } else {
        return refData;
      }
    };

    CopyReference.prototype.tag = null;

    CopyReference.prototype.expiresAt = null;

    CopyReference.prototype.toJSON = function() {
      return this._json || (this._json = {
        copy_ref: this.tag,
        expires: this.expiresAt.toUTCString()
      });
    };

    CopyReference.prototype.json = function() {
      return this.toJSON();
    };

    function CopyReference(refData) {
      if (typeof refData === 'object') {
        this.tag = refData.copy_ref;
        this.expiresAt = Dropbox.Util.parseDate(refData.expires);
        this._json = refData;
      } else {
        this.tag = refData;
        this.expiresAt = new Date(Math.ceil(Date.now() / 1000) * 1000);
        this._json = null;
      }
    }

    return CopyReference;

  })();

  Dropbox.File.Stat = (function() {
    Stat.parse = function(metadata) {
      if (metadata && typeof metadata === 'object') {
        return new Dropbox.File.Stat(metadata);
      } else {
        return metadata;
      }
    };

    Stat.prototype.path = null;

    Stat.prototype.name = null;

    Stat.prototype.inAppFolder = null;

    Stat.prototype.isFolder = null;

    Stat.prototype.isFile = null;

    Stat.prototype.isRemoved = null;

    Stat.prototype.typeIcon = null;

    Stat.prototype.versionTag = null;

    Stat.prototype.contentHash = null;

    Stat.prototype.mimeType = null;

    Stat.prototype.size = null;

    Stat.prototype.humanSize = null;

    Stat.prototype.hasThumbnail = null;

    Stat.prototype.modifiedAt = null;

    Stat.prototype.clientModifiedAt = null;

    Stat.prototype.toJSON = function() {
      return this._json;
    };

    Stat.prototype.json = function() {
      return this.toJSON();
    };

    function Stat(metadata) {
      var lastIndex, nameSlash, _ref, _ref1;
      this._json = metadata;
      this.path = metadata.path;
      if (this.path.substring(0, 1) !== '/') {
        this.path = '/' + this.path;
      }
      lastIndex = this.path.length - 1;
      if (lastIndex >= 0 && this.path.substring(lastIndex) === '/') {
        this.path = this.path.substring(0, lastIndex);
      }
      nameSlash = this.path.lastIndexOf('/');
      this.name = this.path.substring(nameSlash + 1);
      this.isFolder = metadata.is_dir || false;
      this.isFile = !this.isFolder;
      this.isRemoved = metadata.is_deleted || false;
      this.typeIcon = metadata.icon;
      if ((_ref = metadata.modified) != null ? _ref.length : void 0) {
        this.modifiedAt = Dropbox.Util.parseDate(metadata.modified);
      } else {
        this.modifiedAt = null;
      }
      if ((_ref1 = metadata.client_mtime) != null ? _ref1.length : void 0) {
        this.clientModifiedAt = Dropbox.Util.parseDate(metadata.client_mtime);
      } else {
        this.clientModifiedAt = null;
      }
      switch (metadata.root) {
        case 'dropbox':
          this.inAppFolder = false;
          break;
        case 'app_folder':
          this.inAppFolder = true;
          break;
        default:
          this.inAppFolder = null;
      }
      this.size = metadata.bytes || 0;
      this.humanSize = metadata.size || '';
      this.hasThumbnail = metadata.thumb_exists || false;
      this.versionTag = metadata.rev;
      this.contentHash = metadata.hash || null;
      if (this.isFolder) {
        this.mimeType = metadata.mime_type || 'inode/directory';
      } else {
        this.mimeType = metadata.mime_type || 'application/octet-stream';
      }
    }

    return Stat;

  })();

  Dropbox.Http.AppInfo = (function() {
    AppInfo.parse = function(appInfo, appKey) {
      if (appInfo) {
        return new Dropbox.Http.AppInfo(appInfo, appKey);
      } else {
        return appInfo;
      }
    };

    AppInfo.prototype.name = void 0;

    AppInfo.prototype.key = void 0;

    AppInfo.prototype.canUseDatastores = void 0;

    AppInfo.prototype.canUseFiles = void 0;

    AppInfo.prototype.hasAppFolder = void 0;

    AppInfo.prototype.canUseFullDropbox = void 0;

    AppInfo.prototype.icon = function(width, height) {
      height || (height = width);
      return this._icons["" + width + "x" + height] || null;
    };

    AppInfo.ICON_SMALL = 64;

    AppInfo.ICON_LARGE = 256;

    function AppInfo(appInfo, appKey) {
      var permissions;
      this.name = appInfo.name;
      this._icons = appInfo.icons;
      permissions = appInfo.permissions || {};
      this.canUseDatastores = !!permissions.datastores;
      this.canUseFiles = !!permissions.files;
      this.canUseFullDropbox = permissions.files === 'full_dropbox';
      this.hasAppFolder = permissions.files === 'app_folder';
      if (appKey) {
        this.key = appKey;
      } else {
        this.key = appInfo.key || null;
      }
    }

    return AppInfo;

  })();

  Dropbox.Http.PollResult = (function() {
    PollResult.parse = function(response) {
      if (response) {
        return new Dropbox.Http.PollResult(response);
      } else {
        return response;
      }
    };

    PollResult.prototype.hasChanges = void 0;

    PollResult.prototype.retryAfter = void 0;

    function PollResult(response) {
      this.hasChanges = response.changes;
      this.retryAfter = response.backoff || 0;
    }

    return PollResult;

  })();

  Dropbox.Http.PulledChanges = (function() {
    PulledChanges.parse = function(deltaInfo) {
      if (deltaInfo && typeof deltaInfo === 'object') {
        return new Dropbox.Http.PulledChanges(deltaInfo);
      } else {
        return deltaInfo;
      }
    };

    PulledChanges.prototype.blankSlate = void 0;

    PulledChanges.prototype.cursorTag = void 0;

    PulledChanges.prototype.changes = void 0;

    PulledChanges.prototype.shouldPullAgain = void 0;

    PulledChanges.prototype.shouldBackOff = void 0;

    PulledChanges.prototype.cursor = function() {
      return this.cursorTag;
    };

    function PulledChanges(deltaInfo) {
      var entry;
      this.blankSlate = deltaInfo.reset || false;
      this.cursorTag = deltaInfo.cursor;
      this.shouldPullAgain = deltaInfo.has_more;
      this.shouldBackOff = !this.shouldPullAgain;
      if (deltaInfo.cursor && deltaInfo.cursor.length) {
        this.changes = (function() {
          var _i, _len, _ref, _results;
          _ref = deltaInfo.entries;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            entry = _ref[_i];
            _results.push(Dropbox.Http.PulledChange.parse(entry));
          }
          return _results;
        })();
      } else {
        this.changes = [];
      }
    }

    return PulledChanges;

  })();

  Dropbox.Http.PulledChange = (function() {
    PulledChange.parse = function(entry) {
      if (entry && typeof entry === 'object') {
        return new Dropbox.Http.PulledChange(entry);
      } else {
        return entry;
      }
    };

    PulledChange.prototype.path = void 0;

    PulledChange.prototype.wasRemoved = void 0;

    PulledChange.prototype.stat = void 0;

    function PulledChange(entry) {
      this.path = entry[0];
      this.stat = Dropbox.File.Stat.parse(entry[1]);
      if (this.stat) {
        this.wasRemoved = false;
      } else {
        this.stat = null;
        this.wasRemoved = true;
      }
    }

    return PulledChange;

  })();

  Dropbox.Http.RangeInfo = (function() {
    RangeInfo.parse = function(headerValue) {
      if (typeof headerValue === 'string') {
        return new Dropbox.Http.RangeInfo(headerValue);
      } else {
        return headerValue;
      }
    };

    RangeInfo.prototype.start = null;

    RangeInfo.prototype.size = null;

    RangeInfo.prototype.end = null;

    function RangeInfo(headerValue) {
      var match;
      if (match = /^bytes (\d*)-(\d*)\/(.*)$/.exec(headerValue)) {
        this.start = parseInt(match[1]);
        this.end = parseInt(match[2]);
        if (match[3] === '*') {
          this.size = null;
        } else {
          this.size = parseInt(match[3]);
        }
      } else {
        this.start = 0;
        this.end = 0;
        this.size = null;
      }
    }

    return RangeInfo;

  })();

  Dropbox.Http.UploadCursor = (function() {
    UploadCursor.parse = function(cursorData) {
      if (cursorData && (typeof cursorData === 'object' || typeof cursorData === 'string')) {
        return new Dropbox.Http.UploadCursor(cursorData);
      } else {
        return cursorData;
      }
    };

    UploadCursor.prototype.tag = null;

    UploadCursor.prototype.offset = null;

    UploadCursor.prototype.expiresAt = null;

    UploadCursor.prototype.toJSON = function() {
      return this._json || (this._json = {
        upload_id: this.tag,
        offset: this.offset,
        expires: this.expiresAt.toUTCString()
      });
    };

    UploadCursor.prototype.json = function() {
      return this.toJSON();
    };

    function UploadCursor(cursorData) {
      this.replace(cursorData);
    }

    UploadCursor.prototype.replace = function(cursorData) {
      if (typeof cursorData === 'object') {
        this.tag = cursorData.upload_id || null;
        this.offset = cursorData.offset || 0;
        this.expiresAt = Dropbox.Util.parseDate(cursorData.expires) || Date.now();
        this._json = cursorData;
      } else {
        this.tag = cursorData || null;
        this.offset = 0;
        this.expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000);
        this._json = null;
      }
      return this;
    };

    return UploadCursor;

  })();

  if (typeof Dropbox.Env.global.atob === 'function' && typeof Dropbox.Env.global.btoa === 'function') {
    Dropbox.Util.atob = function(string) {
      return Dropbox.Env.global.atob(string);
    };
    Dropbox.Util.btoa = function(base64) {
      return Dropbox.Env.global.btoa(base64);
    };
  } else if (Dropbox.Env.global.require && Dropbox.Env.global.Buffer) {
    Dropbox.Util.atob = function(arg) {
      var buffer, i;
      buffer = new Buffer(arg, 'base64');
      return ((function() {
        var _i, _ref, _results;
        _results = [];
        for (i = _i = 0, _ref = buffer.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
          _results.push(String.fromCharCode(buffer[i]));
        }
        return _results;
      })()).join('');
    };
    Dropbox.Util.btoa = function(arg) {
      var buffer, i;
      buffer = new Buffer((function() {
        var _i, _ref, _results;
        _results = [];
        for (i = _i = 0, _ref = arg.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
          _results.push(arg.charCodeAt(i));
        }
        return _results;
      })());
      return buffer.toString('base64');
    };
  } else {
    (function() {
      var atobNibble, base64Digits, btoaNibble;
      base64Digits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      btoaNibble = function(accumulator, bytes, result) {
        var i, limit;
        limit = 3 - bytes;
        accumulator <<= limit * 8;
        i = 3;
        while (i >= limit) {
          result.push(base64Digits.charAt((accumulator >> (i * 6)) & 0x3F));
          i -= 1;
        }
        i = bytes;
        while (i < 3) {
          result.push('=');
          i += 1;
        }
        return null;
      };
      atobNibble = function(accumulator, digits, result) {
        var i, limit;
        limit = 4 - digits;
        accumulator <<= limit * 6;
        i = 2;
        while (i >= limit) {
          result.push(String.fromCharCode((accumulator >> (8 * i)) & 0xFF));
          i -= 1;
        }
        return null;
      };
      Dropbox.Util.btoa = function(string) {
        var accumulator, bytes, i, result, _i, _ref;
        result = [];
        accumulator = 0;
        bytes = 0;
        for (i = _i = 0, _ref = string.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
          accumulator = (accumulator << 8) | string.charCodeAt(i);
          bytes += 1;
          if (bytes === 3) {
            btoaNibble(accumulator, bytes, result);
            accumulator = bytes = 0;
          }
        }
        if (bytes > 0) {
          btoaNibble(accumulator, bytes, result);
        }
        return result.join('');
      };
      return Dropbox.Util.atob = function(base64) {
        var accumulator, digit, digits, i, result, _i, _ref;
        result = [];
        accumulator = 0;
        digits = 0;
        for (i = _i = 0, _ref = base64.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
          digit = base64.charAt(i);
          if (digit === '=') {
            break;
          }
          accumulator = (accumulator << 6) | base64Digits.indexOf(digit);
          digits += 1;
          if (digits === 4) {
            atobNibble(accumulator, digits, result);
            accumulator = digits = 0;
          }
        }
        if (digits > 0) {
          atobNibble(accumulator, digits, result);
        }
        return result.join('');
      };
    })();
  }

  (function() {
    var arrayToBase64, crypto, hmacSha1, requireError, sha1, sha256, sha256Init, sha256Key, stringToArray, xxx, _base64Digits;
    Dropbox.Util.hmac = function(string, key) {
      return arrayToBase64(hmacSha1(stringToArray(string), stringToArray(key), string.length, key.length));
    };
    Dropbox.Util.sha1 = function(string) {
      return arrayToBase64(sha1(stringToArray(string), string.length));
    };
    Dropbox.Util.sha256 = function(string) {
      return arrayToBase64(sha256(stringToArray(string), string.length));
    };
    if (Dropbox.Env.require) {
      try {
        crypto = Dropbox.Env.require('crypto');
        if (crypto.createHmac && crypto.createHash) {
          Dropbox.Util.hmac = function(string, key) {
            var hmac;
            hmac = crypto.createHmac('sha1', key);
            hmac.update(string);
            return hmac.digest('base64');
          };
          Dropbox.Util.sha1 = function(string) {
            var hash;
            hash = crypto.createHash('sha1');
            hash.update(string);
            return hash.digest('base64');
          };
          Dropbox.Util.sha256 = function(string) {
            var hash;
            hash = crypto.createHash('sha256');
            hash.update(string);
            return hash.digest('base64');
          };
        }
      } catch (_error) {
        requireError = _error;
      }
    }
    hmacSha1 = function(string, key, length, keyLength) {
      var hash1, i, ipad, opad;
      if (key.length > 16) {
        key = sha1(key, keyLength);
      }
      ipad = (function() {
        var _i, _results;
        _results = [];
        for (i = _i = 0; _i < 16; i = ++_i) {
          _results.push(key[i] ^ 0x36363636);
        }
        return _results;
      })();
      opad = (function() {
        var _i, _results;
        _results = [];
        for (i = _i = 0; _i < 16; i = ++_i) {
          _results.push(key[i] ^ 0x5C5C5C5C);
        }
        return _results;
      })();
      hash1 = sha1(ipad.concat(string), 64 + length);
      return sha1(opad.concat(hash1), 64 + 20);
    };
    sha1 = function(string, length) {
      var a, a0, b, b0, c, c0, d, d0, e, e0, i, j, limit, n, state, t, _i;
      string[length >> 2] |= 1 << (31 - ((length & 0x03) << 3));
      string[(((length + 8) >> 6) << 4) + 15] = length << 3;
      state = Array(80);
      a = 0x67452301;
      b = 0xefcdab89;
      c = 0x98badcfe;
      d = 0x10325476;
      e = 0xc3d2e1f0;
      i = 0;
      limit = string.length;
      while (i < limit) {
        a0 = a;
        b0 = b;
        c0 = c;
        d0 = d;
        e0 = e;
        for (j = _i = 0; _i < 80; j = ++_i) {
          if (j < 16) {
            state[j] = string[(i + j) << 2 >> 2] | 0;
          } else {
            n = (state[(j - 3) << 2 >> 2] | 0) ^ (state[(j - 8) << 2 >> 2] | 0) ^ (state[(j - 14) << 2 >> 2] | 0) ^ (state[(j - 16) << 2 >> 2] | 0);
            state[j] = (n << 1) | (n >>> 31);
          }
          t = (((((a << 5) | (a >>> 27)) + e) | 0) + state[j << 2 >> 2]) | 0;
          if (j < 20) {
            t = (t + ((((b & c) | (~b & d)) + 0x5a827999) | 0)) | 0;
          } else if (j < 40) {
            t = (t + (((b ^ c ^ d) + 0x6ed9eba1) | 0)) | 0;
          } else if (j < 60) {
            t = (t + (((b & c) | (b & d) | (c & d)) - 0x70e44324) | 0) | 0;
          } else {
            t = (t + (((b ^ c ^ d) - 0x359d3e2a) | 0)) | 0;
          }
          e = d;
          d = c;
          c = (b << 30) | (b >>> 2);
          b = a;
          a = t;
        }
        a = (a0 + a) | 0;
        b = (b0 + b) | 0;
        c = (c0 + c) | 0;
        d = (d0 + d) | 0;
        e = (e0 + e) | 0;
        i = (i + 16) | 0;
      }
      return [a, b, c, d, e];
    };
    sha256 = function(string, length) {
      var a, a0, b, b0, c, c0, ch, d, d0, e, e0, f, f0, g, g0, gamma0, gamma0x, gamma1, gamma1x, h, h0, i, j, limit, maj, sigma0, sigma1, sj, state, t1, t2, _i;
      string[length >> 2] |= 1 << (31 - ((length & 0x03) << 3));
      string[(((length + 8) >> 6) << 4) + 15] = length << 3;
      state = Array(80);
      a = sha256Init[0], b = sha256Init[1], c = sha256Init[2], d = sha256Init[3], e = sha256Init[4], f = sha256Init[5], g = sha256Init[6], h = sha256Init[7];
      i = 0;
      limit = string.length;
      while (i < limit) {
        a0 = a;
        b0 = b;
        c0 = c;
        d0 = d;
        e0 = e;
        f0 = f;
        g0 = g;
        h0 = h;
        for (j = _i = 0; _i < 64; j = ++_i) {
          if (j < 16) {
            sj = state[j] = string[(i + j) << 2 >> 2] | 0;
          } else {
            gamma0x = state[(j - 15) << 2 >> 2] | 0;
            gamma0 = ((gamma0x << 25) | (gamma0x >>> 7)) ^ ((gamma0x << 14) | (gamma0x >>> 18)) ^ (gamma0x >>> 3);
            gamma1x = state[(j - 2) << 2 >> 2] | 0;
            gamma1 = ((gamma1x << 15) | (gamma1x >>> 17)) ^ ((gamma1x << 13) | (gamma1x >>> 19)) ^ (gamma1x >>> 10);
            sj = state[j] = (((gamma0 + (state[(j - 7) << 2 >> 2] | 0)) | 0) + ((gamma1 + (state[(j - 16) << 2 >> 2] | 0)) | 0)) | 0;
          }
          ch = (e & f) ^ (~e & g);
          maj = (a & b) ^ (a & c) ^ (b & c);
          sigma0 = ((a << 30) | (a >>> 2)) ^ ((a << 19) | (a >>> 13)) ^ ((a << 10) | (a >>> 22));
          sigma1 = ((e << 26) | (e >>> 6)) ^ ((e << 21) | (e >>> 11)) ^ ((e << 7) | (e >>> 25));
          t1 = (((((h + sigma1) | 0) + ((ch + sj) | 0)) | 0) + (sha256Key[j << 2 >> 2] | 0)) | 0;
          t2 = (sigma0 + maj) | 0;
          h = g;
          g = f;
          f = e;
          e = (d + t1) | 0;
          d = c;
          c = b;
          b = a;
          a = (t1 + t2) | 0;
        }
        a = (a0 + a) | 0;
        b = (b0 + b) | 0;
        c = (c0 + c) | 0;
        d = (d0 + d) | 0;
        e = (e0 + e) | 0;
        f = (f0 + f) | 0;
        g = (g0 + g) | 0;
        h = (h0 + h) | 0;
        i += 16;
      }
      return [a, b, c, d, e, f, g, h];
    };
    xxx = function(n) {
      if (n < 0) {
        n = (1 << 30) * 4 + n;
      }
      return n.toString(16);
    };
    sha256Init = [];
    sha256Key = [];
    (function() {
      var factor, fractional, i, isPrime, prime, _i, _results;
      fractional = function(x) {
        return ((x - Math.floor(x)) * 0x100000000) | 0;
      };
      prime = 2;
      _results = [];
      for (i = _i = 0; _i < 64; i = ++_i) {
        while (true) {
          isPrime = true;
          factor = 2;
          while (factor * factor <= prime) {
            if (prime % factor === 0) {
              isPrime = false;
              break;
            }
            factor += 1;
          }
          if (isPrime) {
            break;
          }
          prime += 1;
          continue;
        }
        if (i < 8) {
          sha256Init[i] = fractional(Math.pow(prime, 1 / 2));
        }
        sha256Key[i] = fractional(Math.pow(prime, 1 / 3));
        _results.push(prime += 1);
      }
      return _results;
    })();
    arrayToBase64 = function(array) {
      var i, i2, limit, string, trit;
      string = "";
      i = 0;
      limit = array.length * 4;
      while (i < limit) {
        i2 = i;
        trit = ((array[i2 >> 2] >> ((3 - (i2 & 3)) << 3)) & 0xFF) << 16;
        i2 += 1;
        trit |= ((array[i2 >> 2] >> ((3 - (i2 & 3)) << 3)) & 0xFF) << 8;
        i2 += 1;
        trit |= (array[i2 >> 2] >> ((3 - (i2 & 3)) << 3)) & 0xFF;
        string += _base64Digits[(trit >> 18) & 0x3F];
        string += _base64Digits[(trit >> 12) & 0x3F];
        i += 1;
        if (i >= limit) {
          string += '=';
        } else {
          string += _base64Digits[(trit >> 6) & 0x3F];
        }
        i += 1;
        if (i >= limit) {
          string += '=';
        } else {
          string += _base64Digits[trit & 0x3F];
        }
        i += 1;
      }
      return string;
    };
    _base64Digits = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    return stringToArray = function(string) {
      var array, i, mask, _i, _ref;
      array = [];
      mask = 0xFF;
      for (i = _i = 0, _ref = string.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        array[i >> 2] |= (string.charCodeAt(i) & mask) << ((3 - (i & 3)) << 3);
      }
      return array;
    };
  })();

  Dropbox.Util.Oauth = (function() {
    function Oauth(options) {
      this._id = null;
      this._secret = null;
      this._stateParam = null;
      this._authCode = null;
      this._token = null;
      this._tokenKey = null;
      this._tokenKid = null;
      this._error = null;
      this._appHash = null;
      this._loaded = null;
      this.setCredentials(options);
    }

    Oauth.prototype.setCredentials = function(options) {
      if (options.key) {
        this._id = options.key;
      } else {
        if (!options.token) {
          throw new Error('No API key supplied');
        }
        this._id = null;
      }
      this._secret = options.secret || null;
      this._appHash = null;
      this._error = null;
      this._loaded = true;
      this.reset();
      if (options.token) {
        this._token = options.token;
        if (options.tokenKey) {
          this._tokenKey = options.tokenKey;
          this._tokenKid = options.tokenKid;
        }
      } else if (options.oauthCode) {
        this._authCode = options.oauthCode;
      } else if (options.oauthStateParam) {
        this._stateParam = options.oauthStateParam;
      }
      return this;
    };

    Oauth.prototype.credentials = function() {
      var returnValue;
      returnValue = {};
      if (this._id) {
        returnValue.key = this._id;
      }
      if (this._secret) {
        returnValue.secret = this._secret;
      }
      if (this._token !== null) {
        returnValue.token = this._token;
        if (this._tokenKey) {
          returnValue.tokenKey = this._tokenKey;
          returnValue.tokenKid = this._tokenKid;
        }
      } else if (this._authCode !== null) {
        returnValue.oauthCode = this._authCode;
      } else if (this._stateParam !== null) {
        returnValue.oauthStateParam = this._stateParam;
      }
      return returnValue;
    };

    Oauth.prototype.step = function() {
      if (this._token !== null) {
        return Dropbox.Client.DONE;
      } else if (this._authCode !== null) {
        return Dropbox.Client.AUTHORIZED;
      } else if (this._stateParam !== null) {
        if (this._loaded) {
          return Dropbox.Client.PARAM_LOADED;
        } else {
          return Dropbox.Client.PARAM_SET;
        }
      } else if (this._error !== null) {
        return Dropbox.Client.ERROR;
      } else {
        return Dropbox.Client.RESET;
      }
    };

    Oauth.prototype.setAuthStateParam = function(stateParam) {
      if (this._id === null) {
        throw new Error('No API key supplied, cannot do authorization');
      }
      this.reset();
      this._loaded = false;
      this._stateParam = stateParam;
      return this;
    };

    Oauth.prototype.checkAuthStateParam = function(stateParam) {
      return (this._stateParam === stateParam) && (this._stateParam !== null);
    };

    Oauth.prototype.authStateParam = function() {
      return this._stateParam;
    };

    Oauth.prototype.error = function() {
      return this._error;
    };

    Oauth.prototype.processRedirectParams = function(queryParams) {
      var tokenType;
      if (queryParams.error) {
        if (this._id === null) {
          throw new Error('No API key supplied, cannot process errors');
        }
        this.reset();
        this._error = new Dropbox.AuthError(queryParams);
        return true;
      }
      if (queryParams.code) {
        if (this._id === null) {
          throw new Error('No API key supplied, cannot do Authorization Codes');
        }
        this.reset();
        this._loaded = false;
        this._authCode = queryParams.code;
        return true;
      }
      tokenType = queryParams.token_type;
      if (tokenType) {
        tokenType = tokenType.toLowerCase();
        if (tokenType !== 'bearer' && tokenType !== 'mac') {
          throw new Error("Unimplemented token type " + tokenType);
        }
        this.reset();
        this._loaded = false;
        if (tokenType === 'mac') {
          if (queryParams.mac_algorithm !== 'hmac-sha-1') {
            throw new Error("Unimplemented MAC algorithms " + queryParams.mac_algorithm);
          }
          this._tokenKey = queryParams.mac_key;
          this._tokenKid = queryParams.kid;
        }
        this._token = queryParams.access_token;
        return true;
      }
      return false;
    };

    Oauth.prototype.authHeader = function(method, url, params) {
      var macParams, userPassword;
      if (this._token === null) {
        userPassword = this._secret === null ? Dropbox.Util.btoa("" + this._id + ":") : Dropbox.Util.btoa("" + this._id + ":" + this._secret);
        return "Basic " + userPassword;
      } else {
        if (this._tokenKey === null) {
          return "Bearer " + this._token;
        } else {
          macParams = this.macParams(method, url, params);
          return ("MAC kid=" + macParams.kid + " ts=" + macParams.ts + " ") + ("access_token=" + this._token + " mac=" + macParams.mac);
        }
      }
    };

    Oauth.prototype.addAuthParams = function(method, url, params) {
      var macParams;
      if (this._token === null) {
        params.client_id = this._id;
        if (this._secret !== null) {
          params.client_secret = this._secret;
        }
      } else {
        if (this._tokenKey !== null) {
          macParams = this.macParams(method, url, params);
          params.kid = macParams.kid;
          params.ts = macParams.ts;
          params.mac = macParams.mac;
        }
        params.access_token = this._token;
      }
      return params;
    };

    Oauth.prototype.authorizeUrlParams = function(responseType, redirectUrl) {
      var params;
      if (responseType !== 'token' && responseType !== 'code') {
        throw new Error("Unimplemented /authorize response type " + responseType);
      }
      params = {
        client_id: this._id,
        state: this._stateParam,
        response_type: responseType
      };
      if (redirectUrl) {
        params.redirect_uri = redirectUrl;
      }
      return params;
    };

    Oauth.prototype.accessTokenParams = function(redirectUrl) {
      var params;
      params = {
        grant_type: 'authorization_code',
        code: this._authCode
      };
      if (redirectUrl) {
        params.redirect_uri = redirectUrl;
      }
      return params;
    };

    Oauth.queryParamsFromUrl = function(url) {
      var fragment, fragmentOffset, kvp, match, offset, params, query, _i, _len, _ref;
      match = /^[^?#]+(\?([^\#]*))?(\#(.*))?$/.exec(url);
      if (!match) {
        return {};
      }
      query = match[2] || '';
      if (query.substring(0, 1) === '/') {
        query = query.substring(1);
      }
      fragment = match[4] || '';
      fragmentOffset = fragment.indexOf('?');
      if (fragmentOffset !== -1) {
        fragment = fragment.substring(fragmentOffset + 1);
      }
      if (fragment.substring(0, 1) === '/') {
        fragment = fragment.substring(1);
      }
      params = {};
      _ref = query.split('&').concat(fragment.split('&'));
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        kvp = _ref[_i];
        offset = kvp.indexOf('=');
        if (offset === -1) {
          continue;
        }
        params[decodeURIComponent(kvp.substring(0, offset))] = decodeURIComponent(kvp.substring(offset + 1));
      }
      return params;
    };

    Oauth.prototype.macParams = function(method, url, params) {
      var macParams, string;
      macParams = {
        kid: this._tokenKid,
        ts: Dropbox.Util.Oauth.timestamp()
      };
      string = method.toUpperCase() + '&' + Dropbox.Util.Xhr.urlEncodeValue(url) + '&' + Dropbox.Util.Xhr.urlEncodeValue(Dropbox.Util.Xhr.urlEncode(params));
      macParams.mac = Dropbox.Util.hmac(string, this._tokenKey);
      return macParams;
    };

    Oauth.prototype.appHash = function() {
      if (this._appHash) {
        return this._appHash;
      }
      return this._appHash = Dropbox.Util.sha1('oauth2-' + this._id).replace(/[\/+=]/g, '');
    };

    Oauth.prototype.reset = function() {
      this._stateParam = null;
      this._authCode = null;
      this._token = null;
      this._tokenKey = null;
      this._tokenKid = null;
      this._error = null;
      return this;
    };

    Oauth.timestamp = function() {
      return Math.floor(Date.now() / 1000);
    };

    Oauth.randomAuthStateParam = function() {
      return ['oas', Date.now().toString(36), Math.random().toString(36)].join('_');
    };

    return Oauth;

  })();

  if (Date.now == null) {
    Dropbox.Util.Oauth.timestamp = function() {
      return Math.floor((new Date()).getTime() / 1000);
    };
  }

  if ((new Date('Fri, 31 Jan 2042 21:01:05 +0000')).valueOf() === 2274814865000) {
    Dropbox.Util.parseDate = function(dateString) {
      return new Date(dateString);
    };
  } else if (Date.parse('Fri, 31 Jan 2042 21:01:05 +0000') === 2274814865000) {
    Dropbox.Util.parseDate = function(dateString) {
      return new Date(Date.parse(dateString));
    };
  } else {
    (function() {
      var parseDateMonths, parseDateRe;
      parseDateRe = /^\w+\, (\d+) (\w+) (\d+) (\d+)\:(\d+)\:(\d+) (\+\d+|UTC|GMT)$/;
      parseDateMonths = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11
      };
      return Dropbox.Util.parseDate = function(dateString) {
        var match;
        if (!(match = parseDateRe.exec(dateString))) {
          return NaN;
        }
        return new Date(Date.UTC(parseInt(match[3]), parseDateMonths[match[2]], parseInt(match[1]), parseInt(match[4]), parseInt(match[5]), parseInt(match[6]), 0));
      };
    })();
  }

  if (Dropbox.Env.global.XMLHttpRequest) {
    if (Dropbox.Env.global.XDomainRequest && !('withCredentials' in new XMLHttpRequest())) {
      DbxXhrRequest = XDomainRequest;
      DbxXhrIeMode = true;
      DbxXhrCanSendForms = false;
    } else {
      DbxXhrRequest = XMLHttpRequest;
      DbxXhrIeMode = false;
      DbxXhrCanSendForms = typeof FormData !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1;
    }
    DbxXhrDoesPreflight = true;
  } else {
    DbxXhrRequest = Dropbox.Env.require('xhr2');
    DbxXhrIeMode = false;
    DbxXhrCanSendForms = false;
    DbxXhrDoesPreflight = false;
  }

  if (!Dropbox.Env.global.Uint8Array) {
    DbxXhrArrayBufferView = null;
    DbxXhrWrapBlob = false;
    DbxXhrSendArrayBufferView = false;
  } else {
    if (Object.getPrototypeOf) {
      DbxXhrArrayBufferView = Object.getPrototypeOf(Object.getPrototypeOf(new Uint8Array(0))).constructor;
    } else if (Object.__proto__) {
      DbxXhrArrayBufferView = (new Uint8Array(0)).__proto__.__proto__.constructor;
    }
    if (!Dropbox.Env.global.Blob) {
      DbxXhrWrapBlob = false;
      DbxXhrSendArrayBufferView = true;
    } else {
      try {
        (function() {
          if ((new Blob([new Uint8Array(2)])).size === 2) {
            DbxXhrWrapBlob = true;
            return DbxXhrSendArrayBufferView = true;
          } else {
            DbxXhrSendArrayBufferView = false;
            return DbxXhrWrapBlob = (new Blob([new ArrayBuffer(2)])).size === 2;
          }
        })();
      } catch (_error) {
        DbxXhrSendArrayBufferView = false;
        DbxXhrWrapBlob = false;
        if (Dropbox.Env.global.WebKitBlobBuilder) {
          if (navigator.userAgent.indexOf('Android') !== -1) {
            DbxXhrCanSendForms = false;
          }
        }
      }
      if (DbxXhrArrayBufferView === Object) {
        DbxXhrSendArrayBufferView = false;
      }
    }
  }

  Dropbox.Util.Xhr = (function() {
    Xhr.Request = DbxXhrRequest;

    Xhr.ieXdr = DbxXhrIeMode;

    Xhr.canSendForms = DbxXhrCanSendForms;

    Xhr.doesPreflight = DbxXhrDoesPreflight;

    Xhr.ArrayBufferView = DbxXhrArrayBufferView;

    Xhr.sendArrayBufferView = DbxXhrSendArrayBufferView;

    Xhr.wrapBlob = DbxXhrWrapBlob;

    function Xhr(method, baseUrl) {
      this.method = method;
      this.isGet = this.method === 'GET';
      this.url = baseUrl;
      this.wantHeaders = false;
      this.headers = {};
      this.params = null;
      this.body = null;
      this.preflight = !(this.isGet || (this.method === 'POST'));
      this.signed = false;
      this.completed = false;
      this.responseType = null;
      this.callback = null;
      this.xhr = null;
      this.onError = null;
    }

    Xhr.prototype.xhr = null;

    Xhr.prototype.onError = null;

    Xhr.prototype.setParams = function(params) {
      if (this.signed) {
        throw new Error('setParams called after addOauthParams or addOauthHeader');
      }
      if (this.params) {
        throw new Error('setParams cannot be called twice');
      }
      this.params = params;
      return this;
    };

    Xhr.prototype.setCallback = function(callback) {
      this.callback = callback;
      return this;
    };

    Xhr.prototype.signWithOauth = function(oauth, cacheFriendly) {
      if (Dropbox.Util.Xhr.ieXdr) {
        return this.addOauthParams(oauth);
      } else if (this.preflight || !Dropbox.Util.Xhr.doesPreflight) {
        return this.addOauthHeader(oauth);
      } else {
        if (this.isGet && cacheFriendly) {
          return this.addOauthHeader(oauth);
        } else {
          return this.addOauthParams(oauth);
        }
      }
    };

    Xhr.prototype.addOauthParams = function(oauth) {
      if (this.signed) {
        throw new Error('Request already has an OAuth signature');
      }
      this.params || (this.params = {});
      oauth.addAuthParams(this.method, this.url, this.params);
      this.signed = true;
      return this;
    };

    Xhr.prototype.addOauthHeader = function(oauth) {
      if (this.signed) {
        throw new Error('Request already has an OAuth signature');
      }
      this.params || (this.params = {});
      this.signed = true;
      return this.setHeader('Authorization', oauth.authHeader(this.method, this.url, this.params));
    };

    Xhr.prototype.setBody = function(body) {
      if (this.isGet) {
        throw new Error('setBody cannot be called on GET requests');
      }
      if (this.body !== null) {
        throw new Error('Request already has a body');
      }
      if (typeof body === 'string') {

      } else if ((typeof FormData !== 'undefined') && (body instanceof FormData)) {

      } else {
        this.headers['Content-Type'] = 'application/octet-stream';
        this.preflight = true;
      }
      this.body = body;
      return this;
    };

    Xhr.prototype.setResponseType = function(responseType) {
      this.responseType = responseType;
      return this;
    };

    Xhr.prototype.setHeader = function(headerName, value) {
      var oldValue;
      if (this.headers[headerName]) {
        oldValue = this.headers[headerName];
        throw new Error("HTTP header " + headerName + " already set to " + oldValue);
      }
      if (headerName === 'Content-Type') {
        throw new Error('Content-Type is automatically computed based on setBody');
      }
      this.preflight = true;
      this.headers[headerName] = value;
      return this;
    };

    Xhr.prototype.reportResponseHeaders = function() {
      return this.wantHeaders = true;
    };

    Xhr.prototype.setFileField = function(fieldName, fileName, fileData, contentType) {
      var blob, blobError, boundary, builder, useFormData;
      if (this.body !== null) {
        throw new Error('Request already has a body');
      }
      if (this.isGet) {
        throw new Error('setFileField cannot be called on GET requests');
      }
      if (typeof fileData === 'object') {
        if (typeof ArrayBuffer !== 'undefined') {
          if (fileData instanceof ArrayBuffer) {
            if (Dropbox.Util.Xhr.sendArrayBufferView) {
              fileData = new Uint8Array(fileData);
            }
          } else {
            if (!Dropbox.Util.Xhr.sendArrayBufferView && fileData.byteOffset === 0 && fileData.buffer instanceof ArrayBuffer) {
              fileData = fileData.buffer;
            }
          }
        }
        contentType || (contentType = 'application/octet-stream');
        try {
          fileData = new Blob([fileData], {
            type: contentType
          });
        } catch (_error) {
          blobError = _error;
          if (window.WebKitBlobBuilder) {
            builder = new WebKitBlobBuilder;
            builder.append(fileData);
            if (blob = builder.getBlob(contentType)) {
              fileData = blob;
            }
          }
        }
        if (typeof File !== 'undefined' && fileData instanceof File) {
          fileData = new Blob([fileData], {
            type: fileData.type
          });
        }
        useFormData = fileData instanceof Blob;
      } else {
        useFormData = false;
      }
      if (useFormData) {
        this.body = new FormData();
        return this.body.append(fieldName, fileData, fileName);
      } else {
        contentType || (contentType = 'application/octet-stream');
        boundary = this.multipartBoundary();
        this.headers['Content-Type'] = "multipart/form-data; boundary=" + boundary;
        return this.body = ['--', boundary, "\r\n", 'Content-Disposition: form-data; name="', fieldName, '"; filename="', fileName, "\"\r\n", 'Content-Type: ', contentType, "\r\n", "Content-Transfer-Encoding: binary\r\n\r\n", fileData, "\r\n", '--', boundary, '--', "\r\n"].join('');
      }
    };

    Xhr.prototype.multipartBoundary = function() {
      return [Date.now().toString(36), Math.random().toString(36)].join('----');
    };

    Xhr.prototype.paramsToUrl = function() {
      var queryString;
      if (this.params) {
        queryString = Dropbox.Util.Xhr.urlEncode(this.params);
        if (queryString.length !== 0) {
          this.url = [this.url, '?', queryString].join('');
        }
        this.params = null;
      }
      return this;
    };

    Xhr.prototype.paramsToBody = function() {
      if (this.params) {
        if (this.body !== null) {
          throw new Error('Request already has a body');
        }
        if (this.isGet) {
          throw new Error('paramsToBody cannot be called on GET requests');
        }
        this.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        this.body = Dropbox.Util.Xhr.urlEncode(this.params);
        this.params = null;
      }
      return this;
    };

    Xhr.prototype.prepare = function() {
      var header, ieXdr, value, _ref;
      ieXdr = Dropbox.Util.Xhr.ieXdr;
      if (this.isGet || this.body !== null || ieXdr) {
        this.paramsToUrl();
        if (this.body !== null && typeof this.body === 'string') {
          this.headers['Content-Type'] = 'text/plain; charset=utf8';
        }
      } else {
        this.paramsToBody();
      }
      this.xhr = new Dropbox.Util.Xhr.Request();
      if (ieXdr) {
        this.xhr.onload = (function(_this) {
          return function() {
            return _this.onXdrLoad();
          };
        })(this);
        this.xhr.onerror = (function(_this) {
          return function() {
            return _this.onXdrError();
          };
        })(this);
        this.xhr.ontimeout = (function(_this) {
          return function() {
            return _this.onXdrError();
          };
        })(this);
        this.xhr.onprogress = function() {};
      } else {
        this.xhr.onreadystatechange = (function(_this) {
          return function() {
            return _this.onReadyStateChange();
          };
        })(this);
      }
      this.xhr.open(this.method, this.url, true);
      if (!ieXdr) {
        _ref = this.headers;
        for (header in _ref) {
          if (!__hasProp.call(_ref, header)) continue;
          value = _ref[header];
          this.xhr.setRequestHeader(header, value);
        }
      }
      if (this.responseType) {
        if (this.responseType === 'b') {
          if (this.xhr.overrideMimeType) {
            this.xhr.overrideMimeType('text/plain; charset=x-user-defined');
          }
        } else {
          this.xhr.responseType = this.responseType;
        }
      }
      return this;
    };

    Xhr.prototype.send = function(callback) {
      var body, xhrError;
      this.callback = callback || this.callback;
      if (this.body !== null) {
        body = this.body;
        if (Dropbox.Util.Xhr.sendArrayBufferView) {
          if (body instanceof ArrayBuffer) {
            body = new Uint8Array(body);
          }
        } else {
          if (body.byteOffset === 0 && body.buffer instanceof ArrayBuffer) {
            body = body.buffer;
          }
        }
        try {
          this.xhr.send(body);
        } catch (_error) {
          xhrError = _error;
          if (!Dropbox.Util.Xhr.sendArrayBufferView && Dropbox.Util.Xhr.wrapBlob) {
            body = new Blob([body], {
              type: 'application/octet-stream'
            });
            this.xhr.send(body);
          } else {
            throw xhrError;
          }
        }
      } else {
        this.xhr.send();
      }
      return this;
    };

    Xhr.urlEncode = function(object) {
      var chunks, key, value;
      chunks = [];
      for (key in object) {
        value = object[key];
        chunks.push(this.urlEncodeValue(key) + '=' + this.urlEncodeValue(value));
      }
      return chunks.sort().join('&');
    };

    Xhr.urlEncodeValue = function(object) {
      return encodeURIComponent(object.toString()).replace(/\!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A');
    };

    Xhr.urlDecode = function(string) {
      var kvp, result, token, _i, _len, _ref;
      result = {};
      _ref = string.split('&');
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        token = _ref[_i];
        kvp = token.split('=');
        result[decodeURIComponent(kvp[0])] = decodeURIComponent(kvp[1]);
      }
      return result;
    };

    Xhr.prototype.onReadyStateChange = function() {
      var allHeaders, apiError, bytes, contentType, dirtyText, duplicateIndex, headers, i, jsonError, metadata, metadataJson, offset, text, _i, _ref;
      if (this.xhr.readyState !== 4) {
        return true;
      }
      if (this.completed) {
        return true;
      }
      this.completed = true;
      if (this.xhr.status < 200 || this.xhr.status >= 300) {
        apiError = new Dropbox.ApiError(this.xhr, this.method, this.url);
        if (this.onError) {
          this.onError(apiError, this.callback);
        } else {
          this.callback(apiError);
        }
        return true;
      }
      if (this.wantHeaders) {
        allHeaders = this.xhr.getAllResponseHeaders();
        if (allHeaders) {
          headers = Dropbox.Util.Xhr.parseResponseHeaders(allHeaders);
        } else {
          headers = this.guessResponseHeaders();
        }
        metadataJson = headers['x-dropbox-metadata'];
      } else {
        headers = void 0;
        metadataJson = this.xhr.getResponseHeader('x-dropbox-metadata');
      }
      if (metadataJson != null ? metadataJson.length : void 0) {
        try {
          metadata = JSON.parse(metadataJson);
        } catch (_error) {
          jsonError = _error;
          duplicateIndex = metadataJson.search(/\}\,\s*\{/);
          if (duplicateIndex !== -1) {
            try {
              metadataJson = metadataJson.substring(0, duplicateIndex + 1);
              metadata = JSON.parse(metadataJson);
            } catch (_error) {
              jsonError = _error;
              metadata = void 0;
            }
          } else {
            metadata = void 0;
          }
        }
      } else {
        metadata = void 0;
      }
      if (this.responseType) {
        if (this.responseType === 'b') {
          dirtyText = this.xhr.responseText != null ? this.xhr.responseText : this.xhr.response;
          bytes = [];
          for (i = _i = 0, _ref = dirtyText.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
            bytes.push(String.fromCharCode(dirtyText.charCodeAt(i) & 0xFF));
          }
          text = bytes.join('');
          this.callback(null, text, metadata, headers);
        } else {
          this.callback(null, this.xhr.response, metadata, headers);
        }
        return true;
      }
      text = this.xhr.responseText != null ? this.xhr.responseText : this.xhr.response;
      contentType = this.xhr.getResponseHeader('Content-Type');
      if (contentType) {
        offset = contentType.indexOf(';');
        if (offset !== -1) {
          contentType = contentType.substring(0, offset);
        }
      }
      switch (contentType) {
        case 'application/x-www-form-urlencoded':
          this.callback(null, Dropbox.Util.Xhr.urlDecode(text), metadata, headers);
          break;
        case 'application/json':
        case 'text/javascript':
          this.callback(null, JSON.parse(text), metadata, headers);
          break;
        default:
          this.callback(null, text, metadata, headers);
      }
      return true;
    };

    Xhr.parseResponseHeaders = function(allHeaders) {
      var colonIndex, headerLines, headers, line, name, value, _i, _len;
      headers = {};
      headerLines = allHeaders.split("\n");
      for (_i = 0, _len = headerLines.length; _i < _len; _i++) {
        line = headerLines[_i];
        colonIndex = line.indexOf(':');
        name = line.substring(0, colonIndex).trim().toLowerCase();
        value = line.substring(colonIndex + 1).trim();
        headers[name] = value;
      }
      return headers;
    };

    Xhr.prototype.guessResponseHeaders = function() {
      var headers, name, value, _i, _len, _ref;
      headers = {};
      _ref = ['cache-control', 'content-language', 'content-range', 'content-type', 'expires', 'last-modified', 'pragma', 'x-dropbox-metadata'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        name = _ref[_i];
        value = this.xhr.getResponseHeader(name);
        if (value) {
          headers[name] = value;
        }
      }
      return headers;
    };

    Xhr.prototype.onXdrLoad = function() {
      var headers, metadata, text;
      if (this.completed) {
        return true;
      }
      this.completed = true;
      text = this.xhr.responseText;
      if (this.wantHeaders) {
        headers = {
          'content-type': this.xhr.contentType
        };
      } else {
        headers = void 0;
      }
      metadata = void 0;
      if (this.responseType) {
        this.callback(null, text, metadata, headers);
        return true;
      }
      switch (this.xhr.contentType) {
        case 'application/x-www-form-urlencoded':
          this.callback(null, Dropbox.Util.Xhr.urlDecode(text), metadata, headers);
          break;
        case 'application/json':
        case 'text/javascript':
          this.callback(null, JSON.parse(text), metadata, headers);
          break;
        default:
          this.callback(null, text, metadata, headers);
      }
      return true;
    };

    Xhr.prototype.onXdrError = function() {
      var apiError;
      if (this.completed) {
        return true;
      }
      this.completed = true;
      apiError = new Dropbox.ApiError(this.xhr, this.method, this.url);
      if (this.onError) {
        this.onError(apiError, this.callback);
      } else {
        this.callback(apiError);
      }
      return true;
    };

    return Xhr;

  })();

}).call(this);

}).call(this,require("+NscNm"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"+NscNm":11,"buffer":8}],"dropbox":[function(require,module,exports){
module.exports=require('tBYV3e');
},{}],8:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
var TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str.toString()
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.compare = function (a, b) {
  assert(Buffer.isBuffer(a) && Buffer.isBuffer(b), 'Arguments must be Buffers')
  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) {
    return -1
  }
  if (y < x) {
    return 1
  }
  return 0
}

// BUFFER INSTANCE METHODS
// =======================

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end === undefined) ? self.length : Number(end)

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = asciiSlice(self, start, end)
      break
    case 'binary':
      ret = binarySlice(self, start, end)
      break
    case 'base64':
      ret = base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

Buffer.prototype.equals = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.compare = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return readUInt16(this, offset, false, noAssert)
}

function readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return readInt16(this, offset, false, noAssert)
}

function readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return readInt32(this, offset, false, noAssert)
}

function readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return readFloat(this, offset, false, noAssert)
}

function readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
  return offset + 1
}

function writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
  return offset + 2
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, false, noAssert)
}

function writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
  return offset + 4
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
  return offset + 1
}

function writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
  return offset + 2
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, false, noAssert)
}

function writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
  return offset + 4
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, false, noAssert)
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":9,"ieee754":10}],9:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],10:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],11:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],"QRCzyp":[function(require,module,exports){
/*!
 * jQuery JavaScript Library v2.1.1
 * http://jquery.com/
 *
 * Includes Sizzle.js
 * http://sizzlejs.com/
 *
 * Copyright 2005, 2014 jQuery Foundation, Inc. and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2014-05-01T17:11Z
 */

(function( global, factory ) {

	if ( typeof module === "object" && typeof module.exports === "object" ) {
		// For CommonJS and CommonJS-like environments where a proper window is present,
		// execute the factory and get jQuery
		// For environments that do not inherently posses a window with a document
		// (such as Node.js), expose a jQuery-making factory as module.exports
		// This accentuates the need for the creation of a real window
		// e.g. var jQuery = require("jquery")(window);
		// See ticket #14549 for more info
		module.exports = global.document ?
			factory( global, true ) :
			function( w ) {
				if ( !w.document ) {
					throw new Error( "jQuery requires a window with a document" );
				}
				return factory( w );
			};
	} else {
		factory( global );
	}

// Pass this if window is not defined yet
}(typeof window !== "undefined" ? window : this, function( window, noGlobal ) {

// Can't do this because several apps including ASP.NET trace
// the stack via arguments.caller.callee and Firefox dies if
// you try to trace through "use strict" call chains. (#13335)
// Support: Firefox 18+
//

var arr = [];

var slice = arr.slice;

var concat = arr.concat;

var push = arr.push;

var indexOf = arr.indexOf;

var class2type = {};

var toString = class2type.toString;

var hasOwn = class2type.hasOwnProperty;

var support = {};



var
	// Use the correct document accordingly with window argument (sandbox)
	document = window.document,

	version = "2.1.1",

	// Define a local copy of jQuery
	jQuery = function( selector, context ) {
		// The jQuery object is actually just the init constructor 'enhanced'
		// Need init if jQuery is called (just allow error to be thrown if not included)
		return new jQuery.fn.init( selector, context );
	},

	// Support: Android<4.1
	// Make sure we trim BOM and NBSP
	rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,

	// Matches dashed string for camelizing
	rmsPrefix = /^-ms-/,
	rdashAlpha = /-([\da-z])/gi,

	// Used by jQuery.camelCase as callback to replace()
	fcamelCase = function( all, letter ) {
		return letter.toUpperCase();
	};

jQuery.fn = jQuery.prototype = {
	// The current version of jQuery being used
	jquery: version,

	constructor: jQuery,

	// Start with an empty selector
	selector: "",

	// The default length of a jQuery object is 0
	length: 0,

	toArray: function() {
		return slice.call( this );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {
		return num != null ?

			// Return just the one element from the set
			( num < 0 ? this[ num + this.length ] : this[ num ] ) :

			// Return all the elements in a clean array
			slice.call( this );
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems ) {

		// Build a new jQuery matched element set
		var ret = jQuery.merge( this.constructor(), elems );

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;
		ret.context = this.context;

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	// (You can seed the arguments with an array of args, but this is
	// only used internally.)
	each: function( callback, args ) {
		return jQuery.each( this, callback, args );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map(this, function( elem, i ) {
			return callback.call( elem, i, elem );
		}));
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ) );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	eq: function( i ) {
		var len = this.length,
			j = +i + ( i < 0 ? len : 0 );
		return this.pushStack( j >= 0 && j < len ? [ this[j] ] : [] );
	},

	end: function() {
		return this.prevObject || this.constructor(null);
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: arr.sort,
	splice: arr.splice
};

jQuery.extend = jQuery.fn.extend = function() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;

		// skip the boolean and the target
		target = arguments[ i ] || {};
		i++;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !jQuery.isFunction(target) ) {
		target = {};
	}

	// extend jQuery itself if only one argument is passed
	if ( i === length ) {
		target = this;
		i--;
	}

	for ( ; i < length; i++ ) {
		// Only deal with non-null/undefined values
		if ( (options = arguments[ i ]) != null ) {
			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)) ) ) {
					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && jQuery.isArray(src) ? src : [];

					} else {
						clone = src && jQuery.isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend({
	// Unique for each copy of jQuery on the page
	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

	// Assume jQuery is ready without the ready module
	isReady: true,

	error: function( msg ) {
		throw new Error( msg );
	},

	noop: function() {},

	// See test/unit/core.js for details concerning isFunction.
	// Since version 1.3, DOM methods and functions like alert
	// aren't supported. They return false on IE (#2968).
	isFunction: function( obj ) {
		return jQuery.type(obj) === "function";
	},

	isArray: Array.isArray,

	isWindow: function( obj ) {
		return obj != null && obj === obj.window;
	},

	isNumeric: function( obj ) {
		// parseFloat NaNs numeric-cast false positives (null|true|false|"")
		// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
		// subtraction forces infinities to NaN
		return !jQuery.isArray( obj ) && obj - parseFloat( obj ) >= 0;
	},

	isPlainObject: function( obj ) {
		// Not plain objects:
		// - Any object or value whose internal [[Class]] property is not "[object Object]"
		// - DOM nodes
		// - window
		if ( jQuery.type( obj ) !== "object" || obj.nodeType || jQuery.isWindow( obj ) ) {
			return false;
		}

		if ( obj.constructor &&
				!hasOwn.call( obj.constructor.prototype, "isPrototypeOf" ) ) {
			return false;
		}

		// If the function hasn't returned already, we're confident that
		// |obj| is a plain object, created by {} or constructed with new Object
		return true;
	},

	isEmptyObject: function( obj ) {
		var name;
		for ( name in obj ) {
			return false;
		}
		return true;
	},

	type: function( obj ) {
		if ( obj == null ) {
			return obj + "";
		}
		// Support: Android < 4.0, iOS < 6 (functionish RegExp)
		return typeof obj === "object" || typeof obj === "function" ?
			class2type[ toString.call(obj) ] || "object" :
			typeof obj;
	},

	// Evaluates a script in a global context
	globalEval: function( code ) {
		var script,
			indirect = eval;

		code = jQuery.trim( code );

		if ( code ) {
			// If the code includes a valid, prologue position
			// strict mode pragma, execute code by injecting a
			// script tag into the document.
			if ( code.indexOf("use strict") === 1 ) {
				script = document.createElement("script");
				script.text = code;
				document.head.appendChild( script ).parentNode.removeChild( script );
			} else {
			// Otherwise, avoid the DOM node creation, insertion
			// and removal by using an indirect global eval
				indirect( code );
			}
		}
	},

	// Convert dashed to camelCase; used by the css and data modules
	// Microsoft forgot to hump their vendor prefix (#9572)
	camelCase: function( string ) {
		return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
	},

	nodeName: function( elem, name ) {
		return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();
	},

	// args is for internal usage only
	each: function( obj, callback, args ) {
		var value,
			i = 0,
			length = obj.length,
			isArray = isArraylike( obj );

		if ( args ) {
			if ( isArray ) {
				for ( ; i < length; i++ ) {
					value = callback.apply( obj[ i ], args );

					if ( value === false ) {
						break;
					}
				}
			} else {
				for ( i in obj ) {
					value = callback.apply( obj[ i ], args );

					if ( value === false ) {
						break;
					}
				}
			}

		// A special, fast, case for the most common use of each
		} else {
			if ( isArray ) {
				for ( ; i < length; i++ ) {
					value = callback.call( obj[ i ], i, obj[ i ] );

					if ( value === false ) {
						break;
					}
				}
			} else {
				for ( i in obj ) {
					value = callback.call( obj[ i ], i, obj[ i ] );

					if ( value === false ) {
						break;
					}
				}
			}
		}

		return obj;
	},

	// Support: Android<4.1
	trim: function( text ) {
		return text == null ?
			"" :
			( text + "" ).replace( rtrim, "" );
	},

	// results is for internal usage only
	makeArray: function( arr, results ) {
		var ret = results || [];

		if ( arr != null ) {
			if ( isArraylike( Object(arr) ) ) {
				jQuery.merge( ret,
					typeof arr === "string" ?
					[ arr ] : arr
				);
			} else {
				push.call( ret, arr );
			}
		}

		return ret;
	},

	inArray: function( elem, arr, i ) {
		return arr == null ? -1 : indexOf.call( arr, elem, i );
	},

	merge: function( first, second ) {
		var len = +second.length,
			j = 0,
			i = first.length;

		for ( ; j < len; j++ ) {
			first[ i++ ] = second[ j ];
		}

		first.length = i;

		return first;
	},

	grep: function( elems, callback, invert ) {
		var callbackInverse,
			matches = [],
			i = 0,
			length = elems.length,
			callbackExpect = !invert;

		// Go through the array, only saving the items
		// that pass the validator function
		for ( ; i < length; i++ ) {
			callbackInverse = !callback( elems[ i ], i );
			if ( callbackInverse !== callbackExpect ) {
				matches.push( elems[ i ] );
			}
		}

		return matches;
	},

	// arg is for internal usage only
	map: function( elems, callback, arg ) {
		var value,
			i = 0,
			length = elems.length,
			isArray = isArraylike( elems ),
			ret = [];

		// Go through the array, translating each of the items to their new values
		if ( isArray ) {
			for ( ; i < length; i++ ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}

		// Go through every key on the object,
		} else {
			for ( i in elems ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}
		}

		// Flatten any nested arrays
		return concat.apply( [], ret );
	},

	// A global GUID counter for objects
	guid: 1,

	// Bind a function to a context, optionally partially applying any
	// arguments.
	proxy: function( fn, context ) {
		var tmp, args, proxy;

		if ( typeof context === "string" ) {
			tmp = fn[ context ];
			context = fn;
			fn = tmp;
		}

		// Quick check to determine if target is callable, in the spec
		// this throws a TypeError, but we will just return undefined.
		if ( !jQuery.isFunction( fn ) ) {
			return undefined;
		}

		// Simulated bind
		args = slice.call( arguments, 2 );
		proxy = function() {
			return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
		};

		// Set the guid of unique handler to the same of original handler, so it can be removed
		proxy.guid = fn.guid = fn.guid || jQuery.guid++;

		return proxy;
	},

	now: Date.now,

	// jQuery.support is not used in Core but other projects attach their
	// properties to it so it needs to exist.
	support: support
});

// Populate the class2type map
jQuery.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
	class2type[ "[object " + name + "]" ] = name.toLowerCase();
});

function isArraylike( obj ) {
	var length = obj.length,
		type = jQuery.type( obj );

	if ( type === "function" || jQuery.isWindow( obj ) ) {
		return false;
	}

	if ( obj.nodeType === 1 && length ) {
		return true;
	}

	return type === "array" || length === 0 ||
		typeof length === "number" && length > 0 && ( length - 1 ) in obj;
}
var Sizzle =
/*!
 * Sizzle CSS Selector Engine v1.10.19
 * http://sizzlejs.com/
 *
 * Copyright 2013 jQuery Foundation, Inc. and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2014-04-18
 */
(function( window ) {

var i,
	support,
	Expr,
	getText,
	isXML,
	tokenize,
	compile,
	select,
	outermostContext,
	sortInput,
	hasDuplicate,

	// Local document vars
	setDocument,
	document,
	docElem,
	documentIsHTML,
	rbuggyQSA,
	rbuggyMatches,
	matches,
	contains,

	// Instance-specific data
	expando = "sizzle" + -(new Date()),
	preferredDoc = window.document,
	dirruns = 0,
	done = 0,
	classCache = createCache(),
	tokenCache = createCache(),
	compilerCache = createCache(),
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
		}
		return 0;
	},

	// General-purpose constants
	strundefined = typeof undefined,
	MAX_NEGATIVE = 1 << 31,

	// Instance methods
	hasOwn = ({}).hasOwnProperty,
	arr = [],
	pop = arr.pop,
	push_native = arr.push,
	push = arr.push,
	slice = arr.slice,
	// Use a stripped-down indexOf if we can't use a native one
	indexOf = arr.indexOf || function( elem ) {
		var i = 0,
			len = this.length;
		for ( ; i < len; i++ ) {
			if ( this[i] === elem ) {
				return i;
			}
		}
		return -1;
	},

	booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",

	// Regular expressions

	// Whitespace characters http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = "[\\x20\\t\\r\\n\\f]",
	// http://www.w3.org/TR/css3-syntax/#characters
	characterEncoding = "(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",

	// Loosely modeled on CSS identifier characters
	// An unquoted value should be a CSS identifier http://www.w3.org/TR/css3-selectors/#attribute-selectors
	// Proper syntax: http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
	identifier = characterEncoding.replace( "w", "w#" ),

	// Attribute selectors: http://www.w3.org/TR/selectors/#attribute-selectors
	attributes = "\\[" + whitespace + "*(" + characterEncoding + ")(?:" + whitespace +
		// Operator (capture 2)
		"*([*^$|!~]?=)" + whitespace +
		// "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
		"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" + whitespace +
		"*\\]",

	pseudos = ":(" + characterEncoding + ")(?:\\((" +
		// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
		// 1. quoted (capture 3; capture 4 or capture 5)
		"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +
		// 2. simple (capture 6)
		"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +
		// 3. anything else (capture 2)
		".*" +
		")\\)|)",

	// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),

	rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
	rcombinators = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*" ),

	rattributeQuotes = new RegExp( "=" + whitespace + "*([^\\]'\"]*?)" + whitespace + "*\\]", "g" ),

	rpseudo = new RegExp( pseudos ),
	ridentifier = new RegExp( "^" + identifier + "$" ),

	matchExpr = {
		"ID": new RegExp( "^#(" + characterEncoding + ")" ),
		"CLASS": new RegExp( "^\\.(" + characterEncoding + ")" ),
		"TAG": new RegExp( "^(" + characterEncoding.replace( "w", "w*" ) + ")" ),
		"ATTR": new RegExp( "^" + attributes ),
		"PSEUDO": new RegExp( "^" + pseudos ),
		"CHILD": new RegExp( "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + whitespace +
			"*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
			"*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
		"bool": new RegExp( "^(?:" + booleans + ")$", "i" ),
		// For use in libraries implementing .is()
		// We use this for POS matching in `select`
		"needsContext": new RegExp( "^" + whitespace + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" +
			whitespace + "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
	},

	rinputs = /^(?:input|select|textarea|button)$/i,
	rheader = /^h\d$/i,

	rnative = /^[^{]+\{\s*\[native \w/,

	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

	rsibling = /[+~]/,
	rescape = /'|\\/g,

	// CSS escapes http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
	runescape = new RegExp( "\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)", "ig" ),
	funescape = function( _, escaped, escapedWhitespace ) {
		var high = "0x" + escaped - 0x10000;
		// NaN means non-codepoint
		// Support: Firefox<24
		// Workaround erroneous numeric interpretation of +"0x"
		return high !== high || escapedWhitespace ?
			escaped :
			high < 0 ?
				// BMP codepoint
				String.fromCharCode( high + 0x10000 ) :
				// Supplemental Plane codepoint (surrogate pair)
				String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
	};

// Optimize for push.apply( _, NodeList )
try {
	push.apply(
		(arr = slice.call( preferredDoc.childNodes )),
		preferredDoc.childNodes
	);
	// Support: Android<4.0
	// Detect silently failing push.apply
	arr[ preferredDoc.childNodes.length ].nodeType;
} catch ( e ) {
	push = { apply: arr.length ?

		// Leverage slice if possible
		function( target, els ) {
			push_native.apply( target, slice.call(els) );
		} :

		// Support: IE<9
		// Otherwise append directly
		function( target, els ) {
			var j = target.length,
				i = 0;
			// Can't trust NodeList.length
			while ( (target[j++] = els[i++]) ) {}
			target.length = j - 1;
		}
	};
}

function Sizzle( selector, context, results, seed ) {
	var match, elem, m, nodeType,
		// QSA vars
		i, groups, old, nid, newContext, newSelector;

	if ( ( context ? context.ownerDocument || context : preferredDoc ) !== document ) {
		setDocument( context );
	}

	context = context || document;
	results = results || [];

	if ( !selector || typeof selector !== "string" ) {
		return results;
	}

	if ( (nodeType = context.nodeType) !== 1 && nodeType !== 9 ) {
		return [];
	}

	if ( documentIsHTML && !seed ) {

		// Shortcuts
		if ( (match = rquickExpr.exec( selector )) ) {
			// Speed-up: Sizzle("#ID")
			if ( (m = match[1]) ) {
				if ( nodeType === 9 ) {
					elem = context.getElementById( m );
					// Check parentNode to catch when Blackberry 4.6 returns
					// nodes that are no longer in the document (jQuery #6963)
					if ( elem && elem.parentNode ) {
						// Handle the case where IE, Opera, and Webkit return items
						// by name instead of ID
						if ( elem.id === m ) {
							results.push( elem );
							return results;
						}
					} else {
						return results;
					}
				} else {
					// Context is not a document
					if ( context.ownerDocument && (elem = context.ownerDocument.getElementById( m )) &&
						contains( context, elem ) && elem.id === m ) {
						results.push( elem );
						return results;
					}
				}

			// Speed-up: Sizzle("TAG")
			} else if ( match[2] ) {
				push.apply( results, context.getElementsByTagName( selector ) );
				return results;

			// Speed-up: Sizzle(".CLASS")
			} else if ( (m = match[3]) && support.getElementsByClassName && context.getElementsByClassName ) {
				push.apply( results, context.getElementsByClassName( m ) );
				return results;
			}
		}

		// QSA path
		if ( support.qsa && (!rbuggyQSA || !rbuggyQSA.test( selector )) ) {
			nid = old = expando;
			newContext = context;
			newSelector = nodeType === 9 && selector;

			// qSA works strangely on Element-rooted queries
			// We can work around this by specifying an extra ID on the root
			// and working up from there (Thanks to Andrew Dupont for the technique)
			// IE 8 doesn't work on object elements
			if ( nodeType === 1 && context.nodeName.toLowerCase() !== "object" ) {
				groups = tokenize( selector );

				if ( (old = context.getAttribute("id")) ) {
					nid = old.replace( rescape, "\\$&" );
				} else {
					context.setAttribute( "id", nid );
				}
				nid = "[id='" + nid + "'] ";

				i = groups.length;
				while ( i-- ) {
					groups[i] = nid + toSelector( groups[i] );
				}
				newContext = rsibling.test( selector ) && testContext( context.parentNode ) || context;
				newSelector = groups.join(",");
			}

			if ( newSelector ) {
				try {
					push.apply( results,
						newContext.querySelectorAll( newSelector )
					);
					return results;
				} catch(qsaError) {
				} finally {
					if ( !old ) {
						context.removeAttribute("id");
					}
				}
			}
		}
	}

	// All others
	return select( selector.replace( rtrim, "$1" ), context, results, seed );
}

/**
 * Create key-value caches of limited size
 * @returns {Function(string, Object)} Returns the Object data after storing it on itself with
 *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
 *	deleting the oldest entry
 */
function createCache() {
	var keys = [];

	function cache( key, value ) {
		// Use (key + " ") to avoid collision with native prototype properties (see Issue #157)
		if ( keys.push( key + " " ) > Expr.cacheLength ) {
			// Only keep the most recent entries
			delete cache[ keys.shift() ];
		}
		return (cache[ key + " " ] = value);
	}
	return cache;
}

/**
 * Mark a function for special use by Sizzle
 * @param {Function} fn The function to mark
 */
function markFunction( fn ) {
	fn[ expando ] = true;
	return fn;
}

/**
 * Support testing using an element
 * @param {Function} fn Passed the created div and expects a boolean result
 */
function assert( fn ) {
	var div = document.createElement("div");

	try {
		return !!fn( div );
	} catch (e) {
		return false;
	} finally {
		// Remove from its parent by default
		if ( div.parentNode ) {
			div.parentNode.removeChild( div );
		}
		// release memory in IE
		div = null;
	}
}

/**
 * Adds the same handler for all of the specified attrs
 * @param {String} attrs Pipe-separated list of attributes
 * @param {Function} handler The method that will be applied
 */
function addHandle( attrs, handler ) {
	var arr = attrs.split("|"),
		i = attrs.length;

	while ( i-- ) {
		Expr.attrHandle[ arr[i] ] = handler;
	}
}

/**
 * Checks document order of two siblings
 * @param {Element} a
 * @param {Element} b
 * @returns {Number} Returns less than 0 if a precedes b, greater than 0 if a follows b
 */
function siblingCheck( a, b ) {
	var cur = b && a,
		diff = cur && a.nodeType === 1 && b.nodeType === 1 &&
			( ~b.sourceIndex || MAX_NEGATIVE ) -
			( ~a.sourceIndex || MAX_NEGATIVE );

	// Use IE sourceIndex if available on both nodes
	if ( diff ) {
		return diff;
	}

	// Check if b follows a
	if ( cur ) {
		while ( (cur = cur.nextSibling) ) {
			if ( cur === b ) {
				return -1;
			}
		}
	}

	return a ? 1 : -1;
}

/**
 * Returns a function to use in pseudos for input types
 * @param {String} type
 */
function createInputPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return name === "input" && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for buttons
 * @param {String} type
 */
function createButtonPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return (name === "input" || name === "button") && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for positionals
 * @param {Function} fn
 */
function createPositionalPseudo( fn ) {
	return markFunction(function( argument ) {
		argument = +argument;
		return markFunction(function( seed, matches ) {
			var j,
				matchIndexes = fn( [], seed.length, argument ),
				i = matchIndexes.length;

			// Match elements found at the specified indexes
			while ( i-- ) {
				if ( seed[ (j = matchIndexes[i]) ] ) {
					seed[j] = !(matches[j] = seed[j]);
				}
			}
		});
	});
}

/**
 * Checks a node for validity as a Sizzle context
 * @param {Element|Object=} context
 * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
 */
function testContext( context ) {
	return context && typeof context.getElementsByTagName !== strundefined && context;
}

// Expose support vars for convenience
support = Sizzle.support = {};

/**
 * Detects XML nodes
 * @param {Element|Object} elem An element or a document
 * @returns {Boolean} True iff elem is a non-HTML XML node
 */
isXML = Sizzle.isXML = function( elem ) {
	// documentElement is verified for cases where it doesn't yet exist
	// (such as loading iframes in IE - #4833)
	var documentElement = elem && (elem.ownerDocument || elem).documentElement;
	return documentElement ? documentElement.nodeName !== "HTML" : false;
};

/**
 * Sets document-related variables once based on the current document
 * @param {Element|Object} [doc] An element or document object to use to set the document
 * @returns {Object} Returns the current document
 */
setDocument = Sizzle.setDocument = function( node ) {
	var hasCompare,
		doc = node ? node.ownerDocument || node : preferredDoc,
		parent = doc.defaultView;

	// If no document and documentElement is available, return
	if ( doc === document || doc.nodeType !== 9 || !doc.documentElement ) {
		return document;
	}

	// Set our document
	document = doc;
	docElem = doc.documentElement;

	// Support tests
	documentIsHTML = !isXML( doc );

	// Support: IE>8
	// If iframe document is assigned to "document" variable and if iframe has been reloaded,
	// IE will throw "permission denied" error when accessing "document" variable, see jQuery #13936
	// IE6-8 do not support the defaultView property so parent will be undefined
	if ( parent && parent !== parent.top ) {
		// IE11 does not have attachEvent, so all must suffer
		if ( parent.addEventListener ) {
			parent.addEventListener( "unload", function() {
				setDocument();
			}, false );
		} else if ( parent.attachEvent ) {
			parent.attachEvent( "onunload", function() {
				setDocument();
			});
		}
	}

	/* Attributes
	---------------------------------------------------------------------- */

	// Support: IE<8
	// Verify that getAttribute really returns attributes and not properties (excepting IE8 booleans)
	support.attributes = assert(function( div ) {
		div.className = "i";
		return !div.getAttribute("className");
	});

	/* getElement(s)By*
	---------------------------------------------------------------------- */

	// Check if getElementsByTagName("*") returns only elements
	support.getElementsByTagName = assert(function( div ) {
		div.appendChild( doc.createComment("") );
		return !div.getElementsByTagName("*").length;
	});

	// Check if getElementsByClassName can be trusted
	support.getElementsByClassName = rnative.test( doc.getElementsByClassName ) && assert(function( div ) {
		div.innerHTML = "<div class='a'></div><div class='a i'></div>";

		// Support: Safari<4
		// Catch class over-caching
		div.firstChild.className = "i";
		// Support: Opera<10
		// Catch gEBCN failure to find non-leading classes
		return div.getElementsByClassName("i").length === 2;
	});

	// Support: IE<10
	// Check if getElementById returns elements by name
	// The broken getElementById methods don't pick up programatically-set names,
	// so use a roundabout getElementsByName test
	support.getById = assert(function( div ) {
		docElem.appendChild( div ).id = expando;
		return !doc.getElementsByName || !doc.getElementsByName( expando ).length;
	});

	// ID find and filter
	if ( support.getById ) {
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== strundefined && documentIsHTML ) {
				var m = context.getElementById( id );
				// Check parentNode to catch when Blackberry 4.6 returns
				// nodes that are no longer in the document #6963
				return m && m.parentNode ? [ m ] : [];
			}
		};
		Expr.filter["ID"] = function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				return elem.getAttribute("id") === attrId;
			};
		};
	} else {
		// Support: IE6/7
		// getElementById is not reliable as a find shortcut
		delete Expr.find["ID"];

		Expr.filter["ID"] =  function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				var node = typeof elem.getAttributeNode !== strundefined && elem.getAttributeNode("id");
				return node && node.value === attrId;
			};
		};
	}

	// Tag
	Expr.find["TAG"] = support.getElementsByTagName ?
		function( tag, context ) {
			if ( typeof context.getElementsByTagName !== strundefined ) {
				return context.getElementsByTagName( tag );
			}
		} :
		function( tag, context ) {
			var elem,
				tmp = [],
				i = 0,
				results = context.getElementsByTagName( tag );

			// Filter out possible comments
			if ( tag === "*" ) {
				while ( (elem = results[i++]) ) {
					if ( elem.nodeType === 1 ) {
						tmp.push( elem );
					}
				}

				return tmp;
			}
			return results;
		};

	// Class
	Expr.find["CLASS"] = support.getElementsByClassName && function( className, context ) {
		if ( typeof context.getElementsByClassName !== strundefined && documentIsHTML ) {
			return context.getElementsByClassName( className );
		}
	};

	/* QSA/matchesSelector
	---------------------------------------------------------------------- */

	// QSA and matchesSelector support

	// matchesSelector(:active) reports false when true (IE9/Opera 11.5)
	rbuggyMatches = [];

	// qSa(:focus) reports false when true (Chrome 21)
	// We allow this because of a bug in IE8/9 that throws an error
	// whenever `document.activeElement` is accessed on an iframe
	// So, we allow :focus to pass through QSA all the time to avoid the IE error
	// See http://bugs.jquery.com/ticket/13378
	rbuggyQSA = [];

	if ( (support.qsa = rnative.test( doc.querySelectorAll )) ) {
		// Build QSA regex
		// Regex strategy adopted from Diego Perini
		assert(function( div ) {
			// Select is set to empty string on purpose
			// This is to test IE's treatment of not explicitly
			// setting a boolean content attribute,
			// since its presence should be enough
			// http://bugs.jquery.com/ticket/12359
			div.innerHTML = "<select msallowclip=''><option selected=''></option></select>";

			// Support: IE8, Opera 11-12.16
			// Nothing should be selected when empty strings follow ^= or $= or *=
			// The test attribute must be unknown in Opera but "safe" for WinRT
			// http://msdn.microsoft.com/en-us/library/ie/hh465388.aspx#attribute_section
			if ( div.querySelectorAll("[msallowclip^='']").length ) {
				rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:''|\"\")" );
			}

			// Support: IE8
			// Boolean attributes and "value" are not treated correctly
			if ( !div.querySelectorAll("[selected]").length ) {
				rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
			}

			// Webkit/Opera - :checked should return selected option elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			// IE8 throws error here and will not see later tests
			if ( !div.querySelectorAll(":checked").length ) {
				rbuggyQSA.push(":checked");
			}
		});

		assert(function( div ) {
			// Support: Windows 8 Native Apps
			// The type and name attributes are restricted during .innerHTML assignment
			var input = doc.createElement("input");
			input.setAttribute( "type", "hidden" );
			div.appendChild( input ).setAttribute( "name", "D" );

			// Support: IE8
			// Enforce case-sensitivity of name attribute
			if ( div.querySelectorAll("[name=d]").length ) {
				rbuggyQSA.push( "name" + whitespace + "*[*^$|!~]?=" );
			}

			// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
			// IE8 throws error here and will not see later tests
			if ( !div.querySelectorAll(":enabled").length ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Opera 10-11 does not throw on post-comma invalid pseudos
			div.querySelectorAll("*,:x");
			rbuggyQSA.push(",.*:");
		});
	}

	if ( (support.matchesSelector = rnative.test( (matches = docElem.matches ||
		docElem.webkitMatchesSelector ||
		docElem.mozMatchesSelector ||
		docElem.oMatchesSelector ||
		docElem.msMatchesSelector) )) ) {

		assert(function( div ) {
			// Check to see if it's possible to do matchesSelector
			// on a disconnected node (IE 9)
			support.disconnectedMatch = matches.call( div, "div" );

			// This should fail with an exception
			// Gecko does not error, returns false instead
			matches.call( div, "[s!='']:x" );
			rbuggyMatches.push( "!=", pseudos );
		});
	}

	rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join("|") );
	rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join("|") );

	/* Contains
	---------------------------------------------------------------------- */
	hasCompare = rnative.test( docElem.compareDocumentPosition );

	// Element contains another
	// Purposefully does not implement inclusive descendent
	// As in, an element does not contain itself
	contains = hasCompare || rnative.test( docElem.contains ) ?
		function( a, b ) {
			var adown = a.nodeType === 9 ? a.documentElement : a,
				bup = b && b.parentNode;
			return a === bup || !!( bup && bup.nodeType === 1 && (
				adown.contains ?
					adown.contains( bup ) :
					a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
			));
		} :
		function( a, b ) {
			if ( b ) {
				while ( (b = b.parentNode) ) {
					if ( b === a ) {
						return true;
					}
				}
			}
			return false;
		};

	/* Sorting
	---------------------------------------------------------------------- */

	// Document order sorting
	sortOrder = hasCompare ?
	function( a, b ) {

		// Flag for duplicate removal
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		// Sort on method existence if only one input has compareDocumentPosition
		var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
		if ( compare ) {
			return compare;
		}

		// Calculate position if both inputs belong to the same document
		compare = ( a.ownerDocument || a ) === ( b.ownerDocument || b ) ?
			a.compareDocumentPosition( b ) :

			// Otherwise we know they are disconnected
			1;

		// Disconnected nodes
		if ( compare & 1 ||
			(!support.sortDetached && b.compareDocumentPosition( a ) === compare) ) {

			// Choose the first element that is related to our preferred document
			if ( a === doc || a.ownerDocument === preferredDoc && contains(preferredDoc, a) ) {
				return -1;
			}
			if ( b === doc || b.ownerDocument === preferredDoc && contains(preferredDoc, b) ) {
				return 1;
			}

			// Maintain original order
			return sortInput ?
				( indexOf.call( sortInput, a ) - indexOf.call( sortInput, b ) ) :
				0;
		}

		return compare & 4 ? -1 : 1;
	} :
	function( a, b ) {
		// Exit early if the nodes are identical
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		var cur,
			i = 0,
			aup = a.parentNode,
			bup = b.parentNode,
			ap = [ a ],
			bp = [ b ];

		// Parentless nodes are either documents or disconnected
		if ( !aup || !bup ) {
			return a === doc ? -1 :
				b === doc ? 1 :
				aup ? -1 :
				bup ? 1 :
				sortInput ?
				( indexOf.call( sortInput, a ) - indexOf.call( sortInput, b ) ) :
				0;

		// If the nodes are siblings, we can do a quick check
		} else if ( aup === bup ) {
			return siblingCheck( a, b );
		}

		// Otherwise we need full lists of their ancestors for comparison
		cur = a;
		while ( (cur = cur.parentNode) ) {
			ap.unshift( cur );
		}
		cur = b;
		while ( (cur = cur.parentNode) ) {
			bp.unshift( cur );
		}

		// Walk down the tree looking for a discrepancy
		while ( ap[i] === bp[i] ) {
			i++;
		}

		return i ?
			// Do a sibling check if the nodes have a common ancestor
			siblingCheck( ap[i], bp[i] ) :

			// Otherwise nodes in our document sort first
			ap[i] === preferredDoc ? -1 :
			bp[i] === preferredDoc ? 1 :
			0;
	};

	return doc;
};

Sizzle.matches = function( expr, elements ) {
	return Sizzle( expr, null, null, elements );
};

Sizzle.matchesSelector = function( elem, expr ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	// Make sure that attribute selectors are quoted
	expr = expr.replace( rattributeQuotes, "='$1']" );

	if ( support.matchesSelector && documentIsHTML &&
		( !rbuggyMatches || !rbuggyMatches.test( expr ) ) &&
		( !rbuggyQSA     || !rbuggyQSA.test( expr ) ) ) {

		try {
			var ret = matches.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			if ( ret || support.disconnectedMatch ||
					// As well, disconnected nodes are said to be in a document
					// fragment in IE 9
					elem.document && elem.document.nodeType !== 11 ) {
				return ret;
			}
		} catch(e) {}
	}

	return Sizzle( expr, document, null, [ elem ] ).length > 0;
};

Sizzle.contains = function( context, elem ) {
	// Set document vars if needed
	if ( ( context.ownerDocument || context ) !== document ) {
		setDocument( context );
	}
	return contains( context, elem );
};

Sizzle.attr = function( elem, name ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	var fn = Expr.attrHandle[ name.toLowerCase() ],
		// Don't get fooled by Object.prototype properties (jQuery #13807)
		val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
			fn( elem, name, !documentIsHTML ) :
			undefined;

	return val !== undefined ?
		val :
		support.attributes || !documentIsHTML ?
			elem.getAttribute( name ) :
			(val = elem.getAttributeNode(name)) && val.specified ?
				val.value :
				null;
};

Sizzle.error = function( msg ) {
	throw new Error( "Syntax error, unrecognized expression: " + msg );
};

/**
 * Document sorting and removing duplicates
 * @param {ArrayLike} results
 */
Sizzle.uniqueSort = function( results ) {
	var elem,
		duplicates = [],
		j = 0,
		i = 0;

	// Unless we *know* we can detect duplicates, assume their presence
	hasDuplicate = !support.detectDuplicates;
	sortInput = !support.sortStable && results.slice( 0 );
	results.sort( sortOrder );

	if ( hasDuplicate ) {
		while ( (elem = results[i++]) ) {
			if ( elem === results[ i ] ) {
				j = duplicates.push( i );
			}
		}
		while ( j-- ) {
			results.splice( duplicates[ j ], 1 );
		}
	}

	// Clear input after sorting to release objects
	// See https://github.com/jquery/sizzle/pull/225
	sortInput = null;

	return results;
};

/**
 * Utility function for retrieving the text value of an array of DOM nodes
 * @param {Array|Element} elem
 */
getText = Sizzle.getText = function( elem ) {
	var node,
		ret = "",
		i = 0,
		nodeType = elem.nodeType;

	if ( !nodeType ) {
		// If no nodeType, this is expected to be an array
		while ( (node = elem[i++]) ) {
			// Do not traverse comment nodes
			ret += getText( node );
		}
	} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
		// Use textContent for elements
		// innerText usage removed for consistency of new lines (jQuery #11153)
		if ( typeof elem.textContent === "string" ) {
			return elem.textContent;
		} else {
			// Traverse its children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				ret += getText( elem );
			}
		}
	} else if ( nodeType === 3 || nodeType === 4 ) {
		return elem.nodeValue;
	}
	// Do not include comment or processing instruction nodes

	return ret;
};

Expr = Sizzle.selectors = {

	// Can be adjusted by the user
	cacheLength: 50,

	createPseudo: markFunction,

	match: matchExpr,

	attrHandle: {},

	find: {},

	relative: {
		">": { dir: "parentNode", first: true },
		" ": { dir: "parentNode" },
		"+": { dir: "previousSibling", first: true },
		"~": { dir: "previousSibling" }
	},

	preFilter: {
		"ATTR": function( match ) {
			match[1] = match[1].replace( runescape, funescape );

			// Move the given value to match[3] whether quoted or unquoted
			match[3] = ( match[3] || match[4] || match[5] || "" ).replace( runescape, funescape );

			if ( match[2] === "~=" ) {
				match[3] = " " + match[3] + " ";
			}

			return match.slice( 0, 4 );
		},

		"CHILD": function( match ) {
			/* matches from matchExpr["CHILD"]
				1 type (only|nth|...)
				2 what (child|of-type)
				3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
				4 xn-component of xn+y argument ([+-]?\d*n|)
				5 sign of xn-component
				6 x of xn-component
				7 sign of y-component
				8 y of y-component
			*/
			match[1] = match[1].toLowerCase();

			if ( match[1].slice( 0, 3 ) === "nth" ) {
				// nth-* requires argument
				if ( !match[3] ) {
					Sizzle.error( match[0] );
				}

				// numeric x and y parameters for Expr.filter.CHILD
				// remember that false/true cast respectively to 0/1
				match[4] = +( match[4] ? match[5] + (match[6] || 1) : 2 * ( match[3] === "even" || match[3] === "odd" ) );
				match[5] = +( ( match[7] + match[8] ) || match[3] === "odd" );

			// other types prohibit arguments
			} else if ( match[3] ) {
				Sizzle.error( match[0] );
			}

			return match;
		},

		"PSEUDO": function( match ) {
			var excess,
				unquoted = !match[6] && match[2];

			if ( matchExpr["CHILD"].test( match[0] ) ) {
				return null;
			}

			// Accept quoted arguments as-is
			if ( match[3] ) {
				match[2] = match[4] || match[5] || "";

			// Strip excess characters from unquoted arguments
			} else if ( unquoted && rpseudo.test( unquoted ) &&
				// Get excess from tokenize (recursively)
				(excess = tokenize( unquoted, true )) &&
				// advance to the next closing parenthesis
				(excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length) ) {

				// excess is a negative index
				match[0] = match[0].slice( 0, excess );
				match[2] = unquoted.slice( 0, excess );
			}

			// Return only captures needed by the pseudo filter method (type and argument)
			return match.slice( 0, 3 );
		}
	},

	filter: {

		"TAG": function( nodeNameSelector ) {
			var nodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
			return nodeNameSelector === "*" ?
				function() { return true; } :
				function( elem ) {
					return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
				};
		},

		"CLASS": function( className ) {
			var pattern = classCache[ className + " " ];

			return pattern ||
				(pattern = new RegExp( "(^|" + whitespace + ")" + className + "(" + whitespace + "|$)" )) &&
				classCache( className, function( elem ) {
					return pattern.test( typeof elem.className === "string" && elem.className || typeof elem.getAttribute !== strundefined && elem.getAttribute("class") || "" );
				});
		},

		"ATTR": function( name, operator, check ) {
			return function( elem ) {
				var result = Sizzle.attr( elem, name );

				if ( result == null ) {
					return operator === "!=";
				}
				if ( !operator ) {
					return true;
				}

				result += "";

				return operator === "=" ? result === check :
					operator === "!=" ? result !== check :
					operator === "^=" ? check && result.indexOf( check ) === 0 :
					operator === "*=" ? check && result.indexOf( check ) > -1 :
					operator === "$=" ? check && result.slice( -check.length ) === check :
					operator === "~=" ? ( " " + result + " " ).indexOf( check ) > -1 :
					operator === "|=" ? result === check || result.slice( 0, check.length + 1 ) === check + "-" :
					false;
			};
		},

		"CHILD": function( type, what, argument, first, last ) {
			var simple = type.slice( 0, 3 ) !== "nth",
				forward = type.slice( -4 ) !== "last",
				ofType = what === "of-type";

			return first === 1 && last === 0 ?

				// Shortcut for :nth-*(n)
				function( elem ) {
					return !!elem.parentNode;
				} :

				function( elem, context, xml ) {
					var cache, outerCache, node, diff, nodeIndex, start,
						dir = simple !== forward ? "nextSibling" : "previousSibling",
						parent = elem.parentNode,
						name = ofType && elem.nodeName.toLowerCase(),
						useCache = !xml && !ofType;

					if ( parent ) {

						// :(first|last|only)-(child|of-type)
						if ( simple ) {
							while ( dir ) {
								node = elem;
								while ( (node = node[ dir ]) ) {
									if ( ofType ? node.nodeName.toLowerCase() === name : node.nodeType === 1 ) {
										return false;
									}
								}
								// Reverse direction for :only-* (if we haven't yet done so)
								start = dir = type === "only" && !start && "nextSibling";
							}
							return true;
						}

						start = [ forward ? parent.firstChild : parent.lastChild ];

						// non-xml :nth-child(...) stores cache data on `parent`
						if ( forward && useCache ) {
							// Seek `elem` from a previously-cached index
							outerCache = parent[ expando ] || (parent[ expando ] = {});
							cache = outerCache[ type ] || [];
							nodeIndex = cache[0] === dirruns && cache[1];
							diff = cache[0] === dirruns && cache[2];
							node = nodeIndex && parent.childNodes[ nodeIndex ];

							while ( (node = ++nodeIndex && node && node[ dir ] ||

								// Fallback to seeking `elem` from the start
								(diff = nodeIndex = 0) || start.pop()) ) {

								// When found, cache indexes on `parent` and break
								if ( node.nodeType === 1 && ++diff && node === elem ) {
									outerCache[ type ] = [ dirruns, nodeIndex, diff ];
									break;
								}
							}

						// Use previously-cached element index if available
						} else if ( useCache && (cache = (elem[ expando ] || (elem[ expando ] = {}))[ type ]) && cache[0] === dirruns ) {
							diff = cache[1];

						// xml :nth-child(...) or :nth-last-child(...) or :nth(-last)?-of-type(...)
						} else {
							// Use the same loop as above to seek `elem` from the start
							while ( (node = ++nodeIndex && node && node[ dir ] ||
								(diff = nodeIndex = 0) || start.pop()) ) {

								if ( ( ofType ? node.nodeName.toLowerCase() === name : node.nodeType === 1 ) && ++diff ) {
									// Cache the index of each encountered element
									if ( useCache ) {
										(node[ expando ] || (node[ expando ] = {}))[ type ] = [ dirruns, diff ];
									}

									if ( node === elem ) {
										break;
									}
								}
							}
						}

						// Incorporate the offset, then check against cycle size
						diff -= last;
						return diff === first || ( diff % first === 0 && diff / first >= 0 );
					}
				};
		},

		"PSEUDO": function( pseudo, argument ) {
			// pseudo-class names are case-insensitive
			// http://www.w3.org/TR/selectors/#pseudo-classes
			// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
			// Remember that setFilters inherits from pseudos
			var args,
				fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
					Sizzle.error( "unsupported pseudo: " + pseudo );

			// The user may use createPseudo to indicate that
			// arguments are needed to create the filter function
			// just as Sizzle does
			if ( fn[ expando ] ) {
				return fn( argument );
			}

			// But maintain support for old signatures
			if ( fn.length > 1 ) {
				args = [ pseudo, pseudo, "", argument ];
				return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
					markFunction(function( seed, matches ) {
						var idx,
							matched = fn( seed, argument ),
							i = matched.length;
						while ( i-- ) {
							idx = indexOf.call( seed, matched[i] );
							seed[ idx ] = !( matches[ idx ] = matched[i] );
						}
					}) :
					function( elem ) {
						return fn( elem, 0, args );
					};
			}

			return fn;
		}
	},

	pseudos: {
		// Potentially complex pseudos
		"not": markFunction(function( selector ) {
			// Trim the selector passed to compile
			// to avoid treating leading and trailing
			// spaces as combinators
			var input = [],
				results = [],
				matcher = compile( selector.replace( rtrim, "$1" ) );

			return matcher[ expando ] ?
				markFunction(function( seed, matches, context, xml ) {
					var elem,
						unmatched = matcher( seed, null, xml, [] ),
						i = seed.length;

					// Match elements unmatched by `matcher`
					while ( i-- ) {
						if ( (elem = unmatched[i]) ) {
							seed[i] = !(matches[i] = elem);
						}
					}
				}) :
				function( elem, context, xml ) {
					input[0] = elem;
					matcher( input, null, xml, results );
					return !results.pop();
				};
		}),

		"has": markFunction(function( selector ) {
			return function( elem ) {
				return Sizzle( selector, elem ).length > 0;
			};
		}),

		"contains": markFunction(function( text ) {
			return function( elem ) {
				return ( elem.textContent || elem.innerText || getText( elem ) ).indexOf( text ) > -1;
			};
		}),

		// "Whether an element is represented by a :lang() selector
		// is based solely on the element's language value
		// being equal to the identifier C,
		// or beginning with the identifier C immediately followed by "-".
		// The matching of C against the element's language value is performed case-insensitively.
		// The identifier C does not have to be a valid language name."
		// http://www.w3.org/TR/selectors/#lang-pseudo
		"lang": markFunction( function( lang ) {
			// lang value must be a valid identifier
			if ( !ridentifier.test(lang || "") ) {
				Sizzle.error( "unsupported lang: " + lang );
			}
			lang = lang.replace( runescape, funescape ).toLowerCase();
			return function( elem ) {
				var elemLang;
				do {
					if ( (elemLang = documentIsHTML ?
						elem.lang :
						elem.getAttribute("xml:lang") || elem.getAttribute("lang")) ) {

						elemLang = elemLang.toLowerCase();
						return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
					}
				} while ( (elem = elem.parentNode) && elem.nodeType === 1 );
				return false;
			};
		}),

		// Miscellaneous
		"target": function( elem ) {
			var hash = window.location && window.location.hash;
			return hash && hash.slice( 1 ) === elem.id;
		},

		"root": function( elem ) {
			return elem === docElem;
		},

		"focus": function( elem ) {
			return elem === document.activeElement && (!document.hasFocus || document.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
		},

		// Boolean properties
		"enabled": function( elem ) {
			return elem.disabled === false;
		},

		"disabled": function( elem ) {
			return elem.disabled === true;
		},

		"checked": function( elem ) {
			// In CSS3, :checked should return both checked and selected elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			var nodeName = elem.nodeName.toLowerCase();
			return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
		},

		"selected": function( elem ) {
			// Accessing this property makes selected-by-default
			// options in Safari work properly
			if ( elem.parentNode ) {
				elem.parentNode.selectedIndex;
			}

			return elem.selected === true;
		},

		// Contents
		"empty": function( elem ) {
			// http://www.w3.org/TR/selectors/#empty-pseudo
			// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
			//   but not by others (comment: 8; processing instruction: 7; etc.)
			// nodeType < 6 works because attributes (2) do not appear as children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				if ( elem.nodeType < 6 ) {
					return false;
				}
			}
			return true;
		},

		"parent": function( elem ) {
			return !Expr.pseudos["empty"]( elem );
		},

		// Element/input types
		"header": function( elem ) {
			return rheader.test( elem.nodeName );
		},

		"input": function( elem ) {
			return rinputs.test( elem.nodeName );
		},

		"button": function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return name === "input" && elem.type === "button" || name === "button";
		},

		"text": function( elem ) {
			var attr;
			return elem.nodeName.toLowerCase() === "input" &&
				elem.type === "text" &&

				// Support: IE<8
				// New HTML5 attribute values (e.g., "search") appear with elem.type === "text"
				( (attr = elem.getAttribute("type")) == null || attr.toLowerCase() === "text" );
		},

		// Position-in-collection
		"first": createPositionalPseudo(function() {
			return [ 0 ];
		}),

		"last": createPositionalPseudo(function( matchIndexes, length ) {
			return [ length - 1 ];
		}),

		"eq": createPositionalPseudo(function( matchIndexes, length, argument ) {
			return [ argument < 0 ? argument + length : argument ];
		}),

		"even": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 0;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"odd": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 1;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"lt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; --i >= 0; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"gt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; ++i < length; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		})
	}
};

Expr.pseudos["nth"] = Expr.pseudos["eq"];

// Add button/input type pseudos
for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
	Expr.pseudos[ i ] = createInputPseudo( i );
}
for ( i in { submit: true, reset: true } ) {
	Expr.pseudos[ i ] = createButtonPseudo( i );
}

// Easy API for creating new setFilters
function setFilters() {}
setFilters.prototype = Expr.filters = Expr.pseudos;
Expr.setFilters = new setFilters();

tokenize = Sizzle.tokenize = function( selector, parseOnly ) {
	var matched, match, tokens, type,
		soFar, groups, preFilters,
		cached = tokenCache[ selector + " " ];

	if ( cached ) {
		return parseOnly ? 0 : cached.slice( 0 );
	}

	soFar = selector;
	groups = [];
	preFilters = Expr.preFilter;

	while ( soFar ) {

		// Comma and first run
		if ( !matched || (match = rcomma.exec( soFar )) ) {
			if ( match ) {
				// Don't consume trailing commas as valid
				soFar = soFar.slice( match[0].length ) || soFar;
			}
			groups.push( (tokens = []) );
		}

		matched = false;

		// Combinators
		if ( (match = rcombinators.exec( soFar )) ) {
			matched = match.shift();
			tokens.push({
				value: matched,
				// Cast descendant combinators to space
				type: match[0].replace( rtrim, " " )
			});
			soFar = soFar.slice( matched.length );
		}

		// Filters
		for ( type in Expr.filter ) {
			if ( (match = matchExpr[ type ].exec( soFar )) && (!preFilters[ type ] ||
				(match = preFilters[ type ]( match ))) ) {
				matched = match.shift();
				tokens.push({
					value: matched,
					type: type,
					matches: match
				});
				soFar = soFar.slice( matched.length );
			}
		}

		if ( !matched ) {
			break;
		}
	}

	// Return the length of the invalid excess
	// if we're just parsing
	// Otherwise, throw an error or return tokens
	return parseOnly ?
		soFar.length :
		soFar ?
			Sizzle.error( selector ) :
			// Cache the tokens
			tokenCache( selector, groups ).slice( 0 );
};

function toSelector( tokens ) {
	var i = 0,
		len = tokens.length,
		selector = "";
	for ( ; i < len; i++ ) {
		selector += tokens[i].value;
	}
	return selector;
}

function addCombinator( matcher, combinator, base ) {
	var dir = combinator.dir,
		checkNonElements = base && dir === "parentNode",
		doneName = done++;

	return combinator.first ?
		// Check against closest ancestor/preceding element
		function( elem, context, xml ) {
			while ( (elem = elem[ dir ]) ) {
				if ( elem.nodeType === 1 || checkNonElements ) {
					return matcher( elem, context, xml );
				}
			}
		} :

		// Check against all ancestor/preceding elements
		function( elem, context, xml ) {
			var oldCache, outerCache,
				newCache = [ dirruns, doneName ];

			// We can't set arbitrary data on XML nodes, so they don't benefit from dir caching
			if ( xml ) {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						if ( matcher( elem, context, xml ) ) {
							return true;
						}
					}
				}
			} else {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						outerCache = elem[ expando ] || (elem[ expando ] = {});
						if ( (oldCache = outerCache[ dir ]) &&
							oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

							// Assign to newCache so results back-propagate to previous elements
							return (newCache[ 2 ] = oldCache[ 2 ]);
						} else {
							// Reuse newcache so results back-propagate to previous elements
							outerCache[ dir ] = newCache;

							// A match means we're done; a fail means we have to keep checking
							if ( (newCache[ 2 ] = matcher( elem, context, xml )) ) {
								return true;
							}
						}
					}
				}
			}
		};
}

function elementMatcher( matchers ) {
	return matchers.length > 1 ?
		function( elem, context, xml ) {
			var i = matchers.length;
			while ( i-- ) {
				if ( !matchers[i]( elem, context, xml ) ) {
					return false;
				}
			}
			return true;
		} :
		matchers[0];
}

function multipleContexts( selector, contexts, results ) {
	var i = 0,
		len = contexts.length;
	for ( ; i < len; i++ ) {
		Sizzle( selector, contexts[i], results );
	}
	return results;
}

function condense( unmatched, map, filter, context, xml ) {
	var elem,
		newUnmatched = [],
		i = 0,
		len = unmatched.length,
		mapped = map != null;

	for ( ; i < len; i++ ) {
		if ( (elem = unmatched[i]) ) {
			if ( !filter || filter( elem, context, xml ) ) {
				newUnmatched.push( elem );
				if ( mapped ) {
					map.push( i );
				}
			}
		}
	}

	return newUnmatched;
}

function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
	if ( postFilter && !postFilter[ expando ] ) {
		postFilter = setMatcher( postFilter );
	}
	if ( postFinder && !postFinder[ expando ] ) {
		postFinder = setMatcher( postFinder, postSelector );
	}
	return markFunction(function( seed, results, context, xml ) {
		var temp, i, elem,
			preMap = [],
			postMap = [],
			preexisting = results.length,

			// Get initial elements from seed or context
			elems = seed || multipleContexts( selector || "*", context.nodeType ? [ context ] : context, [] ),

			// Prefilter to get matcher input, preserving a map for seed-results synchronization
			matcherIn = preFilter && ( seed || !selector ) ?
				condense( elems, preMap, preFilter, context, xml ) :
				elems,

			matcherOut = matcher ?
				// If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
				postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

					// ...intermediate processing is necessary
					[] :

					// ...otherwise use results directly
					results :
				matcherIn;

		// Find primary matches
		if ( matcher ) {
			matcher( matcherIn, matcherOut, context, xml );
		}

		// Apply postFilter
		if ( postFilter ) {
			temp = condense( matcherOut, postMap );
			postFilter( temp, [], context, xml );

			// Un-match failing elements by moving them back to matcherIn
			i = temp.length;
			while ( i-- ) {
				if ( (elem = temp[i]) ) {
					matcherOut[ postMap[i] ] = !(matcherIn[ postMap[i] ] = elem);
				}
			}
		}

		if ( seed ) {
			if ( postFinder || preFilter ) {
				if ( postFinder ) {
					// Get the final matcherOut by condensing this intermediate into postFinder contexts
					temp = [];
					i = matcherOut.length;
					while ( i-- ) {
						if ( (elem = matcherOut[i]) ) {
							// Restore matcherIn since elem is not yet a final match
							temp.push( (matcherIn[i] = elem) );
						}
					}
					postFinder( null, (matcherOut = []), temp, xml );
				}

				// Move matched elements from seed to results to keep them synchronized
				i = matcherOut.length;
				while ( i-- ) {
					if ( (elem = matcherOut[i]) &&
						(temp = postFinder ? indexOf.call( seed, elem ) : preMap[i]) > -1 ) {

						seed[temp] = !(results[temp] = elem);
					}
				}
			}

		// Add elements to results, through postFinder if defined
		} else {
			matcherOut = condense(
				matcherOut === results ?
					matcherOut.splice( preexisting, matcherOut.length ) :
					matcherOut
			);
			if ( postFinder ) {
				postFinder( null, results, matcherOut, xml );
			} else {
				push.apply( results, matcherOut );
			}
		}
	});
}

function matcherFromTokens( tokens ) {
	var checkContext, matcher, j,
		len = tokens.length,
		leadingRelative = Expr.relative[ tokens[0].type ],
		implicitRelative = leadingRelative || Expr.relative[" "],
		i = leadingRelative ? 1 : 0,

		// The foundational matcher ensures that elements are reachable from top-level context(s)
		matchContext = addCombinator( function( elem ) {
			return elem === checkContext;
		}, implicitRelative, true ),
		matchAnyContext = addCombinator( function( elem ) {
			return indexOf.call( checkContext, elem ) > -1;
		}, implicitRelative, true ),
		matchers = [ function( elem, context, xml ) {
			return ( !leadingRelative && ( xml || context !== outermostContext ) ) || (
				(checkContext = context).nodeType ?
					matchContext( elem, context, xml ) :
					matchAnyContext( elem, context, xml ) );
		} ];

	for ( ; i < len; i++ ) {
		if ( (matcher = Expr.relative[ tokens[i].type ]) ) {
			matchers = [ addCombinator(elementMatcher( matchers ), matcher) ];
		} else {
			matcher = Expr.filter[ tokens[i].type ].apply( null, tokens[i].matches );

			// Return special upon seeing a positional matcher
			if ( matcher[ expando ] ) {
				// Find the next relative operator (if any) for proper handling
				j = ++i;
				for ( ; j < len; j++ ) {
					if ( Expr.relative[ tokens[j].type ] ) {
						break;
					}
				}
				return setMatcher(
					i > 1 && elementMatcher( matchers ),
					i > 1 && toSelector(
						// If the preceding token was a descendant combinator, insert an implicit any-element `*`
						tokens.slice( 0, i - 1 ).concat({ value: tokens[ i - 2 ].type === " " ? "*" : "" })
					).replace( rtrim, "$1" ),
					matcher,
					i < j && matcherFromTokens( tokens.slice( i, j ) ),
					j < len && matcherFromTokens( (tokens = tokens.slice( j )) ),
					j < len && toSelector( tokens )
				);
			}
			matchers.push( matcher );
		}
	}

	return elementMatcher( matchers );
}

function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
	var bySet = setMatchers.length > 0,
		byElement = elementMatchers.length > 0,
		superMatcher = function( seed, context, xml, results, outermost ) {
			var elem, j, matcher,
				matchedCount = 0,
				i = "0",
				unmatched = seed && [],
				setMatched = [],
				contextBackup = outermostContext,
				// We must always have either seed elements or outermost context
				elems = seed || byElement && Expr.find["TAG"]( "*", outermost ),
				// Use integer dirruns iff this is the outermost matcher
				dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.random() || 0.1),
				len = elems.length;

			if ( outermost ) {
				outermostContext = context !== document && context;
			}

			// Add elements passing elementMatchers directly to results
			// Keep `i` a string if there are no elements so `matchedCount` will be "00" below
			// Support: IE<9, Safari
			// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching elements by id
			for ( ; i !== len && (elem = elems[i]) != null; i++ ) {
				if ( byElement && elem ) {
					j = 0;
					while ( (matcher = elementMatchers[j++]) ) {
						if ( matcher( elem, context, xml ) ) {
							results.push( elem );
							break;
						}
					}
					if ( outermost ) {
						dirruns = dirrunsUnique;
					}
				}

				// Track unmatched elements for set filters
				if ( bySet ) {
					// They will have gone through all possible matchers
					if ( (elem = !matcher && elem) ) {
						matchedCount--;
					}

					// Lengthen the array for every element, matched or not
					if ( seed ) {
						unmatched.push( elem );
					}
				}
			}

			// Apply set filters to unmatched elements
			matchedCount += i;
			if ( bySet && i !== matchedCount ) {
				j = 0;
				while ( (matcher = setMatchers[j++]) ) {
					matcher( unmatched, setMatched, context, xml );
				}

				if ( seed ) {
					// Reintegrate element matches to eliminate the need for sorting
					if ( matchedCount > 0 ) {
						while ( i-- ) {
							if ( !(unmatched[i] || setMatched[i]) ) {
								setMatched[i] = pop.call( results );
							}
						}
					}

					// Discard index placeholder values to get only actual matches
					setMatched = condense( setMatched );
				}

				// Add matches to results
				push.apply( results, setMatched );

				// Seedless set matches succeeding multiple successful matchers stipulate sorting
				if ( outermost && !seed && setMatched.length > 0 &&
					( matchedCount + setMatchers.length ) > 1 ) {

					Sizzle.uniqueSort( results );
				}
			}

			// Override manipulation of globals by nested matchers
			if ( outermost ) {
				dirruns = dirrunsUnique;
				outermostContext = contextBackup;
			}

			return unmatched;
		};

	return bySet ?
		markFunction( superMatcher ) :
		superMatcher;
}

compile = Sizzle.compile = function( selector, match /* Internal Use Only */ ) {
	var i,
		setMatchers = [],
		elementMatchers = [],
		cached = compilerCache[ selector + " " ];

	if ( !cached ) {
		// Generate a function of recursive functions that can be used to check each element
		if ( !match ) {
			match = tokenize( selector );
		}
		i = match.length;
		while ( i-- ) {
			cached = matcherFromTokens( match[i] );
			if ( cached[ expando ] ) {
				setMatchers.push( cached );
			} else {
				elementMatchers.push( cached );
			}
		}

		// Cache the compiled function
		cached = compilerCache( selector, matcherFromGroupMatchers( elementMatchers, setMatchers ) );

		// Save selector and tokenization
		cached.selector = selector;
	}
	return cached;
};

/**
 * A low-level selection function that works with Sizzle's compiled
 *  selector functions
 * @param {String|Function} selector A selector or a pre-compiled
 *  selector function built with Sizzle.compile
 * @param {Element} context
 * @param {Array} [results]
 * @param {Array} [seed] A set of elements to match against
 */
select = Sizzle.select = function( selector, context, results, seed ) {
	var i, tokens, token, type, find,
		compiled = typeof selector === "function" && selector,
		match = !seed && tokenize( (selector = compiled.selector || selector) );

	results = results || [];

	// Try to minimize operations if there is no seed and only one group
	if ( match.length === 1 ) {

		// Take a shortcut and set the context if the root selector is an ID
		tokens = match[0] = match[0].slice( 0 );
		if ( tokens.length > 2 && (token = tokens[0]).type === "ID" &&
				support.getById && context.nodeType === 9 && documentIsHTML &&
				Expr.relative[ tokens[1].type ] ) {

			context = ( Expr.find["ID"]( token.matches[0].replace(runescape, funescape), context ) || [] )[0];
			if ( !context ) {
				return results;

			// Precompiled matchers will still verify ancestry, so step up a level
			} else if ( compiled ) {
				context = context.parentNode;
			}

			selector = selector.slice( tokens.shift().value.length );
		}

		// Fetch a seed set for right-to-left matching
		i = matchExpr["needsContext"].test( selector ) ? 0 : tokens.length;
		while ( i-- ) {
			token = tokens[i];

			// Abort if we hit a combinator
			if ( Expr.relative[ (type = token.type) ] ) {
				break;
			}
			if ( (find = Expr.find[ type ]) ) {
				// Search, expanding context for leading sibling combinators
				if ( (seed = find(
					token.matches[0].replace( runescape, funescape ),
					rsibling.test( tokens[0].type ) && testContext( context.parentNode ) || context
				)) ) {

					// If seed is empty or no tokens remain, we can return early
					tokens.splice( i, 1 );
					selector = seed.length && toSelector( tokens );
					if ( !selector ) {
						push.apply( results, seed );
						return results;
					}

					break;
				}
			}
		}
	}

	// Compile and execute a filtering function if one is not provided
	// Provide `match` to avoid retokenization if we modified the selector above
	( compiled || compile( selector, match ) )(
		seed,
		context,
		!documentIsHTML,
		results,
		rsibling.test( selector ) && testContext( context.parentNode ) || context
	);
	return results;
};

// One-time assignments

// Sort stability
support.sortStable = expando.split("").sort( sortOrder ).join("") === expando;

// Support: Chrome<14
// Always assume duplicates if they aren't passed to the comparison function
support.detectDuplicates = !!hasDuplicate;

// Initialize against the default document
setDocument();

// Support: Webkit<537.32 - Safari 6.0.3/Chrome 25 (fixed in Chrome 27)
// Detached nodes confoundingly follow *each other*
support.sortDetached = assert(function( div1 ) {
	// Should return 1, but returns 4 (following)
	return div1.compareDocumentPosition( document.createElement("div") ) & 1;
});

// Support: IE<8
// Prevent attribute/property "interpolation"
// http://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
if ( !assert(function( div ) {
	div.innerHTML = "<a href='#'></a>";
	return div.firstChild.getAttribute("href") === "#" ;
}) ) {
	addHandle( "type|href|height|width", function( elem, name, isXML ) {
		if ( !isXML ) {
			return elem.getAttribute( name, name.toLowerCase() === "type" ? 1 : 2 );
		}
	});
}

// Support: IE<9
// Use defaultValue in place of getAttribute("value")
if ( !support.attributes || !assert(function( div ) {
	div.innerHTML = "<input/>";
	div.firstChild.setAttribute( "value", "" );
	return div.firstChild.getAttribute( "value" ) === "";
}) ) {
	addHandle( "value", function( elem, name, isXML ) {
		if ( !isXML && elem.nodeName.toLowerCase() === "input" ) {
			return elem.defaultValue;
		}
	});
}

// Support: IE<9
// Use getAttributeNode to fetch booleans when getAttribute lies
if ( !assert(function( div ) {
	return div.getAttribute("disabled") == null;
}) ) {
	addHandle( booleans, function( elem, name, isXML ) {
		var val;
		if ( !isXML ) {
			return elem[ name ] === true ? name.toLowerCase() :
					(val = elem.getAttributeNode( name )) && val.specified ?
					val.value :
				null;
		}
	});
}

return Sizzle;

})( window );



jQuery.find = Sizzle;
jQuery.expr = Sizzle.selectors;
jQuery.expr[":"] = jQuery.expr.pseudos;
jQuery.unique = Sizzle.uniqueSort;
jQuery.text = Sizzle.getText;
jQuery.isXMLDoc = Sizzle.isXML;
jQuery.contains = Sizzle.contains;



var rneedsContext = jQuery.expr.match.needsContext;

var rsingleTag = (/^<(\w+)\s*\/?>(?:<\/\1>|)$/);



var risSimple = /^.[^:#\[\.,]*$/;

// Implement the identical functionality for filter and not
function winnow( elements, qualifier, not ) {
	if ( jQuery.isFunction( qualifier ) ) {
		return jQuery.grep( elements, function( elem, i ) {
			/* jshint -W018 */
			return !!qualifier.call( elem, i, elem ) !== not;
		});

	}

	if ( qualifier.nodeType ) {
		return jQuery.grep( elements, function( elem ) {
			return ( elem === qualifier ) !== not;
		});

	}

	if ( typeof qualifier === "string" ) {
		if ( risSimple.test( qualifier ) ) {
			return jQuery.filter( qualifier, elements, not );
		}

		qualifier = jQuery.filter( qualifier, elements );
	}

	return jQuery.grep( elements, function( elem ) {
		return ( indexOf.call( qualifier, elem ) >= 0 ) !== not;
	});
}

jQuery.filter = function( expr, elems, not ) {
	var elem = elems[ 0 ];

	if ( not ) {
		expr = ":not(" + expr + ")";
	}

	return elems.length === 1 && elem.nodeType === 1 ?
		jQuery.find.matchesSelector( elem, expr ) ? [ elem ] : [] :
		jQuery.find.matches( expr, jQuery.grep( elems, function( elem ) {
			return elem.nodeType === 1;
		}));
};

jQuery.fn.extend({
	find: function( selector ) {
		var i,
			len = this.length,
			ret = [],
			self = this;

		if ( typeof selector !== "string" ) {
			return this.pushStack( jQuery( selector ).filter(function() {
				for ( i = 0; i < len; i++ ) {
					if ( jQuery.contains( self[ i ], this ) ) {
						return true;
					}
				}
			}) );
		}

		for ( i = 0; i < len; i++ ) {
			jQuery.find( selector, self[ i ], ret );
		}

		// Needed because $( selector, context ) becomes $( context ).find( selector )
		ret = this.pushStack( len > 1 ? jQuery.unique( ret ) : ret );
		ret.selector = this.selector ? this.selector + " " + selector : selector;
		return ret;
	},
	filter: function( selector ) {
		return this.pushStack( winnow(this, selector || [], false) );
	},
	not: function( selector ) {
		return this.pushStack( winnow(this, selector || [], true) );
	},
	is: function( selector ) {
		return !!winnow(
			this,

			// If this is a positional/relative selector, check membership in the returned set
			// so $("p:first").is("p:last") won't return true for a doc with two "p".
			typeof selector === "string" && rneedsContext.test( selector ) ?
				jQuery( selector ) :
				selector || [],
			false
		).length;
	}
});


// Initialize a jQuery object


// A central reference to the root jQuery(document)
var rootjQuery,

	// A simple way to check for HTML strings
	// Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
	// Strict HTML recognition (#11290: must start with <)
	rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,

	init = jQuery.fn.init = function( selector, context ) {
		var match, elem;

		// HANDLE: $(""), $(null), $(undefined), $(false)
		if ( !selector ) {
			return this;
		}

		// Handle HTML strings
		if ( typeof selector === "string" ) {
			if ( selector[0] === "<" && selector[ selector.length - 1 ] === ">" && selector.length >= 3 ) {
				// Assume that strings that start and end with <> are HTML and skip the regex check
				match = [ null, selector, null ];

			} else {
				match = rquickExpr.exec( selector );
			}

			// Match html or make sure no context is specified for #id
			if ( match && (match[1] || !context) ) {

				// HANDLE: $(html) -> $(array)
				if ( match[1] ) {
					context = context instanceof jQuery ? context[0] : context;

					// scripts is true for back-compat
					// Intentionally let the error be thrown if parseHTML is not present
					jQuery.merge( this, jQuery.parseHTML(
						match[1],
						context && context.nodeType ? context.ownerDocument || context : document,
						true
					) );

					// HANDLE: $(html, props)
					if ( rsingleTag.test( match[1] ) && jQuery.isPlainObject( context ) ) {
						for ( match in context ) {
							// Properties of context are called as methods if possible
							if ( jQuery.isFunction( this[ match ] ) ) {
								this[ match ]( context[ match ] );

							// ...and otherwise set as attributes
							} else {
								this.attr( match, context[ match ] );
							}
						}
					}

					return this;

				// HANDLE: $(#id)
				} else {
					elem = document.getElementById( match[2] );

					// Check parentNode to catch when Blackberry 4.6 returns
					// nodes that are no longer in the document #6963
					if ( elem && elem.parentNode ) {
						// Inject the element directly into the jQuery object
						this.length = 1;
						this[0] = elem;
					}

					this.context = document;
					this.selector = selector;
					return this;
				}

			// HANDLE: $(expr, $(...))
			} else if ( !context || context.jquery ) {
				return ( context || rootjQuery ).find( selector );

			// HANDLE: $(expr, context)
			// (which is just equivalent to: $(context).find(expr)
			} else {
				return this.constructor( context ).find( selector );
			}

		// HANDLE: $(DOMElement)
		} else if ( selector.nodeType ) {
			this.context = this[0] = selector;
			this.length = 1;
			return this;

		// HANDLE: $(function)
		// Shortcut for document ready
		} else if ( jQuery.isFunction( selector ) ) {
			return typeof rootjQuery.ready !== "undefined" ?
				rootjQuery.ready( selector ) :
				// Execute immediately if ready is not present
				selector( jQuery );
		}

		if ( selector.selector !== undefined ) {
			this.selector = selector.selector;
			this.context = selector.context;
		}

		return jQuery.makeArray( selector, this );
	};

// Give the init function the jQuery prototype for later instantiation
init.prototype = jQuery.fn;

// Initialize central reference
rootjQuery = jQuery( document );


var rparentsprev = /^(?:parents|prev(?:Until|All))/,
	// methods guaranteed to produce a unique set when starting from a unique set
	guaranteedUnique = {
		children: true,
		contents: true,
		next: true,
		prev: true
	};

jQuery.extend({
	dir: function( elem, dir, until ) {
		var matched = [],
			truncate = until !== undefined;

		while ( (elem = elem[ dir ]) && elem.nodeType !== 9 ) {
			if ( elem.nodeType === 1 ) {
				if ( truncate && jQuery( elem ).is( until ) ) {
					break;
				}
				matched.push( elem );
			}
		}
		return matched;
	},

	sibling: function( n, elem ) {
		var matched = [];

		for ( ; n; n = n.nextSibling ) {
			if ( n.nodeType === 1 && n !== elem ) {
				matched.push( n );
			}
		}

		return matched;
	}
});

jQuery.fn.extend({
	has: function( target ) {
		var targets = jQuery( target, this ),
			l = targets.length;

		return this.filter(function() {
			var i = 0;
			for ( ; i < l; i++ ) {
				if ( jQuery.contains( this, targets[i] ) ) {
					return true;
				}
			}
		});
	},

	closest: function( selectors, context ) {
		var cur,
			i = 0,
			l = this.length,
			matched = [],
			pos = rneedsContext.test( selectors ) || typeof selectors !== "string" ?
				jQuery( selectors, context || this.context ) :
				0;

		for ( ; i < l; i++ ) {
			for ( cur = this[i]; cur && cur !== context; cur = cur.parentNode ) {
				// Always skip document fragments
				if ( cur.nodeType < 11 && (pos ?
					pos.index(cur) > -1 :

					// Don't pass non-elements to Sizzle
					cur.nodeType === 1 &&
						jQuery.find.matchesSelector(cur, selectors)) ) {

					matched.push( cur );
					break;
				}
			}
		}

		return this.pushStack( matched.length > 1 ? jQuery.unique( matched ) : matched );
	},

	// Determine the position of an element within
	// the matched set of elements
	index: function( elem ) {

		// No argument, return index in parent
		if ( !elem ) {
			return ( this[ 0 ] && this[ 0 ].parentNode ) ? this.first().prevAll().length : -1;
		}

		// index in selector
		if ( typeof elem === "string" ) {
			return indexOf.call( jQuery( elem ), this[ 0 ] );
		}

		// Locate the position of the desired element
		return indexOf.call( this,

			// If it receives a jQuery object, the first element is used
			elem.jquery ? elem[ 0 ] : elem
		);
	},

	add: function( selector, context ) {
		return this.pushStack(
			jQuery.unique(
				jQuery.merge( this.get(), jQuery( selector, context ) )
			)
		);
	},

	addBack: function( selector ) {
		return this.add( selector == null ?
			this.prevObject : this.prevObject.filter(selector)
		);
	}
});

function sibling( cur, dir ) {
	while ( (cur = cur[dir]) && cur.nodeType !== 1 ) {}
	return cur;
}

jQuery.each({
	parent: function( elem ) {
		var parent = elem.parentNode;
		return parent && parent.nodeType !== 11 ? parent : null;
	},
	parents: function( elem ) {
		return jQuery.dir( elem, "parentNode" );
	},
	parentsUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "parentNode", until );
	},
	next: function( elem ) {
		return sibling( elem, "nextSibling" );
	},
	prev: function( elem ) {
		return sibling( elem, "previousSibling" );
	},
	nextAll: function( elem ) {
		return jQuery.dir( elem, "nextSibling" );
	},
	prevAll: function( elem ) {
		return jQuery.dir( elem, "previousSibling" );
	},
	nextUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "nextSibling", until );
	},
	prevUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "previousSibling", until );
	},
	siblings: function( elem ) {
		return jQuery.sibling( ( elem.parentNode || {} ).firstChild, elem );
	},
	children: function( elem ) {
		return jQuery.sibling( elem.firstChild );
	},
	contents: function( elem ) {
		return elem.contentDocument || jQuery.merge( [], elem.childNodes );
	}
}, function( name, fn ) {
	jQuery.fn[ name ] = function( until, selector ) {
		var matched = jQuery.map( this, fn, until );

		if ( name.slice( -5 ) !== "Until" ) {
			selector = until;
		}

		if ( selector && typeof selector === "string" ) {
			matched = jQuery.filter( selector, matched );
		}

		if ( this.length > 1 ) {
			// Remove duplicates
			if ( !guaranteedUnique[ name ] ) {
				jQuery.unique( matched );
			}

			// Reverse order for parents* and prev-derivatives
			if ( rparentsprev.test( name ) ) {
				matched.reverse();
			}
		}

		return this.pushStack( matched );
	};
});
var rnotwhite = (/\S+/g);



// String to Object options format cache
var optionsCache = {};

// Convert String-formatted options into Object-formatted ones and store in cache
function createOptions( options ) {
	var object = optionsCache[ options ] = {};
	jQuery.each( options.match( rnotwhite ) || [], function( _, flag ) {
		object[ flag ] = true;
	});
	return object;
}

/*
 * Create a callback list using the following parameters:
 *
 *	options: an optional list of space-separated options that will change how
 *			the callback list behaves or a more traditional option object
 *
 * By default a callback list will act like an event callback list and can be
 * "fired" multiple times.
 *
 * Possible options:
 *
 *	once:			will ensure the callback list can only be fired once (like a Deferred)
 *
 *	memory:			will keep track of previous values and will call any callback added
 *					after the list has been fired right away with the latest "memorized"
 *					values (like a Deferred)
 *
 *	unique:			will ensure a callback can only be added once (no duplicate in the list)
 *
 *	stopOnFalse:	interrupt callings when a callback returns false
 *
 */
jQuery.Callbacks = function( options ) {

	// Convert options from String-formatted to Object-formatted if needed
	// (we check in cache first)
	options = typeof options === "string" ?
		( optionsCache[ options ] || createOptions( options ) ) :
		jQuery.extend( {}, options );

	var // Last fire value (for non-forgettable lists)
		memory,
		// Flag to know if list was already fired
		fired,
		// Flag to know if list is currently firing
		firing,
		// First callback to fire (used internally by add and fireWith)
		firingStart,
		// End of the loop when firing
		firingLength,
		// Index of currently firing callback (modified by remove if needed)
		firingIndex,
		// Actual callback list
		list = [],
		// Stack of fire calls for repeatable lists
		stack = !options.once && [],
		// Fire callbacks
		fire = function( data ) {
			memory = options.memory && data;
			fired = true;
			firingIndex = firingStart || 0;
			firingStart = 0;
			firingLength = list.length;
			firing = true;
			for ( ; list && firingIndex < firingLength; firingIndex++ ) {
				if ( list[ firingIndex ].apply( data[ 0 ], data[ 1 ] ) === false && options.stopOnFalse ) {
					memory = false; // To prevent further calls using add
					break;
				}
			}
			firing = false;
			if ( list ) {
				if ( stack ) {
					if ( stack.length ) {
						fire( stack.shift() );
					}
				} else if ( memory ) {
					list = [];
				} else {
					self.disable();
				}
			}
		},
		// Actual Callbacks object
		self = {
			// Add a callback or a collection of callbacks to the list
			add: function() {
				if ( list ) {
					// First, we save the current length
					var start = list.length;
					(function add( args ) {
						jQuery.each( args, function( _, arg ) {
							var type = jQuery.type( arg );
							if ( type === "function" ) {
								if ( !options.unique || !self.has( arg ) ) {
									list.push( arg );
								}
							} else if ( arg && arg.length && type !== "string" ) {
								// Inspect recursively
								add( arg );
							}
						});
					})( arguments );
					// Do we need to add the callbacks to the
					// current firing batch?
					if ( firing ) {
						firingLength = list.length;
					// With memory, if we're not firing then
					// we should call right away
					} else if ( memory ) {
						firingStart = start;
						fire( memory );
					}
				}
				return this;
			},
			// Remove a callback from the list
			remove: function() {
				if ( list ) {
					jQuery.each( arguments, function( _, arg ) {
						var index;
						while ( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
							list.splice( index, 1 );
							// Handle firing indexes
							if ( firing ) {
								if ( index <= firingLength ) {
									firingLength--;
								}
								if ( index <= firingIndex ) {
									firingIndex--;
								}
							}
						}
					});
				}
				return this;
			},
			// Check if a given callback is in the list.
			// If no argument is given, return whether or not list has callbacks attached.
			has: function( fn ) {
				return fn ? jQuery.inArray( fn, list ) > -1 : !!( list && list.length );
			},
			// Remove all callbacks from the list
			empty: function() {
				list = [];
				firingLength = 0;
				return this;
			},
			// Have the list do nothing anymore
			disable: function() {
				list = stack = memory = undefined;
				return this;
			},
			// Is it disabled?
			disabled: function() {
				return !list;
			},
			// Lock the list in its current state
			lock: function() {
				stack = undefined;
				if ( !memory ) {
					self.disable();
				}
				return this;
			},
			// Is it locked?
			locked: function() {
				return !stack;
			},
			// Call all callbacks with the given context and arguments
			fireWith: function( context, args ) {
				if ( list && ( !fired || stack ) ) {
					args = args || [];
					args = [ context, args.slice ? args.slice() : args ];
					if ( firing ) {
						stack.push( args );
					} else {
						fire( args );
					}
				}
				return this;
			},
			// Call all the callbacks with the given arguments
			fire: function() {
				self.fireWith( this, arguments );
				return this;
			},
			// To know if the callbacks have already been called at least once
			fired: function() {
				return !!fired;
			}
		};

	return self;
};


jQuery.extend({

	Deferred: function( func ) {
		var tuples = [
				// action, add listener, listener list, final state
				[ "resolve", "done", jQuery.Callbacks("once memory"), "resolved" ],
				[ "reject", "fail", jQuery.Callbacks("once memory"), "rejected" ],
				[ "notify", "progress", jQuery.Callbacks("memory") ]
			],
			state = "pending",
			promise = {
				state: function() {
					return state;
				},
				always: function() {
					deferred.done( arguments ).fail( arguments );
					return this;
				},
				then: function( /* fnDone, fnFail, fnProgress */ ) {
					var fns = arguments;
					return jQuery.Deferred(function( newDefer ) {
						jQuery.each( tuples, function( i, tuple ) {
							var fn = jQuery.isFunction( fns[ i ] ) && fns[ i ];
							// deferred[ done | fail | progress ] for forwarding actions to newDefer
							deferred[ tuple[1] ](function() {
								var returned = fn && fn.apply( this, arguments );
								if ( returned && jQuery.isFunction( returned.promise ) ) {
									returned.promise()
										.done( newDefer.resolve )
										.fail( newDefer.reject )
										.progress( newDefer.notify );
								} else {
									newDefer[ tuple[ 0 ] + "With" ]( this === promise ? newDefer.promise() : this, fn ? [ returned ] : arguments );
								}
							});
						});
						fns = null;
					}).promise();
				},
				// Get a promise for this deferred
				// If obj is provided, the promise aspect is added to the object
				promise: function( obj ) {
					return obj != null ? jQuery.extend( obj, promise ) : promise;
				}
			},
			deferred = {};

		// Keep pipe for back-compat
		promise.pipe = promise.then;

		// Add list-specific methods
		jQuery.each( tuples, function( i, tuple ) {
			var list = tuple[ 2 ],
				stateString = tuple[ 3 ];

			// promise[ done | fail | progress ] = list.add
			promise[ tuple[1] ] = list.add;

			// Handle state
			if ( stateString ) {
				list.add(function() {
					// state = [ resolved | rejected ]
					state = stateString;

				// [ reject_list | resolve_list ].disable; progress_list.lock
				}, tuples[ i ^ 1 ][ 2 ].disable, tuples[ 2 ][ 2 ].lock );
			}

			// deferred[ resolve | reject | notify ]
			deferred[ tuple[0] ] = function() {
				deferred[ tuple[0] + "With" ]( this === deferred ? promise : this, arguments );
				return this;
			};
			deferred[ tuple[0] + "With" ] = list.fireWith;
		});

		// Make the deferred a promise
		promise.promise( deferred );

		// Call given func if any
		if ( func ) {
			func.call( deferred, deferred );
		}

		// All done!
		return deferred;
	},

	// Deferred helper
	when: function( subordinate /* , ..., subordinateN */ ) {
		var i = 0,
			resolveValues = slice.call( arguments ),
			length = resolveValues.length,

			// the count of uncompleted subordinates
			remaining = length !== 1 || ( subordinate && jQuery.isFunction( subordinate.promise ) ) ? length : 0,

			// the master Deferred. If resolveValues consist of only a single Deferred, just use that.
			deferred = remaining === 1 ? subordinate : jQuery.Deferred(),

			// Update function for both resolve and progress values
			updateFunc = function( i, contexts, values ) {
				return function( value ) {
					contexts[ i ] = this;
					values[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
					if ( values === progressValues ) {
						deferred.notifyWith( contexts, values );
					} else if ( !( --remaining ) ) {
						deferred.resolveWith( contexts, values );
					}
				};
			},

			progressValues, progressContexts, resolveContexts;

		// add listeners to Deferred subordinates; treat others as resolved
		if ( length > 1 ) {
			progressValues = new Array( length );
			progressContexts = new Array( length );
			resolveContexts = new Array( length );
			for ( ; i < length; i++ ) {
				if ( resolveValues[ i ] && jQuery.isFunction( resolveValues[ i ].promise ) ) {
					resolveValues[ i ].promise()
						.done( updateFunc( i, resolveContexts, resolveValues ) )
						.fail( deferred.reject )
						.progress( updateFunc( i, progressContexts, progressValues ) );
				} else {
					--remaining;
				}
			}
		}

		// if we're not waiting on anything, resolve the master
		if ( !remaining ) {
			deferred.resolveWith( resolveContexts, resolveValues );
		}

		return deferred.promise();
	}
});


// The deferred used on DOM ready
var readyList;

jQuery.fn.ready = function( fn ) {
	// Add the callback
	jQuery.ready.promise().done( fn );

	return this;
};

jQuery.extend({
	// Is the DOM ready to be used? Set to true once it occurs.
	isReady: false,

	// A counter to track how many items to wait for before
	// the ready event fires. See #6781
	readyWait: 1,

	// Hold (or release) the ready event
	holdReady: function( hold ) {
		if ( hold ) {
			jQuery.readyWait++;
		} else {
			jQuery.ready( true );
		}
	},

	// Handle when the DOM is ready
	ready: function( wait ) {

		// Abort if there are pending holds or we're already ready
		if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
			return;
		}

		// Remember that the DOM is ready
		jQuery.isReady = true;

		// If a normal DOM Ready event fired, decrement, and wait if need be
		if ( wait !== true && --jQuery.readyWait > 0 ) {
			return;
		}

		// If there are functions bound, to execute
		readyList.resolveWith( document, [ jQuery ] );

		// Trigger any bound ready events
		if ( jQuery.fn.triggerHandler ) {
			jQuery( document ).triggerHandler( "ready" );
			jQuery( document ).off( "ready" );
		}
	}
});

/**
 * The ready event handler and self cleanup method
 */
function completed() {
	document.removeEventListener( "DOMContentLoaded", completed, false );
	window.removeEventListener( "load", completed, false );
	jQuery.ready();
}

jQuery.ready.promise = function( obj ) {
	if ( !readyList ) {

		readyList = jQuery.Deferred();

		// Catch cases where $(document).ready() is called after the browser event has already occurred.
		// we once tried to use readyState "interactive" here, but it caused issues like the one
		// discovered by ChrisS here: http://bugs.jquery.com/ticket/12282#comment:15
		if ( document.readyState === "complete" ) {
			// Handle it asynchronously to allow scripts the opportunity to delay ready
			setTimeout( jQuery.ready );

		} else {

			// Use the handy event callback
			document.addEventListener( "DOMContentLoaded", completed, false );

			// A fallback to window.onload, that will always work
			window.addEventListener( "load", completed, false );
		}
	}
	return readyList.promise( obj );
};

// Kick off the DOM ready check even if the user does not
jQuery.ready.promise();




// Multifunctional method to get and set values of a collection
// The value/s can optionally be executed if it's a function
var access = jQuery.access = function( elems, fn, key, value, chainable, emptyGet, raw ) {
	var i = 0,
		len = elems.length,
		bulk = key == null;

	// Sets many values
	if ( jQuery.type( key ) === "object" ) {
		chainable = true;
		for ( i in key ) {
			jQuery.access( elems, fn, i, key[i], true, emptyGet, raw );
		}

	// Sets one value
	} else if ( value !== undefined ) {
		chainable = true;

		if ( !jQuery.isFunction( value ) ) {
			raw = true;
		}

		if ( bulk ) {
			// Bulk operations run against the entire set
			if ( raw ) {
				fn.call( elems, value );
				fn = null;

			// ...except when executing function values
			} else {
				bulk = fn;
				fn = function( elem, key, value ) {
					return bulk.call( jQuery( elem ), value );
				};
			}
		}

		if ( fn ) {
			for ( ; i < len; i++ ) {
				fn( elems[i], key, raw ? value : value.call( elems[i], i, fn( elems[i], key ) ) );
			}
		}
	}

	return chainable ?
		elems :

		// Gets
		bulk ?
			fn.call( elems ) :
			len ? fn( elems[0], key ) : emptyGet;
};


/**
 * Determines whether an object can have data
 */
jQuery.acceptData = function( owner ) {
	// Accepts only:
	//  - Node
	//    - Node.ELEMENT_NODE
	//    - Node.DOCUMENT_NODE
	//  - Object
	//    - Any
	/* jshint -W018 */
	return owner.nodeType === 1 || owner.nodeType === 9 || !( +owner.nodeType );
};


function Data() {
	// Support: Android < 4,
	// Old WebKit does not have Object.preventExtensions/freeze method,
	// return new empty object instead with no [[set]] accessor
	Object.defineProperty( this.cache = {}, 0, {
		get: function() {
			return {};
		}
	});

	this.expando = jQuery.expando + Math.random();
}

Data.uid = 1;
Data.accepts = jQuery.acceptData;

Data.prototype = {
	key: function( owner ) {
		// We can accept data for non-element nodes in modern browsers,
		// but we should not, see #8335.
		// Always return the key for a frozen object.
		if ( !Data.accepts( owner ) ) {
			return 0;
		}

		var descriptor = {},
			// Check if the owner object already has a cache key
			unlock = owner[ this.expando ];

		// If not, create one
		if ( !unlock ) {
			unlock = Data.uid++;

			// Secure it in a non-enumerable, non-writable property
			try {
				descriptor[ this.expando ] = { value: unlock };
				Object.defineProperties( owner, descriptor );

			// Support: Android < 4
			// Fallback to a less secure definition
			} catch ( e ) {
				descriptor[ this.expando ] = unlock;
				jQuery.extend( owner, descriptor );
			}
		}

		// Ensure the cache object
		if ( !this.cache[ unlock ] ) {
			this.cache[ unlock ] = {};
		}

		return unlock;
	},
	set: function( owner, data, value ) {
		var prop,
			// There may be an unlock assigned to this node,
			// if there is no entry for this "owner", create one inline
			// and set the unlock as though an owner entry had always existed
			unlock = this.key( owner ),
			cache = this.cache[ unlock ];

		// Handle: [ owner, key, value ] args
		if ( typeof data === "string" ) {
			cache[ data ] = value;

		// Handle: [ owner, { properties } ] args
		} else {
			// Fresh assignments by object are shallow copied
			if ( jQuery.isEmptyObject( cache ) ) {
				jQuery.extend( this.cache[ unlock ], data );
			// Otherwise, copy the properties one-by-one to the cache object
			} else {
				for ( prop in data ) {
					cache[ prop ] = data[ prop ];
				}
			}
		}
		return cache;
	},
	get: function( owner, key ) {
		// Either a valid cache is found, or will be created.
		// New caches will be created and the unlock returned,
		// allowing direct access to the newly created
		// empty data object. A valid owner object must be provided.
		var cache = this.cache[ this.key( owner ) ];

		return key === undefined ?
			cache : cache[ key ];
	},
	access: function( owner, key, value ) {
		var stored;
		// In cases where either:
		//
		//   1. No key was specified
		//   2. A string key was specified, but no value provided
		//
		// Take the "read" path and allow the get method to determine
		// which value to return, respectively either:
		//
		//   1. The entire cache object
		//   2. The data stored at the key
		//
		if ( key === undefined ||
				((key && typeof key === "string") && value === undefined) ) {

			stored = this.get( owner, key );

			return stored !== undefined ?
				stored : this.get( owner, jQuery.camelCase(key) );
		}

		// [*]When the key is not a string, or both a key and value
		// are specified, set or extend (existing objects) with either:
		//
		//   1. An object of properties
		//   2. A key and value
		//
		this.set( owner, key, value );

		// Since the "set" path can have two possible entry points
		// return the expected data based on which path was taken[*]
		return value !== undefined ? value : key;
	},
	remove: function( owner, key ) {
		var i, name, camel,
			unlock = this.key( owner ),
			cache = this.cache[ unlock ];

		if ( key === undefined ) {
			this.cache[ unlock ] = {};

		} else {
			// Support array or space separated string of keys
			if ( jQuery.isArray( key ) ) {
				// If "name" is an array of keys...
				// When data is initially created, via ("key", "val") signature,
				// keys will be converted to camelCase.
				// Since there is no way to tell _how_ a key was added, remove
				// both plain key and camelCase key. #12786
				// This will only penalize the array argument path.
				name = key.concat( key.map( jQuery.camelCase ) );
			} else {
				camel = jQuery.camelCase( key );
				// Try the string as a key before any manipulation
				if ( key in cache ) {
					name = [ key, camel ];
				} else {
					// If a key with the spaces exists, use it.
					// Otherwise, create an array by matching non-whitespace
					name = camel;
					name = name in cache ?
						[ name ] : ( name.match( rnotwhite ) || [] );
				}
			}

			i = name.length;
			while ( i-- ) {
				delete cache[ name[ i ] ];
			}
		}
	},
	hasData: function( owner ) {
		return !jQuery.isEmptyObject(
			this.cache[ owner[ this.expando ] ] || {}
		);
	},
	discard: function( owner ) {
		if ( owner[ this.expando ] ) {
			delete this.cache[ owner[ this.expando ] ];
		}
	}
};
var data_priv = new Data();

var data_user = new Data();



/*
	Implementation Summary

	1. Enforce API surface and semantic compatibility with 1.9.x branch
	2. Improve the module's maintainability by reducing the storage
		paths to a single mechanism.
	3. Use the same single mechanism to support "private" and "user" data.
	4. _Never_ expose "private" data to user code (TODO: Drop _data, _removeData)
	5. Avoid exposing implementation details on user objects (eg. expando properties)
	6. Provide a clear path for implementation upgrade to WeakMap in 2014
*/
var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
	rmultiDash = /([A-Z])/g;

function dataAttr( elem, key, data ) {
	var name;

	// If nothing was found internally, try to fetch any
	// data from the HTML5 data-* attribute
	if ( data === undefined && elem.nodeType === 1 ) {
		name = "data-" + key.replace( rmultiDash, "-$1" ).toLowerCase();
		data = elem.getAttribute( name );

		if ( typeof data === "string" ) {
			try {
				data = data === "true" ? true :
					data === "false" ? false :
					data === "null" ? null :
					// Only convert to a number if it doesn't change the string
					+data + "" === data ? +data :
					rbrace.test( data ) ? jQuery.parseJSON( data ) :
					data;
			} catch( e ) {}

			// Make sure we set the data so it isn't changed later
			data_user.set( elem, key, data );
		} else {
			data = undefined;
		}
	}
	return data;
}

jQuery.extend({
	hasData: function( elem ) {
		return data_user.hasData( elem ) || data_priv.hasData( elem );
	},

	data: function( elem, name, data ) {
		return data_user.access( elem, name, data );
	},

	removeData: function( elem, name ) {
		data_user.remove( elem, name );
	},

	// TODO: Now that all calls to _data and _removeData have been replaced
	// with direct calls to data_priv methods, these can be deprecated.
	_data: function( elem, name, data ) {
		return data_priv.access( elem, name, data );
	},

	_removeData: function( elem, name ) {
		data_priv.remove( elem, name );
	}
});

jQuery.fn.extend({
	data: function( key, value ) {
		var i, name, data,
			elem = this[ 0 ],
			attrs = elem && elem.attributes;

		// Gets all values
		if ( key === undefined ) {
			if ( this.length ) {
				data = data_user.get( elem );

				if ( elem.nodeType === 1 && !data_priv.get( elem, "hasDataAttrs" ) ) {
					i = attrs.length;
					while ( i-- ) {

						// Support: IE11+
						// The attrs elements can be null (#14894)
						if ( attrs[ i ] ) {
							name = attrs[ i ].name;
							if ( name.indexOf( "data-" ) === 0 ) {
								name = jQuery.camelCase( name.slice(5) );
								dataAttr( elem, name, data[ name ] );
							}
						}
					}
					data_priv.set( elem, "hasDataAttrs", true );
				}
			}

			return data;
		}

		// Sets multiple values
		if ( typeof key === "object" ) {
			return this.each(function() {
				data_user.set( this, key );
			});
		}

		return access( this, function( value ) {
			var data,
				camelKey = jQuery.camelCase( key );

			// The calling jQuery object (element matches) is not empty
			// (and therefore has an element appears at this[ 0 ]) and the
			// `value` parameter was not undefined. An empty jQuery object
			// will result in `undefined` for elem = this[ 0 ] which will
			// throw an exception if an attempt to read a data cache is made.
			if ( elem && value === undefined ) {
				// Attempt to get data from the cache
				// with the key as-is
				data = data_user.get( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// Attempt to get data from the cache
				// with the key camelized
				data = data_user.get( elem, camelKey );
				if ( data !== undefined ) {
					return data;
				}

				// Attempt to "discover" the data in
				// HTML5 custom data-* attrs
				data = dataAttr( elem, camelKey, undefined );
				if ( data !== undefined ) {
					return data;
				}

				// We tried really hard, but the data doesn't exist.
				return;
			}

			// Set the data...
			this.each(function() {
				// First, attempt to store a copy or reference of any
				// data that might've been store with a camelCased key.
				var data = data_user.get( this, camelKey );

				// For HTML5 data-* attribute interop, we have to
				// store property names with dashes in a camelCase form.
				// This might not apply to all properties...*
				data_user.set( this, camelKey, value );

				// *... In the case of properties that might _actually_
				// have dashes, we need to also store a copy of that
				// unchanged property.
				if ( key.indexOf("-") !== -1 && data !== undefined ) {
					data_user.set( this, key, value );
				}
			});
		}, null, value, arguments.length > 1, null, true );
	},

	removeData: function( key ) {
		return this.each(function() {
			data_user.remove( this, key );
		});
	}
});


jQuery.extend({
	queue: function( elem, type, data ) {
		var queue;

		if ( elem ) {
			type = ( type || "fx" ) + "queue";
			queue = data_priv.get( elem, type );

			// Speed up dequeue by getting out quickly if this is just a lookup
			if ( data ) {
				if ( !queue || jQuery.isArray( data ) ) {
					queue = data_priv.access( elem, type, jQuery.makeArray(data) );
				} else {
					queue.push( data );
				}
			}
			return queue || [];
		}
	},

	dequeue: function( elem, type ) {
		type = type || "fx";

		var queue = jQuery.queue( elem, type ),
			startLength = queue.length,
			fn = queue.shift(),
			hooks = jQuery._queueHooks( elem, type ),
			next = function() {
				jQuery.dequeue( elem, type );
			};

		// If the fx queue is dequeued, always remove the progress sentinel
		if ( fn === "inprogress" ) {
			fn = queue.shift();
			startLength--;
		}

		if ( fn ) {

			// Add a progress sentinel to prevent the fx queue from being
			// automatically dequeued
			if ( type === "fx" ) {
				queue.unshift( "inprogress" );
			}

			// clear up the last queue stop function
			delete hooks.stop;
			fn.call( elem, next, hooks );
		}

		if ( !startLength && hooks ) {
			hooks.empty.fire();
		}
	},

	// not intended for public consumption - generates a queueHooks object, or returns the current one
	_queueHooks: function( elem, type ) {
		var key = type + "queueHooks";
		return data_priv.get( elem, key ) || data_priv.access( elem, key, {
			empty: jQuery.Callbacks("once memory").add(function() {
				data_priv.remove( elem, [ type + "queue", key ] );
			})
		});
	}
});

jQuery.fn.extend({
	queue: function( type, data ) {
		var setter = 2;

		if ( typeof type !== "string" ) {
			data = type;
			type = "fx";
			setter--;
		}

		if ( arguments.length < setter ) {
			return jQuery.queue( this[0], type );
		}

		return data === undefined ?
			this :
			this.each(function() {
				var queue = jQuery.queue( this, type, data );

				// ensure a hooks for this queue
				jQuery._queueHooks( this, type );

				if ( type === "fx" && queue[0] !== "inprogress" ) {
					jQuery.dequeue( this, type );
				}
			});
	},
	dequeue: function( type ) {
		return this.each(function() {
			jQuery.dequeue( this, type );
		});
	},
	clearQueue: function( type ) {
		return this.queue( type || "fx", [] );
	},
	// Get a promise resolved when queues of a certain type
	// are emptied (fx is the type by default)
	promise: function( type, obj ) {
		var tmp,
			count = 1,
			defer = jQuery.Deferred(),
			elements = this,
			i = this.length,
			resolve = function() {
				if ( !( --count ) ) {
					defer.resolveWith( elements, [ elements ] );
				}
			};

		if ( typeof type !== "string" ) {
			obj = type;
			type = undefined;
		}
		type = type || "fx";

		while ( i-- ) {
			tmp = data_priv.get( elements[ i ], type + "queueHooks" );
			if ( tmp && tmp.empty ) {
				count++;
				tmp.empty.add( resolve );
			}
		}
		resolve();
		return defer.promise( obj );
	}
});
var pnum = (/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/).source;

var cssExpand = [ "Top", "Right", "Bottom", "Left" ];

var isHidden = function( elem, el ) {
		// isHidden might be called from jQuery#filter function;
		// in that case, element will be second argument
		elem = el || elem;
		return jQuery.css( elem, "display" ) === "none" || !jQuery.contains( elem.ownerDocument, elem );
	};

var rcheckableType = (/^(?:checkbox|radio)$/i);



(function() {
	var fragment = document.createDocumentFragment(),
		div = fragment.appendChild( document.createElement( "div" ) ),
		input = document.createElement( "input" );

	// #11217 - WebKit loses check when the name is after the checked attribute
	// Support: Windows Web Apps (WWA)
	// `name` and `type` need .setAttribute for WWA
	input.setAttribute( "type", "radio" );
	input.setAttribute( "checked", "checked" );
	input.setAttribute( "name", "t" );

	div.appendChild( input );

	// Support: Safari 5.1, iOS 5.1, Android 4.x, Android 2.3
	// old WebKit doesn't clone checked state correctly in fragments
	support.checkClone = div.cloneNode( true ).cloneNode( true ).lastChild.checked;

	// Make sure textarea (and checkbox) defaultValue is properly cloned
	// Support: IE9-IE11+
	div.innerHTML = "<textarea>x</textarea>";
	support.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;
})();
var strundefined = typeof undefined;



support.focusinBubbles = "onfocusin" in window;


var
	rkeyEvent = /^key/,
	rmouseEvent = /^(?:mouse|pointer|contextmenu)|click/,
	rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
	rtypenamespace = /^([^.]*)(?:\.(.+)|)$/;

function returnTrue() {
	return true;
}

function returnFalse() {
	return false;
}

function safeActiveElement() {
	try {
		return document.activeElement;
	} catch ( err ) { }
}

/*
 * Helper functions for managing events -- not part of the public interface.
 * Props to Dean Edwards' addEvent library for many of the ideas.
 */
jQuery.event = {

	global: {},

	add: function( elem, types, handler, data, selector ) {

		var handleObjIn, eventHandle, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = data_priv.get( elem );

		// Don't attach events to noData or text/comment nodes (but allow plain objects)
		if ( !elemData ) {
			return;
		}

		// Caller can pass in an object of custom data in lieu of the handler
		if ( handler.handler ) {
			handleObjIn = handler;
			handler = handleObjIn.handler;
			selector = handleObjIn.selector;
		}

		// Make sure that the handler has a unique ID, used to find/remove it later
		if ( !handler.guid ) {
			handler.guid = jQuery.guid++;
		}

		// Init the element's event structure and main handler, if this is the first
		if ( !(events = elemData.events) ) {
			events = elemData.events = {};
		}
		if ( !(eventHandle = elemData.handle) ) {
			eventHandle = elemData.handle = function( e ) {
				// Discard the second event of a jQuery.event.trigger() and
				// when an event is called after a page has unloaded
				return typeof jQuery !== strundefined && jQuery.event.triggered !== e.type ?
					jQuery.event.dispatch.apply( elem, arguments ) : undefined;
			};
		}

		// Handle multiple events separated by a space
		types = ( types || "" ).match( rnotwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[t] ) || [];
			type = origType = tmp[1];
			namespaces = ( tmp[2] || "" ).split( "." ).sort();

			// There *must* be a type, no attaching namespace-only handlers
			if ( !type ) {
				continue;
			}

			// If event changes its type, use the special event handlers for the changed type
			special = jQuery.event.special[ type ] || {};

			// If selector defined, determine special event api type, otherwise given type
			type = ( selector ? special.delegateType : special.bindType ) || type;

			// Update special based on newly reset type
			special = jQuery.event.special[ type ] || {};

			// handleObj is passed to all event handlers
			handleObj = jQuery.extend({
				type: type,
				origType: origType,
				data: data,
				handler: handler,
				guid: handler.guid,
				selector: selector,
				needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
				namespace: namespaces.join(".")
			}, handleObjIn );

			// Init the event handler queue if we're the first
			if ( !(handlers = events[ type ]) ) {
				handlers = events[ type ] = [];
				handlers.delegateCount = 0;

				// Only use addEventListener if the special events handler returns false
				if ( !special.setup || special.setup.call( elem, data, namespaces, eventHandle ) === false ) {
					if ( elem.addEventListener ) {
						elem.addEventListener( type, eventHandle, false );
					}
				}
			}

			if ( special.add ) {
				special.add.call( elem, handleObj );

				if ( !handleObj.handler.guid ) {
					handleObj.handler.guid = handler.guid;
				}
			}

			// Add to the element's handler list, delegates in front
			if ( selector ) {
				handlers.splice( handlers.delegateCount++, 0, handleObj );
			} else {
				handlers.push( handleObj );
			}

			// Keep track of which events have ever been used, for event optimization
			jQuery.event.global[ type ] = true;
		}

	},

	// Detach an event or set of events from an element
	remove: function( elem, types, handler, selector, mappedTypes ) {

		var j, origCount, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = data_priv.hasData( elem ) && data_priv.get( elem );

		if ( !elemData || !(events = elemData.events) ) {
			return;
		}

		// Once for each type.namespace in types; type may be omitted
		types = ( types || "" ).match( rnotwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[t] ) || [];
			type = origType = tmp[1];
			namespaces = ( tmp[2] || "" ).split( "." ).sort();

			// Unbind all events (on this namespace, if provided) for the element
			if ( !type ) {
				for ( type in events ) {
					jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
				}
				continue;
			}

			special = jQuery.event.special[ type ] || {};
			type = ( selector ? special.delegateType : special.bindType ) || type;
			handlers = events[ type ] || [];
			tmp = tmp[2] && new RegExp( "(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)" );

			// Remove matching events
			origCount = j = handlers.length;
			while ( j-- ) {
				handleObj = handlers[ j ];

				if ( ( mappedTypes || origType === handleObj.origType ) &&
					( !handler || handler.guid === handleObj.guid ) &&
					( !tmp || tmp.test( handleObj.namespace ) ) &&
					( !selector || selector === handleObj.selector || selector === "**" && handleObj.selector ) ) {
					handlers.splice( j, 1 );

					if ( handleObj.selector ) {
						handlers.delegateCount--;
					}
					if ( special.remove ) {
						special.remove.call( elem, handleObj );
					}
				}
			}

			// Remove generic event handler if we removed something and no more handlers exist
			// (avoids potential for endless recursion during removal of special event handlers)
			if ( origCount && !handlers.length ) {
				if ( !special.teardown || special.teardown.call( elem, namespaces, elemData.handle ) === false ) {
					jQuery.removeEvent( elem, type, elemData.handle );
				}

				delete events[ type ];
			}
		}

		// Remove the expando if it's no longer used
		if ( jQuery.isEmptyObject( events ) ) {
			delete elemData.handle;
			data_priv.remove( elem, "events" );
		}
	},

	trigger: function( event, data, elem, onlyHandlers ) {

		var i, cur, tmp, bubbleType, ontype, handle, special,
			eventPath = [ elem || document ],
			type = hasOwn.call( event, "type" ) ? event.type : event,
			namespaces = hasOwn.call( event, "namespace" ) ? event.namespace.split(".") : [];

		cur = tmp = elem = elem || document;

		// Don't do events on text and comment nodes
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		// focus/blur morphs to focusin/out; ensure we're not firing them right now
		if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
			return;
		}

		if ( type.indexOf(".") >= 0 ) {
			// Namespaced trigger; create a regexp to match event type in handle()
			namespaces = type.split(".");
			type = namespaces.shift();
			namespaces.sort();
		}
		ontype = type.indexOf(":") < 0 && "on" + type;

		// Caller can pass in a jQuery.Event object, Object, or just an event type string
		event = event[ jQuery.expando ] ?
			event :
			new jQuery.Event( type, typeof event === "object" && event );

		// Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
		event.isTrigger = onlyHandlers ? 2 : 3;
		event.namespace = namespaces.join(".");
		event.namespace_re = event.namespace ?
			new RegExp( "(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)" ) :
			null;

		// Clean up the event in case it is being reused
		event.result = undefined;
		if ( !event.target ) {
			event.target = elem;
		}

		// Clone any incoming data and prepend the event, creating the handler arg list
		data = data == null ?
			[ event ] :
			jQuery.makeArray( data, [ event ] );

		// Allow special events to draw outside the lines
		special = jQuery.event.special[ type ] || {};
		if ( !onlyHandlers && special.trigger && special.trigger.apply( elem, data ) === false ) {
			return;
		}

		// Determine event propagation path in advance, per W3C events spec (#9951)
		// Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
		if ( !onlyHandlers && !special.noBubble && !jQuery.isWindow( elem ) ) {

			bubbleType = special.delegateType || type;
			if ( !rfocusMorph.test( bubbleType + type ) ) {
				cur = cur.parentNode;
			}
			for ( ; cur; cur = cur.parentNode ) {
				eventPath.push( cur );
				tmp = cur;
			}

			// Only add window if we got to document (e.g., not plain obj or detached DOM)
			if ( tmp === (elem.ownerDocument || document) ) {
				eventPath.push( tmp.defaultView || tmp.parentWindow || window );
			}
		}

		// Fire handlers on the event path
		i = 0;
		while ( (cur = eventPath[i++]) && !event.isPropagationStopped() ) {

			event.type = i > 1 ?
				bubbleType :
				special.bindType || type;

			// jQuery handler
			handle = ( data_priv.get( cur, "events" ) || {} )[ event.type ] && data_priv.get( cur, "handle" );
			if ( handle ) {
				handle.apply( cur, data );
			}

			// Native handler
			handle = ontype && cur[ ontype ];
			if ( handle && handle.apply && jQuery.acceptData( cur ) ) {
				event.result = handle.apply( cur, data );
				if ( event.result === false ) {
					event.preventDefault();
				}
			}
		}
		event.type = type;

		// If nobody prevented the default action, do it now
		if ( !onlyHandlers && !event.isDefaultPrevented() ) {

			if ( (!special._default || special._default.apply( eventPath.pop(), data ) === false) &&
				jQuery.acceptData( elem ) ) {

				// Call a native DOM method on the target with the same name name as the event.
				// Don't do default actions on window, that's where global variables be (#6170)
				if ( ontype && jQuery.isFunction( elem[ type ] ) && !jQuery.isWindow( elem ) ) {

					// Don't re-trigger an onFOO event when we call its FOO() method
					tmp = elem[ ontype ];

					if ( tmp ) {
						elem[ ontype ] = null;
					}

					// Prevent re-triggering of the same event, since we already bubbled it above
					jQuery.event.triggered = type;
					elem[ type ]();
					jQuery.event.triggered = undefined;

					if ( tmp ) {
						elem[ ontype ] = tmp;
					}
				}
			}
		}

		return event.result;
	},

	dispatch: function( event ) {

		// Make a writable jQuery.Event from the native event object
		event = jQuery.event.fix( event );

		var i, j, ret, matched, handleObj,
			handlerQueue = [],
			args = slice.call( arguments ),
			handlers = ( data_priv.get( this, "events" ) || {} )[ event.type ] || [],
			special = jQuery.event.special[ event.type ] || {};

		// Use the fix-ed jQuery.Event rather than the (read-only) native event
		args[0] = event;
		event.delegateTarget = this;

		// Call the preDispatch hook for the mapped type, and let it bail if desired
		if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
			return;
		}

		// Determine handlers
		handlerQueue = jQuery.event.handlers.call( this, event, handlers );

		// Run delegates first; they may want to stop propagation beneath us
		i = 0;
		while ( (matched = handlerQueue[ i++ ]) && !event.isPropagationStopped() ) {
			event.currentTarget = matched.elem;

			j = 0;
			while ( (handleObj = matched.handlers[ j++ ]) && !event.isImmediatePropagationStopped() ) {

				// Triggered event must either 1) have no namespace, or
				// 2) have namespace(s) a subset or equal to those in the bound event (both can have no namespace).
				if ( !event.namespace_re || event.namespace_re.test( handleObj.namespace ) ) {

					event.handleObj = handleObj;
					event.data = handleObj.data;

					ret = ( (jQuery.event.special[ handleObj.origType ] || {}).handle || handleObj.handler )
							.apply( matched.elem, args );

					if ( ret !== undefined ) {
						if ( (event.result = ret) === false ) {
							event.preventDefault();
							event.stopPropagation();
						}
					}
				}
			}
		}

		// Call the postDispatch hook for the mapped type
		if ( special.postDispatch ) {
			special.postDispatch.call( this, event );
		}

		return event.result;
	},

	handlers: function( event, handlers ) {
		var i, matches, sel, handleObj,
			handlerQueue = [],
			delegateCount = handlers.delegateCount,
			cur = event.target;

		// Find delegate handlers
		// Black-hole SVG <use> instance trees (#13180)
		// Avoid non-left-click bubbling in Firefox (#3861)
		if ( delegateCount && cur.nodeType && (!event.button || event.type !== "click") ) {

			for ( ; cur !== this; cur = cur.parentNode || this ) {

				// Don't process clicks on disabled elements (#6911, #8165, #11382, #11764)
				if ( cur.disabled !== true || event.type !== "click" ) {
					matches = [];
					for ( i = 0; i < delegateCount; i++ ) {
						handleObj = handlers[ i ];

						// Don't conflict with Object.prototype properties (#13203)
						sel = handleObj.selector + " ";

						if ( matches[ sel ] === undefined ) {
							matches[ sel ] = handleObj.needsContext ?
								jQuery( sel, this ).index( cur ) >= 0 :
								jQuery.find( sel, this, null, [ cur ] ).length;
						}
						if ( matches[ sel ] ) {
							matches.push( handleObj );
						}
					}
					if ( matches.length ) {
						handlerQueue.push({ elem: cur, handlers: matches });
					}
				}
			}
		}

		// Add the remaining (directly-bound) handlers
		if ( delegateCount < handlers.length ) {
			handlerQueue.push({ elem: this, handlers: handlers.slice( delegateCount ) });
		}

		return handlerQueue;
	},

	// Includes some event props shared by KeyEvent and MouseEvent
	props: "altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),

	fixHooks: {},

	keyHooks: {
		props: "char charCode key keyCode".split(" "),
		filter: function( event, original ) {

			// Add which for key events
			if ( event.which == null ) {
				event.which = original.charCode != null ? original.charCode : original.keyCode;
			}

			return event;
		}
	},

	mouseHooks: {
		props: "button buttons clientX clientY offsetX offsetY pageX pageY screenX screenY toElement".split(" "),
		filter: function( event, original ) {
			var eventDoc, doc, body,
				button = original.button;

			// Calculate pageX/Y if missing and clientX/Y available
			if ( event.pageX == null && original.clientX != null ) {
				eventDoc = event.target.ownerDocument || document;
				doc = eventDoc.documentElement;
				body = eventDoc.body;

				event.pageX = original.clientX + ( doc && doc.scrollLeft || body && body.scrollLeft || 0 ) - ( doc && doc.clientLeft || body && body.clientLeft || 0 );
				event.pageY = original.clientY + ( doc && doc.scrollTop  || body && body.scrollTop  || 0 ) - ( doc && doc.clientTop  || body && body.clientTop  || 0 );
			}

			// Add which for click: 1 === left; 2 === middle; 3 === right
			// Note: button is not normalized, so don't use it
			if ( !event.which && button !== undefined ) {
				event.which = ( button & 1 ? 1 : ( button & 2 ? 3 : ( button & 4 ? 2 : 0 ) ) );
			}

			return event;
		}
	},

	fix: function( event ) {
		if ( event[ jQuery.expando ] ) {
			return event;
		}

		// Create a writable copy of the event object and normalize some properties
		var i, prop, copy,
			type = event.type,
			originalEvent = event,
			fixHook = this.fixHooks[ type ];

		if ( !fixHook ) {
			this.fixHooks[ type ] = fixHook =
				rmouseEvent.test( type ) ? this.mouseHooks :
				rkeyEvent.test( type ) ? this.keyHooks :
				{};
		}
		copy = fixHook.props ? this.props.concat( fixHook.props ) : this.props;

		event = new jQuery.Event( originalEvent );

		i = copy.length;
		while ( i-- ) {
			prop = copy[ i ];
			event[ prop ] = originalEvent[ prop ];
		}

		// Support: Cordova 2.5 (WebKit) (#13255)
		// All events should have a target; Cordova deviceready doesn't
		if ( !event.target ) {
			event.target = document;
		}

		// Support: Safari 6.0+, Chrome < 28
		// Target should not be a text node (#504, #13143)
		if ( event.target.nodeType === 3 ) {
			event.target = event.target.parentNode;
		}

		return fixHook.filter ? fixHook.filter( event, originalEvent ) : event;
	},

	special: {
		load: {
			// Prevent triggered image.load events from bubbling to window.load
			noBubble: true
		},
		focus: {
			// Fire native event if possible so blur/focus sequence is correct
			trigger: function() {
				if ( this !== safeActiveElement() && this.focus ) {
					this.focus();
					return false;
				}
			},
			delegateType: "focusin"
		},
		blur: {
			trigger: function() {
				if ( this === safeActiveElement() && this.blur ) {
					this.blur();
					return false;
				}
			},
			delegateType: "focusout"
		},
		click: {
			// For checkbox, fire native event so checked state will be right
			trigger: function() {
				if ( this.type === "checkbox" && this.click && jQuery.nodeName( this, "input" ) ) {
					this.click();
					return false;
				}
			},

			// For cross-browser consistency, don't fire native .click() on links
			_default: function( event ) {
				return jQuery.nodeName( event.target, "a" );
			}
		},

		beforeunload: {
			postDispatch: function( event ) {

				// Support: Firefox 20+
				// Firefox doesn't alert if the returnValue field is not set.
				if ( event.result !== undefined && event.originalEvent ) {
					event.originalEvent.returnValue = event.result;
				}
			}
		}
	},

	simulate: function( type, elem, event, bubble ) {
		// Piggyback on a donor event to simulate a different one.
		// Fake originalEvent to avoid donor's stopPropagation, but if the
		// simulated event prevents default then we do the same on the donor.
		var e = jQuery.extend(
			new jQuery.Event(),
			event,
			{
				type: type,
				isSimulated: true,
				originalEvent: {}
			}
		);
		if ( bubble ) {
			jQuery.event.trigger( e, null, elem );
		} else {
			jQuery.event.dispatch.call( elem, e );
		}
		if ( e.isDefaultPrevented() ) {
			event.preventDefault();
		}
	}
};

jQuery.removeEvent = function( elem, type, handle ) {
	if ( elem.removeEventListener ) {
		elem.removeEventListener( type, handle, false );
	}
};

jQuery.Event = function( src, props ) {
	// Allow instantiation without the 'new' keyword
	if ( !(this instanceof jQuery.Event) ) {
		return new jQuery.Event( src, props );
	}

	// Event object
	if ( src && src.type ) {
		this.originalEvent = src;
		this.type = src.type;

		// Events bubbling up the document may have been marked as prevented
		// by a handler lower down the tree; reflect the correct value.
		this.isDefaultPrevented = src.defaultPrevented ||
				src.defaultPrevented === undefined &&
				// Support: Android < 4.0
				src.returnValue === false ?
			returnTrue :
			returnFalse;

	// Event type
	} else {
		this.type = src;
	}

	// Put explicitly provided properties onto the event object
	if ( props ) {
		jQuery.extend( this, props );
	}

	// Create a timestamp if incoming event doesn't have one
	this.timeStamp = src && src.timeStamp || jQuery.now();

	// Mark it as fixed
	this[ jQuery.expando ] = true;
};

// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
// http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
jQuery.Event.prototype = {
	isDefaultPrevented: returnFalse,
	isPropagationStopped: returnFalse,
	isImmediatePropagationStopped: returnFalse,

	preventDefault: function() {
		var e = this.originalEvent;

		this.isDefaultPrevented = returnTrue;

		if ( e && e.preventDefault ) {
			e.preventDefault();
		}
	},
	stopPropagation: function() {
		var e = this.originalEvent;

		this.isPropagationStopped = returnTrue;

		if ( e && e.stopPropagation ) {
			e.stopPropagation();
		}
	},
	stopImmediatePropagation: function() {
		var e = this.originalEvent;

		this.isImmediatePropagationStopped = returnTrue;

		if ( e && e.stopImmediatePropagation ) {
			e.stopImmediatePropagation();
		}

		this.stopPropagation();
	}
};

// Create mouseenter/leave events using mouseover/out and event-time checks
// Support: Chrome 15+
jQuery.each({
	mouseenter: "mouseover",
	mouseleave: "mouseout",
	pointerenter: "pointerover",
	pointerleave: "pointerout"
}, function( orig, fix ) {
	jQuery.event.special[ orig ] = {
		delegateType: fix,
		bindType: fix,

		handle: function( event ) {
			var ret,
				target = this,
				related = event.relatedTarget,
				handleObj = event.handleObj;

			// For mousenter/leave call the handler if related is outside the target.
			// NB: No relatedTarget if the mouse left/entered the browser window
			if ( !related || (related !== target && !jQuery.contains( target, related )) ) {
				event.type = handleObj.origType;
				ret = handleObj.handler.apply( this, arguments );
				event.type = fix;
			}
			return ret;
		}
	};
});

// Create "bubbling" focus and blur events
// Support: Firefox, Chrome, Safari
if ( !support.focusinBubbles ) {
	jQuery.each({ focus: "focusin", blur: "focusout" }, function( orig, fix ) {

		// Attach a single capturing handler on the document while someone wants focusin/focusout
		var handler = function( event ) {
				jQuery.event.simulate( fix, event.target, jQuery.event.fix( event ), true );
			};

		jQuery.event.special[ fix ] = {
			setup: function() {
				var doc = this.ownerDocument || this,
					attaches = data_priv.access( doc, fix );

				if ( !attaches ) {
					doc.addEventListener( orig, handler, true );
				}
				data_priv.access( doc, fix, ( attaches || 0 ) + 1 );
			},
			teardown: function() {
				var doc = this.ownerDocument || this,
					attaches = data_priv.access( doc, fix ) - 1;

				if ( !attaches ) {
					doc.removeEventListener( orig, handler, true );
					data_priv.remove( doc, fix );

				} else {
					data_priv.access( doc, fix, attaches );
				}
			}
		};
	});
}

jQuery.fn.extend({

	on: function( types, selector, data, fn, /*INTERNAL*/ one ) {
		var origFn, type;

		// Types can be a map of types/handlers
		if ( typeof types === "object" ) {
			// ( types-Object, selector, data )
			if ( typeof selector !== "string" ) {
				// ( types-Object, data )
				data = data || selector;
				selector = undefined;
			}
			for ( type in types ) {
				this.on( type, selector, data, types[ type ], one );
			}
			return this;
		}

		if ( data == null && fn == null ) {
			// ( types, fn )
			fn = selector;
			data = selector = undefined;
		} else if ( fn == null ) {
			if ( typeof selector === "string" ) {
				// ( types, selector, fn )
				fn = data;
				data = undefined;
			} else {
				// ( types, data, fn )
				fn = data;
				data = selector;
				selector = undefined;
			}
		}
		if ( fn === false ) {
			fn = returnFalse;
		} else if ( !fn ) {
			return this;
		}

		if ( one === 1 ) {
			origFn = fn;
			fn = function( event ) {
				// Can use an empty set, since event contains the info
				jQuery().off( event );
				return origFn.apply( this, arguments );
			};
			// Use same guid so caller can remove using origFn
			fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
		}
		return this.each( function() {
			jQuery.event.add( this, types, fn, data, selector );
		});
	},
	one: function( types, selector, data, fn ) {
		return this.on( types, selector, data, fn, 1 );
	},
	off: function( types, selector, fn ) {
		var handleObj, type;
		if ( types && types.preventDefault && types.handleObj ) {
			// ( event )  dispatched jQuery.Event
			handleObj = types.handleObj;
			jQuery( types.delegateTarget ).off(
				handleObj.namespace ? handleObj.origType + "." + handleObj.namespace : handleObj.origType,
				handleObj.selector,
				handleObj.handler
			);
			return this;
		}
		if ( typeof types === "object" ) {
			// ( types-object [, selector] )
			for ( type in types ) {
				this.off( type, selector, types[ type ] );
			}
			return this;
		}
		if ( selector === false || typeof selector === "function" ) {
			// ( types [, fn] )
			fn = selector;
			selector = undefined;
		}
		if ( fn === false ) {
			fn = returnFalse;
		}
		return this.each(function() {
			jQuery.event.remove( this, types, fn, selector );
		});
	},

	trigger: function( type, data ) {
		return this.each(function() {
			jQuery.event.trigger( type, data, this );
		});
	},
	triggerHandler: function( type, data ) {
		var elem = this[0];
		if ( elem ) {
			return jQuery.event.trigger( type, data, elem, true );
		}
	}
});


var
	rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,
	rtagName = /<([\w:]+)/,
	rhtml = /<|&#?\w+;/,
	rnoInnerhtml = /<(?:script|style|link)/i,
	// checked="checked" or checked
	rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
	rscriptType = /^$|\/(?:java|ecma)script/i,
	rscriptTypeMasked = /^true\/(.*)/,
	rcleanScript = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,

	// We have to close these tags to support XHTML (#13200)
	wrapMap = {

		// Support: IE 9
		option: [ 1, "<select multiple='multiple'>", "</select>" ],

		thead: [ 1, "<table>", "</table>" ],
		col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
		tr: [ 2, "<table><tbody>", "</tbody></table>" ],
		td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],

		_default: [ 0, "", "" ]
	};

// Support: IE 9
wrapMap.optgroup = wrapMap.option;

wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
wrapMap.th = wrapMap.td;

// Support: 1.x compatibility
// Manipulating tables requires a tbody
function manipulationTarget( elem, content ) {
	return jQuery.nodeName( elem, "table" ) &&
		jQuery.nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ?

		elem.getElementsByTagName("tbody")[0] ||
			elem.appendChild( elem.ownerDocument.createElement("tbody") ) :
		elem;
}

// Replace/restore the type attribute of script elements for safe DOM manipulation
function disableScript( elem ) {
	elem.type = (elem.getAttribute("type") !== null) + "/" + elem.type;
	return elem;
}
function restoreScript( elem ) {
	var match = rscriptTypeMasked.exec( elem.type );

	if ( match ) {
		elem.type = match[ 1 ];
	} else {
		elem.removeAttribute("type");
	}

	return elem;
}

// Mark scripts as having already been evaluated
function setGlobalEval( elems, refElements ) {
	var i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		data_priv.set(
			elems[ i ], "globalEval", !refElements || data_priv.get( refElements[ i ], "globalEval" )
		);
	}
}

function cloneCopyEvent( src, dest ) {
	var i, l, type, pdataOld, pdataCur, udataOld, udataCur, events;

	if ( dest.nodeType !== 1 ) {
		return;
	}

	// 1. Copy private data: events, handlers, etc.
	if ( data_priv.hasData( src ) ) {
		pdataOld = data_priv.access( src );
		pdataCur = data_priv.set( dest, pdataOld );
		events = pdataOld.events;

		if ( events ) {
			delete pdataCur.handle;
			pdataCur.events = {};

			for ( type in events ) {
				for ( i = 0, l = events[ type ].length; i < l; i++ ) {
					jQuery.event.add( dest, type, events[ type ][ i ] );
				}
			}
		}
	}

	// 2. Copy user data
	if ( data_user.hasData( src ) ) {
		udataOld = data_user.access( src );
		udataCur = jQuery.extend( {}, udataOld );

		data_user.set( dest, udataCur );
	}
}

function getAll( context, tag ) {
	var ret = context.getElementsByTagName ? context.getElementsByTagName( tag || "*" ) :
			context.querySelectorAll ? context.querySelectorAll( tag || "*" ) :
			[];

	return tag === undefined || tag && jQuery.nodeName( context, tag ) ?
		jQuery.merge( [ context ], ret ) :
		ret;
}

// Support: IE >= 9
function fixInput( src, dest ) {
	var nodeName = dest.nodeName.toLowerCase();

	// Fails to persist the checked state of a cloned checkbox or radio button.
	if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
		dest.checked = src.checked;

	// Fails to return the selected option to the default selected state when cloning options
	} else if ( nodeName === "input" || nodeName === "textarea" ) {
		dest.defaultValue = src.defaultValue;
	}
}

jQuery.extend({
	clone: function( elem, dataAndEvents, deepDataAndEvents ) {
		var i, l, srcElements, destElements,
			clone = elem.cloneNode( true ),
			inPage = jQuery.contains( elem.ownerDocument, elem );

		// Support: IE >= 9
		// Fix Cloning issues
		if ( !support.noCloneChecked && ( elem.nodeType === 1 || elem.nodeType === 11 ) &&
				!jQuery.isXMLDoc( elem ) ) {

			// We eschew Sizzle here for performance reasons: http://jsperf.com/getall-vs-sizzle/2
			destElements = getAll( clone );
			srcElements = getAll( elem );

			for ( i = 0, l = srcElements.length; i < l; i++ ) {
				fixInput( srcElements[ i ], destElements[ i ] );
			}
		}

		// Copy the events from the original to the clone
		if ( dataAndEvents ) {
			if ( deepDataAndEvents ) {
				srcElements = srcElements || getAll( elem );
				destElements = destElements || getAll( clone );

				for ( i = 0, l = srcElements.length; i < l; i++ ) {
					cloneCopyEvent( srcElements[ i ], destElements[ i ] );
				}
			} else {
				cloneCopyEvent( elem, clone );
			}
		}

		// Preserve script evaluation history
		destElements = getAll( clone, "script" );
		if ( destElements.length > 0 ) {
			setGlobalEval( destElements, !inPage && getAll( elem, "script" ) );
		}

		// Return the cloned set
		return clone;
	},

	buildFragment: function( elems, context, scripts, selection ) {
		var elem, tmp, tag, wrap, contains, j,
			fragment = context.createDocumentFragment(),
			nodes = [],
			i = 0,
			l = elems.length;

		for ( ; i < l; i++ ) {
			elem = elems[ i ];

			if ( elem || elem === 0 ) {

				// Add nodes directly
				if ( jQuery.type( elem ) === "object" ) {
					// Support: QtWebKit
					// jQuery.merge because push.apply(_, arraylike) throws
					jQuery.merge( nodes, elem.nodeType ? [ elem ] : elem );

				// Convert non-html into a text node
				} else if ( !rhtml.test( elem ) ) {
					nodes.push( context.createTextNode( elem ) );

				// Convert html into DOM nodes
				} else {
					tmp = tmp || fragment.appendChild( context.createElement("div") );

					// Deserialize a standard representation
					tag = ( rtagName.exec( elem ) || [ "", "" ] )[ 1 ].toLowerCase();
					wrap = wrapMap[ tag ] || wrapMap._default;
					tmp.innerHTML = wrap[ 1 ] + elem.replace( rxhtmlTag, "<$1></$2>" ) + wrap[ 2 ];

					// Descend through wrappers to the right content
					j = wrap[ 0 ];
					while ( j-- ) {
						tmp = tmp.lastChild;
					}

					// Support: QtWebKit
					// jQuery.merge because push.apply(_, arraylike) throws
					jQuery.merge( nodes, tmp.childNodes );

					// Remember the top-level container
					tmp = fragment.firstChild;

					// Fixes #12346
					// Support: Webkit, IE
					tmp.textContent = "";
				}
			}
		}

		// Remove wrapper from fragment
		fragment.textContent = "";

		i = 0;
		while ( (elem = nodes[ i++ ]) ) {

			// #4087 - If origin and destination elements are the same, and this is
			// that element, do not do anything
			if ( selection && jQuery.inArray( elem, selection ) !== -1 ) {
				continue;
			}

			contains = jQuery.contains( elem.ownerDocument, elem );

			// Append to fragment
			tmp = getAll( fragment.appendChild( elem ), "script" );

			// Preserve script evaluation history
			if ( contains ) {
				setGlobalEval( tmp );
			}

			// Capture executables
			if ( scripts ) {
				j = 0;
				while ( (elem = tmp[ j++ ]) ) {
					if ( rscriptType.test( elem.type || "" ) ) {
						scripts.push( elem );
					}
				}
			}
		}

		return fragment;
	},

	cleanData: function( elems ) {
		var data, elem, type, key,
			special = jQuery.event.special,
			i = 0;

		for ( ; (elem = elems[ i ]) !== undefined; i++ ) {
			if ( jQuery.acceptData( elem ) ) {
				key = elem[ data_priv.expando ];

				if ( key && (data = data_priv.cache[ key ]) ) {
					if ( data.events ) {
						for ( type in data.events ) {
							if ( special[ type ] ) {
								jQuery.event.remove( elem, type );

							// This is a shortcut to avoid jQuery.event.remove's overhead
							} else {
								jQuery.removeEvent( elem, type, data.handle );
							}
						}
					}
					if ( data_priv.cache[ key ] ) {
						// Discard any remaining `private` data
						delete data_priv.cache[ key ];
					}
				}
			}
			// Discard any remaining `user` data
			delete data_user.cache[ elem[ data_user.expando ] ];
		}
	}
});

jQuery.fn.extend({
	text: function( value ) {
		return access( this, function( value ) {
			return value === undefined ?
				jQuery.text( this ) :
				this.empty().each(function() {
					if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
						this.textContent = value;
					}
				});
		}, null, value, arguments.length );
	},

	append: function() {
		return this.domManip( arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.appendChild( elem );
			}
		});
	},

	prepend: function() {
		return this.domManip( arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.insertBefore( elem, target.firstChild );
			}
		});
	},

	before: function() {
		return this.domManip( arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this );
			}
		});
	},

	after: function() {
		return this.domManip( arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this.nextSibling );
			}
		});
	},

	remove: function( selector, keepData /* Internal Use Only */ ) {
		var elem,
			elems = selector ? jQuery.filter( selector, this ) : this,
			i = 0;

		for ( ; (elem = elems[i]) != null; i++ ) {
			if ( !keepData && elem.nodeType === 1 ) {
				jQuery.cleanData( getAll( elem ) );
			}

			if ( elem.parentNode ) {
				if ( keepData && jQuery.contains( elem.ownerDocument, elem ) ) {
					setGlobalEval( getAll( elem, "script" ) );
				}
				elem.parentNode.removeChild( elem );
			}
		}

		return this;
	},

	empty: function() {
		var elem,
			i = 0;

		for ( ; (elem = this[i]) != null; i++ ) {
			if ( elem.nodeType === 1 ) {

				// Prevent memory leaks
				jQuery.cleanData( getAll( elem, false ) );

				// Remove any remaining nodes
				elem.textContent = "";
			}
		}

		return this;
	},

	clone: function( dataAndEvents, deepDataAndEvents ) {
		dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
		deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

		return this.map(function() {
			return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
		});
	},

	html: function( value ) {
		return access( this, function( value ) {
			var elem = this[ 0 ] || {},
				i = 0,
				l = this.length;

			if ( value === undefined && elem.nodeType === 1 ) {
				return elem.innerHTML;
			}

			// See if we can take a shortcut and just use innerHTML
			if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
				!wrapMap[ ( rtagName.exec( value ) || [ "", "" ] )[ 1 ].toLowerCase() ] ) {

				value = value.replace( rxhtmlTag, "<$1></$2>" );

				try {
					for ( ; i < l; i++ ) {
						elem = this[ i ] || {};

						// Remove element nodes and prevent memory leaks
						if ( elem.nodeType === 1 ) {
							jQuery.cleanData( getAll( elem, false ) );
							elem.innerHTML = value;
						}
					}

					elem = 0;

				// If using innerHTML throws an exception, use the fallback method
				} catch( e ) {}
			}

			if ( elem ) {
				this.empty().append( value );
			}
		}, null, value, arguments.length );
	},

	replaceWith: function() {
		var arg = arguments[ 0 ];

		// Make the changes, replacing each context element with the new content
		this.domManip( arguments, function( elem ) {
			arg = this.parentNode;

			jQuery.cleanData( getAll( this ) );

			if ( arg ) {
				arg.replaceChild( elem, this );
			}
		});

		// Force removal if there was no new content (e.g., from empty arguments)
		return arg && (arg.length || arg.nodeType) ? this : this.remove();
	},

	detach: function( selector ) {
		return this.remove( selector, true );
	},

	domManip: function( args, callback ) {

		// Flatten any nested arrays
		args = concat.apply( [], args );

		var fragment, first, scripts, hasScripts, node, doc,
			i = 0,
			l = this.length,
			set = this,
			iNoClone = l - 1,
			value = args[ 0 ],
			isFunction = jQuery.isFunction( value );

		// We can't cloneNode fragments that contain checked, in WebKit
		if ( isFunction ||
				( l > 1 && typeof value === "string" &&
					!support.checkClone && rchecked.test( value ) ) ) {
			return this.each(function( index ) {
				var self = set.eq( index );
				if ( isFunction ) {
					args[ 0 ] = value.call( this, index, self.html() );
				}
				self.domManip( args, callback );
			});
		}

		if ( l ) {
			fragment = jQuery.buildFragment( args, this[ 0 ].ownerDocument, false, this );
			first = fragment.firstChild;

			if ( fragment.childNodes.length === 1 ) {
				fragment = first;
			}

			if ( first ) {
				scripts = jQuery.map( getAll( fragment, "script" ), disableScript );
				hasScripts = scripts.length;

				// Use the original fragment for the last item instead of the first because it can end up
				// being emptied incorrectly in certain situations (#8070).
				for ( ; i < l; i++ ) {
					node = fragment;

					if ( i !== iNoClone ) {
						node = jQuery.clone( node, true, true );

						// Keep references to cloned scripts for later restoration
						if ( hasScripts ) {
							// Support: QtWebKit
							// jQuery.merge because push.apply(_, arraylike) throws
							jQuery.merge( scripts, getAll( node, "script" ) );
						}
					}

					callback.call( this[ i ], node, i );
				}

				if ( hasScripts ) {
					doc = scripts[ scripts.length - 1 ].ownerDocument;

					// Reenable scripts
					jQuery.map( scripts, restoreScript );

					// Evaluate executable scripts on first document insertion
					for ( i = 0; i < hasScripts; i++ ) {
						node = scripts[ i ];
						if ( rscriptType.test( node.type || "" ) &&
							!data_priv.access( node, "globalEval" ) && jQuery.contains( doc, node ) ) {

							if ( node.src ) {
								// Optional AJAX dependency, but won't run scripts if not present
								if ( jQuery._evalUrl ) {
									jQuery._evalUrl( node.src );
								}
							} else {
								jQuery.globalEval( node.textContent.replace( rcleanScript, "" ) );
							}
						}
					}
				}
			}
		}

		return this;
	}
});

jQuery.each({
	appendTo: "append",
	prependTo: "prepend",
	insertBefore: "before",
	insertAfter: "after",
	replaceAll: "replaceWith"
}, function( name, original ) {
	jQuery.fn[ name ] = function( selector ) {
		var elems,
			ret = [],
			insert = jQuery( selector ),
			last = insert.length - 1,
			i = 0;

		for ( ; i <= last; i++ ) {
			elems = i === last ? this : this.clone( true );
			jQuery( insert[ i ] )[ original ]( elems );

			// Support: QtWebKit
			// .get() because push.apply(_, arraylike) throws
			push.apply( ret, elems.get() );
		}

		return this.pushStack( ret );
	};
});


var iframe,
	elemdisplay = {};

/**
 * Retrieve the actual display of a element
 * @param {String} name nodeName of the element
 * @param {Object} doc Document object
 */
// Called only from within defaultDisplay
function actualDisplay( name, doc ) {
	var style,
		elem = jQuery( doc.createElement( name ) ).appendTo( doc.body ),

		// getDefaultComputedStyle might be reliably used only on attached element
		display = window.getDefaultComputedStyle && ( style = window.getDefaultComputedStyle( elem[ 0 ] ) ) ?

			// Use of this method is a temporary fix (more like optmization) until something better comes along,
			// since it was removed from specification and supported only in FF
			style.display : jQuery.css( elem[ 0 ], "display" );

	// We don't have any data stored on the element,
	// so use "detach" method as fast way to get rid of the element
	elem.detach();

	return display;
}

/**
 * Try to determine the default display value of an element
 * @param {String} nodeName
 */
function defaultDisplay( nodeName ) {
	var doc = document,
		display = elemdisplay[ nodeName ];

	if ( !display ) {
		display = actualDisplay( nodeName, doc );

		// If the simple way fails, read from inside an iframe
		if ( display === "none" || !display ) {

			// Use the already-created iframe if possible
			iframe = (iframe || jQuery( "<iframe frameborder='0' width='0' height='0'/>" )).appendTo( doc.documentElement );

			// Always write a new HTML skeleton so Webkit and Firefox don't choke on reuse
			doc = iframe[ 0 ].contentDocument;

			// Support: IE
			doc.write();
			doc.close();

			display = actualDisplay( nodeName, doc );
			iframe.detach();
		}

		// Store the correct default display
		elemdisplay[ nodeName ] = display;
	}

	return display;
}
var rmargin = (/^margin/);

var rnumnonpx = new RegExp( "^(" + pnum + ")(?!px)[a-z%]+$", "i" );

var getStyles = function( elem ) {
		return elem.ownerDocument.defaultView.getComputedStyle( elem, null );
	};



function curCSS( elem, name, computed ) {
	var width, minWidth, maxWidth, ret,
		style = elem.style;

	computed = computed || getStyles( elem );

	// Support: IE9
	// getPropertyValue is only needed for .css('filter') in IE9, see #12537
	if ( computed ) {
		ret = computed.getPropertyValue( name ) || computed[ name ];
	}

	if ( computed ) {

		if ( ret === "" && !jQuery.contains( elem.ownerDocument, elem ) ) {
			ret = jQuery.style( elem, name );
		}

		// Support: iOS < 6
		// A tribute to the "awesome hack by Dean Edwards"
		// iOS < 6 (at least) returns percentage for a larger set of values, but width seems to be reliably pixels
		// this is against the CSSOM draft spec: http://dev.w3.org/csswg/cssom/#resolved-values
		if ( rnumnonpx.test( ret ) && rmargin.test( name ) ) {

			// Remember the original values
			width = style.width;
			minWidth = style.minWidth;
			maxWidth = style.maxWidth;

			// Put in the new values to get a computed value out
			style.minWidth = style.maxWidth = style.width = ret;
			ret = computed.width;

			// Revert the changed values
			style.width = width;
			style.minWidth = minWidth;
			style.maxWidth = maxWidth;
		}
	}

	return ret !== undefined ?
		// Support: IE
		// IE returns zIndex value as an integer.
		ret + "" :
		ret;
}


function addGetHookIf( conditionFn, hookFn ) {
	// Define the hook, we'll check on the first run if it's really needed.
	return {
		get: function() {
			if ( conditionFn() ) {
				// Hook not needed (or it's not possible to use it due to missing dependency),
				// remove it.
				// Since there are no other hooks for marginRight, remove the whole object.
				delete this.get;
				return;
			}

			// Hook needed; redefine it so that the support test is not executed again.

			return (this.get = hookFn).apply( this, arguments );
		}
	};
}


(function() {
	var pixelPositionVal, boxSizingReliableVal,
		docElem = document.documentElement,
		container = document.createElement( "div" ),
		div = document.createElement( "div" );

	if ( !div.style ) {
		return;
	}

	div.style.backgroundClip = "content-box";
	div.cloneNode( true ).style.backgroundClip = "";
	support.clearCloneStyle = div.style.backgroundClip === "content-box";

	container.style.cssText = "border:0;width:0;height:0;top:0;left:-9999px;margin-top:1px;" +
		"position:absolute";
	container.appendChild( div );

	// Executing both pixelPosition & boxSizingReliable tests require only one layout
	// so they're executed at the same time to save the second computation.
	function computePixelPositionAndBoxSizingReliable() {
		div.style.cssText =
			// Support: Firefox<29, Android 2.3
			// Vendor-prefix box-sizing
			"-webkit-box-sizing:border-box;-moz-box-sizing:border-box;" +
			"box-sizing:border-box;display:block;margin-top:1%;top:1%;" +
			"border:1px;padding:1px;width:4px;position:absolute";
		div.innerHTML = "";
		docElem.appendChild( container );

		var divStyle = window.getComputedStyle( div, null );
		pixelPositionVal = divStyle.top !== "1%";
		boxSizingReliableVal = divStyle.width === "4px";

		docElem.removeChild( container );
	}

	// Support: node.js jsdom
	// Don't assume that getComputedStyle is a property of the global object
	if ( window.getComputedStyle ) {
		jQuery.extend( support, {
			pixelPosition: function() {
				// This test is executed only once but we still do memoizing
				// since we can use the boxSizingReliable pre-computing.
				// No need to check if the test was already performed, though.
				computePixelPositionAndBoxSizingReliable();
				return pixelPositionVal;
			},
			boxSizingReliable: function() {
				if ( boxSizingReliableVal == null ) {
					computePixelPositionAndBoxSizingReliable();
				}
				return boxSizingReliableVal;
			},
			reliableMarginRight: function() {
				// Support: Android 2.3
				// Check if div with explicit width and no margin-right incorrectly
				// gets computed margin-right based on width of container. (#3333)
				// WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
				// This support function is only executed once so no memoizing is needed.
				var ret,
					marginDiv = div.appendChild( document.createElement( "div" ) );

				// Reset CSS: box-sizing; display; margin; border; padding
				marginDiv.style.cssText = div.style.cssText =
					// Support: Firefox<29, Android 2.3
					// Vendor-prefix box-sizing
					"-webkit-box-sizing:content-box;-moz-box-sizing:content-box;" +
					"box-sizing:content-box;display:block;margin:0;border:0;padding:0";
				marginDiv.style.marginRight = marginDiv.style.width = "0";
				div.style.width = "1px";
				docElem.appendChild( container );

				ret = !parseFloat( window.getComputedStyle( marginDiv, null ).marginRight );

				docElem.removeChild( container );

				return ret;
			}
		});
	}
})();


// A method for quickly swapping in/out CSS properties to get correct calculations.
jQuery.swap = function( elem, options, callback, args ) {
	var ret, name,
		old = {};

	// Remember the old values, and insert the new ones
	for ( name in options ) {
		old[ name ] = elem.style[ name ];
		elem.style[ name ] = options[ name ];
	}

	ret = callback.apply( elem, args || [] );

	// Revert the old values
	for ( name in options ) {
		elem.style[ name ] = old[ name ];
	}

	return ret;
};


var
	// swappable if display is none or starts with table except "table", "table-cell", or "table-caption"
	// see here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
	rdisplayswap = /^(none|table(?!-c[ea]).+)/,
	rnumsplit = new RegExp( "^(" + pnum + ")(.*)$", "i" ),
	rrelNum = new RegExp( "^([+-])=(" + pnum + ")", "i" ),

	cssShow = { position: "absolute", visibility: "hidden", display: "block" },
	cssNormalTransform = {
		letterSpacing: "0",
		fontWeight: "400"
	},

	cssPrefixes = [ "Webkit", "O", "Moz", "ms" ];

// return a css property mapped to a potentially vendor prefixed property
function vendorPropName( style, name ) {

	// shortcut for names that are not vendor prefixed
	if ( name in style ) {
		return name;
	}

	// check for vendor prefixed names
	var capName = name[0].toUpperCase() + name.slice(1),
		origName = name,
		i = cssPrefixes.length;

	while ( i-- ) {
		name = cssPrefixes[ i ] + capName;
		if ( name in style ) {
			return name;
		}
	}

	return origName;
}

function setPositiveNumber( elem, value, subtract ) {
	var matches = rnumsplit.exec( value );
	return matches ?
		// Guard against undefined "subtract", e.g., when used as in cssHooks
		Math.max( 0, matches[ 1 ] - ( subtract || 0 ) ) + ( matches[ 2 ] || "px" ) :
		value;
}

function augmentWidthOrHeight( elem, name, extra, isBorderBox, styles ) {
	var i = extra === ( isBorderBox ? "border" : "content" ) ?
		// If we already have the right measurement, avoid augmentation
		4 :
		// Otherwise initialize for horizontal or vertical properties
		name === "width" ? 1 : 0,

		val = 0;

	for ( ; i < 4; i += 2 ) {
		// both box models exclude margin, so add it if we want it
		if ( extra === "margin" ) {
			val += jQuery.css( elem, extra + cssExpand[ i ], true, styles );
		}

		if ( isBorderBox ) {
			// border-box includes padding, so remove it if we want content
			if ( extra === "content" ) {
				val -= jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
			}

			// at this point, extra isn't border nor margin, so remove border
			if ( extra !== "margin" ) {
				val -= jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		} else {
			// at this point, extra isn't content, so add padding
			val += jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );

			// at this point, extra isn't content nor padding, so add border
			if ( extra !== "padding" ) {
				val += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		}
	}

	return val;
}

function getWidthOrHeight( elem, name, extra ) {

	// Start with offset property, which is equivalent to the border-box value
	var valueIsBorderBox = true,
		val = name === "width" ? elem.offsetWidth : elem.offsetHeight,
		styles = getStyles( elem ),
		isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box";

	// some non-html elements return undefined for offsetWidth, so check for null/undefined
	// svg - https://bugzilla.mozilla.org/show_bug.cgi?id=649285
	// MathML - https://bugzilla.mozilla.org/show_bug.cgi?id=491668
	if ( val <= 0 || val == null ) {
		// Fall back to computed then uncomputed css if necessary
		val = curCSS( elem, name, styles );
		if ( val < 0 || val == null ) {
			val = elem.style[ name ];
		}

		// Computed unit is not pixels. Stop here and return.
		if ( rnumnonpx.test(val) ) {
			return val;
		}

		// we need the check for style in case a browser which returns unreliable values
		// for getComputedStyle silently falls back to the reliable elem.style
		valueIsBorderBox = isBorderBox &&
			( support.boxSizingReliable() || val === elem.style[ name ] );

		// Normalize "", auto, and prepare for extra
		val = parseFloat( val ) || 0;
	}

	// use the active box-sizing model to add/subtract irrelevant styles
	return ( val +
		augmentWidthOrHeight(
			elem,
			name,
			extra || ( isBorderBox ? "border" : "content" ),
			valueIsBorderBox,
			styles
		)
	) + "px";
}

function showHide( elements, show ) {
	var display, elem, hidden,
		values = [],
		index = 0,
		length = elements.length;

	for ( ; index < length; index++ ) {
		elem = elements[ index ];
		if ( !elem.style ) {
			continue;
		}

		values[ index ] = data_priv.get( elem, "olddisplay" );
		display = elem.style.display;
		if ( show ) {
			// Reset the inline display of this element to learn if it is
			// being hidden by cascaded rules or not
			if ( !values[ index ] && display === "none" ) {
				elem.style.display = "";
			}

			// Set elements which have been overridden with display: none
			// in a stylesheet to whatever the default browser style is
			// for such an element
			if ( elem.style.display === "" && isHidden( elem ) ) {
				values[ index ] = data_priv.access( elem, "olddisplay", defaultDisplay(elem.nodeName) );
			}
		} else {
			hidden = isHidden( elem );

			if ( display !== "none" || !hidden ) {
				data_priv.set( elem, "olddisplay", hidden ? display : jQuery.css( elem, "display" ) );
			}
		}
	}

	// Set the display of most of the elements in a second loop
	// to avoid the constant reflow
	for ( index = 0; index < length; index++ ) {
		elem = elements[ index ];
		if ( !elem.style ) {
			continue;
		}
		if ( !show || elem.style.display === "none" || elem.style.display === "" ) {
			elem.style.display = show ? values[ index ] || "" : "none";
		}
	}

	return elements;
}

jQuery.extend({
	// Add in style property hooks for overriding the default
	// behavior of getting and setting a style property
	cssHooks: {
		opacity: {
			get: function( elem, computed ) {
				if ( computed ) {
					// We should always get a number back from opacity
					var ret = curCSS( elem, "opacity" );
					return ret === "" ? "1" : ret;
				}
			}
		}
	},

	// Don't automatically add "px" to these possibly-unitless properties
	cssNumber: {
		"columnCount": true,
		"fillOpacity": true,
		"flexGrow": true,
		"flexShrink": true,
		"fontWeight": true,
		"lineHeight": true,
		"opacity": true,
		"order": true,
		"orphans": true,
		"widows": true,
		"zIndex": true,
		"zoom": true
	},

	// Add in properties whose names you wish to fix before
	// setting or getting the value
	cssProps: {
		// normalize float css property
		"float": "cssFloat"
	},

	// Get and set the style property on a DOM Node
	style: function( elem, name, value, extra ) {
		// Don't set styles on text and comment nodes
		if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
			return;
		}

		// Make sure that we're working with the right name
		var ret, type, hooks,
			origName = jQuery.camelCase( name ),
			style = elem.style;

		name = jQuery.cssProps[ origName ] || ( jQuery.cssProps[ origName ] = vendorPropName( style, origName ) );

		// gets hook for the prefixed version
		// followed by the unprefixed version
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// Check if we're setting a value
		if ( value !== undefined ) {
			type = typeof value;

			// convert relative number strings (+= or -=) to relative numbers. #7345
			if ( type === "string" && (ret = rrelNum.exec( value )) ) {
				value = ( ret[1] + 1 ) * ret[2] + parseFloat( jQuery.css( elem, name ) );
				// Fixes bug #9237
				type = "number";
			}

			// Make sure that null and NaN values aren't set. See: #7116
			if ( value == null || value !== value ) {
				return;
			}

			// If a number was passed in, add 'px' to the (except for certain CSS properties)
			if ( type === "number" && !jQuery.cssNumber[ origName ] ) {
				value += "px";
			}

			// Fixes #8908, it can be done more correctly by specifying setters in cssHooks,
			// but it would mean to define eight (for every problematic property) identical functions
			if ( !support.clearCloneStyle && value === "" && name.indexOf( "background" ) === 0 ) {
				style[ name ] = "inherit";
			}

			// If a hook was provided, use that value, otherwise just set the specified value
			if ( !hooks || !("set" in hooks) || (value = hooks.set( elem, value, extra )) !== undefined ) {
				style[ name ] = value;
			}

		} else {
			// If a hook was provided get the non-computed value from there
			if ( hooks && "get" in hooks && (ret = hooks.get( elem, false, extra )) !== undefined ) {
				return ret;
			}

			// Otherwise just get the value from the style object
			return style[ name ];
		}
	},

	css: function( elem, name, extra, styles ) {
		var val, num, hooks,
			origName = jQuery.camelCase( name );

		// Make sure that we're working with the right name
		name = jQuery.cssProps[ origName ] || ( jQuery.cssProps[ origName ] = vendorPropName( elem.style, origName ) );

		// gets hook for the prefixed version
		// followed by the unprefixed version
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// If a hook was provided get the computed value from there
		if ( hooks && "get" in hooks ) {
			val = hooks.get( elem, true, extra );
		}

		// Otherwise, if a way to get the computed value exists, use that
		if ( val === undefined ) {
			val = curCSS( elem, name, styles );
		}

		//convert "normal" to computed value
		if ( val === "normal" && name in cssNormalTransform ) {
			val = cssNormalTransform[ name ];
		}

		// Return, converting to number if forced or a qualifier was provided and val looks numeric
		if ( extra === "" || extra ) {
			num = parseFloat( val );
			return extra === true || jQuery.isNumeric( num ) ? num || 0 : val;
		}
		return val;
	}
});

jQuery.each([ "height", "width" ], function( i, name ) {
	jQuery.cssHooks[ name ] = {
		get: function( elem, computed, extra ) {
			if ( computed ) {
				// certain elements can have dimension info if we invisibly show them
				// however, it must have a current display style that would benefit from this
				return rdisplayswap.test( jQuery.css( elem, "display" ) ) && elem.offsetWidth === 0 ?
					jQuery.swap( elem, cssShow, function() {
						return getWidthOrHeight( elem, name, extra );
					}) :
					getWidthOrHeight( elem, name, extra );
			}
		},

		set: function( elem, value, extra ) {
			var styles = extra && getStyles( elem );
			return setPositiveNumber( elem, value, extra ?
				augmentWidthOrHeight(
					elem,
					name,
					extra,
					jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
					styles
				) : 0
			);
		}
	};
});

// Support: Android 2.3
jQuery.cssHooks.marginRight = addGetHookIf( support.reliableMarginRight,
	function( elem, computed ) {
		if ( computed ) {
			// WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
			// Work around by temporarily setting element display to inline-block
			return jQuery.swap( elem, { "display": "inline-block" },
				curCSS, [ elem, "marginRight" ] );
		}
	}
);

// These hooks are used by animate to expand properties
jQuery.each({
	margin: "",
	padding: "",
	border: "Width"
}, function( prefix, suffix ) {
	jQuery.cssHooks[ prefix + suffix ] = {
		expand: function( value ) {
			var i = 0,
				expanded = {},

				// assumes a single number if not a string
				parts = typeof value === "string" ? value.split(" ") : [ value ];

			for ( ; i < 4; i++ ) {
				expanded[ prefix + cssExpand[ i ] + suffix ] =
					parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
			}

			return expanded;
		}
	};

	if ( !rmargin.test( prefix ) ) {
		jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
	}
});

jQuery.fn.extend({
	css: function( name, value ) {
		return access( this, function( elem, name, value ) {
			var styles, len,
				map = {},
				i = 0;

			if ( jQuery.isArray( name ) ) {
				styles = getStyles( elem );
				len = name.length;

				for ( ; i < len; i++ ) {
					map[ name[ i ] ] = jQuery.css( elem, name[ i ], false, styles );
				}

				return map;
			}

			return value !== undefined ?
				jQuery.style( elem, name, value ) :
				jQuery.css( elem, name );
		}, name, value, arguments.length > 1 );
	},
	show: function() {
		return showHide( this, true );
	},
	hide: function() {
		return showHide( this );
	},
	toggle: function( state ) {
		if ( typeof state === "boolean" ) {
			return state ? this.show() : this.hide();
		}

		return this.each(function() {
			if ( isHidden( this ) ) {
				jQuery( this ).show();
			} else {
				jQuery( this ).hide();
			}
		});
	}
});


function Tween( elem, options, prop, end, easing ) {
	return new Tween.prototype.init( elem, options, prop, end, easing );
}
jQuery.Tween = Tween;

Tween.prototype = {
	constructor: Tween,
	init: function( elem, options, prop, end, easing, unit ) {
		this.elem = elem;
		this.prop = prop;
		this.easing = easing || "swing";
		this.options = options;
		this.start = this.now = this.cur();
		this.end = end;
		this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
	},
	cur: function() {
		var hooks = Tween.propHooks[ this.prop ];

		return hooks && hooks.get ?
			hooks.get( this ) :
			Tween.propHooks._default.get( this );
	},
	run: function( percent ) {
		var eased,
			hooks = Tween.propHooks[ this.prop ];

		if ( this.options.duration ) {
			this.pos = eased = jQuery.easing[ this.easing ](
				percent, this.options.duration * percent, 0, 1, this.options.duration
			);
		} else {
			this.pos = eased = percent;
		}
		this.now = ( this.end - this.start ) * eased + this.start;

		if ( this.options.step ) {
			this.options.step.call( this.elem, this.now, this );
		}

		if ( hooks && hooks.set ) {
			hooks.set( this );
		} else {
			Tween.propHooks._default.set( this );
		}
		return this;
	}
};

Tween.prototype.init.prototype = Tween.prototype;

Tween.propHooks = {
	_default: {
		get: function( tween ) {
			var result;

			if ( tween.elem[ tween.prop ] != null &&
				(!tween.elem.style || tween.elem.style[ tween.prop ] == null) ) {
				return tween.elem[ tween.prop ];
			}

			// passing an empty string as a 3rd parameter to .css will automatically
			// attempt a parseFloat and fallback to a string if the parse fails
			// so, simple values such as "10px" are parsed to Float.
			// complex values such as "rotate(1rad)" are returned as is.
			result = jQuery.css( tween.elem, tween.prop, "" );
			// Empty strings, null, undefined and "auto" are converted to 0.
			return !result || result === "auto" ? 0 : result;
		},
		set: function( tween ) {
			// use step hook for back compat - use cssHook if its there - use .style if its
			// available and use plain properties where available
			if ( jQuery.fx.step[ tween.prop ] ) {
				jQuery.fx.step[ tween.prop ]( tween );
			} else if ( tween.elem.style && ( tween.elem.style[ jQuery.cssProps[ tween.prop ] ] != null || jQuery.cssHooks[ tween.prop ] ) ) {
				jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
			} else {
				tween.elem[ tween.prop ] = tween.now;
			}
		}
	}
};

// Support: IE9
// Panic based approach to setting things on disconnected nodes

Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
	set: function( tween ) {
		if ( tween.elem.nodeType && tween.elem.parentNode ) {
			tween.elem[ tween.prop ] = tween.now;
		}
	}
};

jQuery.easing = {
	linear: function( p ) {
		return p;
	},
	swing: function( p ) {
		return 0.5 - Math.cos( p * Math.PI ) / 2;
	}
};

jQuery.fx = Tween.prototype.init;

// Back Compat <1.8 extension point
jQuery.fx.step = {};




var
	fxNow, timerId,
	rfxtypes = /^(?:toggle|show|hide)$/,
	rfxnum = new RegExp( "^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i" ),
	rrun = /queueHooks$/,
	animationPrefilters = [ defaultPrefilter ],
	tweeners = {
		"*": [ function( prop, value ) {
			var tween = this.createTween( prop, value ),
				target = tween.cur(),
				parts = rfxnum.exec( value ),
				unit = parts && parts[ 3 ] || ( jQuery.cssNumber[ prop ] ? "" : "px" ),

				// Starting value computation is required for potential unit mismatches
				start = ( jQuery.cssNumber[ prop ] || unit !== "px" && +target ) &&
					rfxnum.exec( jQuery.css( tween.elem, prop ) ),
				scale = 1,
				maxIterations = 20;

			if ( start && start[ 3 ] !== unit ) {
				// Trust units reported by jQuery.css
				unit = unit || start[ 3 ];

				// Make sure we update the tween properties later on
				parts = parts || [];

				// Iteratively approximate from a nonzero starting point
				start = +target || 1;

				do {
					// If previous iteration zeroed out, double until we get *something*
					// Use a string for doubling factor so we don't accidentally see scale as unchanged below
					scale = scale || ".5";

					// Adjust and apply
					start = start / scale;
					jQuery.style( tween.elem, prop, start + unit );

				// Update scale, tolerating zero or NaN from tween.cur()
				// And breaking the loop if scale is unchanged or perfect, or if we've just had enough
				} while ( scale !== (scale = tween.cur() / target) && scale !== 1 && --maxIterations );
			}

			// Update tween properties
			if ( parts ) {
				start = tween.start = +start || +target || 0;
				tween.unit = unit;
				// If a +=/-= token was provided, we're doing a relative animation
				tween.end = parts[ 1 ] ?
					start + ( parts[ 1 ] + 1 ) * parts[ 2 ] :
					+parts[ 2 ];
			}

			return tween;
		} ]
	};

// Animations created synchronously will run synchronously
function createFxNow() {
	setTimeout(function() {
		fxNow = undefined;
	});
	return ( fxNow = jQuery.now() );
}

// Generate parameters to create a standard animation
function genFx( type, includeWidth ) {
	var which,
		i = 0,
		attrs = { height: type };

	// if we include width, step value is 1 to do all cssExpand values,
	// if we don't include width, step value is 2 to skip over Left and Right
	includeWidth = includeWidth ? 1 : 0;
	for ( ; i < 4 ; i += 2 - includeWidth ) {
		which = cssExpand[ i ];
		attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
	}

	if ( includeWidth ) {
		attrs.opacity = attrs.width = type;
	}

	return attrs;
}

function createTween( value, prop, animation ) {
	var tween,
		collection = ( tweeners[ prop ] || [] ).concat( tweeners[ "*" ] ),
		index = 0,
		length = collection.length;
	for ( ; index < length; index++ ) {
		if ( (tween = collection[ index ].call( animation, prop, value )) ) {

			// we're done with this property
			return tween;
		}
	}
}

function defaultPrefilter( elem, props, opts ) {
	/* jshint validthis: true */
	var prop, value, toggle, tween, hooks, oldfire, display, checkDisplay,
		anim = this,
		orig = {},
		style = elem.style,
		hidden = elem.nodeType && isHidden( elem ),
		dataShow = data_priv.get( elem, "fxshow" );

	// handle queue: false promises
	if ( !opts.queue ) {
		hooks = jQuery._queueHooks( elem, "fx" );
		if ( hooks.unqueued == null ) {
			hooks.unqueued = 0;
			oldfire = hooks.empty.fire;
			hooks.empty.fire = function() {
				if ( !hooks.unqueued ) {
					oldfire();
				}
			};
		}
		hooks.unqueued++;

		anim.always(function() {
			// doing this makes sure that the complete handler will be called
			// before this completes
			anim.always(function() {
				hooks.unqueued--;
				if ( !jQuery.queue( elem, "fx" ).length ) {
					hooks.empty.fire();
				}
			});
		});
	}

	// height/width overflow pass
	if ( elem.nodeType === 1 && ( "height" in props || "width" in props ) ) {
		// Make sure that nothing sneaks out
		// Record all 3 overflow attributes because IE9-10 do not
		// change the overflow attribute when overflowX and
		// overflowY are set to the same value
		opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];

		// Set display property to inline-block for height/width
		// animations on inline elements that are having width/height animated
		display = jQuery.css( elem, "display" );

		// Test default display if display is currently "none"
		checkDisplay = display === "none" ?
			data_priv.get( elem, "olddisplay" ) || defaultDisplay( elem.nodeName ) : display;

		if ( checkDisplay === "inline" && jQuery.css( elem, "float" ) === "none" ) {
			style.display = "inline-block";
		}
	}

	if ( opts.overflow ) {
		style.overflow = "hidden";
		anim.always(function() {
			style.overflow = opts.overflow[ 0 ];
			style.overflowX = opts.overflow[ 1 ];
			style.overflowY = opts.overflow[ 2 ];
		});
	}

	// show/hide pass
	for ( prop in props ) {
		value = props[ prop ];
		if ( rfxtypes.exec( value ) ) {
			delete props[ prop ];
			toggle = toggle || value === "toggle";
			if ( value === ( hidden ? "hide" : "show" ) ) {

				// If there is dataShow left over from a stopped hide or show and we are going to proceed with show, we should pretend to be hidden
				if ( value === "show" && dataShow && dataShow[ prop ] !== undefined ) {
					hidden = true;
				} else {
					continue;
				}
			}
			orig[ prop ] = dataShow && dataShow[ prop ] || jQuery.style( elem, prop );

		// Any non-fx value stops us from restoring the original display value
		} else {
			display = undefined;
		}
	}

	if ( !jQuery.isEmptyObject( orig ) ) {
		if ( dataShow ) {
			if ( "hidden" in dataShow ) {
				hidden = dataShow.hidden;
			}
		} else {
			dataShow = data_priv.access( elem, "fxshow", {} );
		}

		// store state if its toggle - enables .stop().toggle() to "reverse"
		if ( toggle ) {
			dataShow.hidden = !hidden;
		}
		if ( hidden ) {
			jQuery( elem ).show();
		} else {
			anim.done(function() {
				jQuery( elem ).hide();
			});
		}
		anim.done(function() {
			var prop;

			data_priv.remove( elem, "fxshow" );
			for ( prop in orig ) {
				jQuery.style( elem, prop, orig[ prop ] );
			}
		});
		for ( prop in orig ) {
			tween = createTween( hidden ? dataShow[ prop ] : 0, prop, anim );

			if ( !( prop in dataShow ) ) {
				dataShow[ prop ] = tween.start;
				if ( hidden ) {
					tween.end = tween.start;
					tween.start = prop === "width" || prop === "height" ? 1 : 0;
				}
			}
		}

	// If this is a noop like .hide().hide(), restore an overwritten display value
	} else if ( (display === "none" ? defaultDisplay( elem.nodeName ) : display) === "inline" ) {
		style.display = display;
	}
}

function propFilter( props, specialEasing ) {
	var index, name, easing, value, hooks;

	// camelCase, specialEasing and expand cssHook pass
	for ( index in props ) {
		name = jQuery.camelCase( index );
		easing = specialEasing[ name ];
		value = props[ index ];
		if ( jQuery.isArray( value ) ) {
			easing = value[ 1 ];
			value = props[ index ] = value[ 0 ];
		}

		if ( index !== name ) {
			props[ name ] = value;
			delete props[ index ];
		}

		hooks = jQuery.cssHooks[ name ];
		if ( hooks && "expand" in hooks ) {
			value = hooks.expand( value );
			delete props[ name ];

			// not quite $.extend, this wont overwrite keys already present.
			// also - reusing 'index' from above because we have the correct "name"
			for ( index in value ) {
				if ( !( index in props ) ) {
					props[ index ] = value[ index ];
					specialEasing[ index ] = easing;
				}
			}
		} else {
			specialEasing[ name ] = easing;
		}
	}
}

function Animation( elem, properties, options ) {
	var result,
		stopped,
		index = 0,
		length = animationPrefilters.length,
		deferred = jQuery.Deferred().always( function() {
			// don't match elem in the :animated selector
			delete tick.elem;
		}),
		tick = function() {
			if ( stopped ) {
				return false;
			}
			var currentTime = fxNow || createFxNow(),
				remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),
				// archaic crash bug won't allow us to use 1 - ( 0.5 || 0 ) (#12497)
				temp = remaining / animation.duration || 0,
				percent = 1 - temp,
				index = 0,
				length = animation.tweens.length;

			for ( ; index < length ; index++ ) {
				animation.tweens[ index ].run( percent );
			}

			deferred.notifyWith( elem, [ animation, percent, remaining ]);

			if ( percent < 1 && length ) {
				return remaining;
			} else {
				deferred.resolveWith( elem, [ animation ] );
				return false;
			}
		},
		animation = deferred.promise({
			elem: elem,
			props: jQuery.extend( {}, properties ),
			opts: jQuery.extend( true, { specialEasing: {} }, options ),
			originalProperties: properties,
			originalOptions: options,
			startTime: fxNow || createFxNow(),
			duration: options.duration,
			tweens: [],
			createTween: function( prop, end ) {
				var tween = jQuery.Tween( elem, animation.opts, prop, end,
						animation.opts.specialEasing[ prop ] || animation.opts.easing );
				animation.tweens.push( tween );
				return tween;
			},
			stop: function( gotoEnd ) {
				var index = 0,
					// if we are going to the end, we want to run all the tweens
					// otherwise we skip this part
					length = gotoEnd ? animation.tweens.length : 0;
				if ( stopped ) {
					return this;
				}
				stopped = true;
				for ( ; index < length ; index++ ) {
					animation.tweens[ index ].run( 1 );
				}

				// resolve when we played the last frame
				// otherwise, reject
				if ( gotoEnd ) {
					deferred.resolveWith( elem, [ animation, gotoEnd ] );
				} else {
					deferred.rejectWith( elem, [ animation, gotoEnd ] );
				}
				return this;
			}
		}),
		props = animation.props;

	propFilter( props, animation.opts.specialEasing );

	for ( ; index < length ; index++ ) {
		result = animationPrefilters[ index ].call( animation, elem, props, animation.opts );
		if ( result ) {
			return result;
		}
	}

	jQuery.map( props, createTween, animation );

	if ( jQuery.isFunction( animation.opts.start ) ) {
		animation.opts.start.call( elem, animation );
	}

	jQuery.fx.timer(
		jQuery.extend( tick, {
			elem: elem,
			anim: animation,
			queue: animation.opts.queue
		})
	);

	// attach callbacks from options
	return animation.progress( animation.opts.progress )
		.done( animation.opts.done, animation.opts.complete )
		.fail( animation.opts.fail )
		.always( animation.opts.always );
}

jQuery.Animation = jQuery.extend( Animation, {

	tweener: function( props, callback ) {
		if ( jQuery.isFunction( props ) ) {
			callback = props;
			props = [ "*" ];
		} else {
			props = props.split(" ");
		}

		var prop,
			index = 0,
			length = props.length;

		for ( ; index < length ; index++ ) {
			prop = props[ index ];
			tweeners[ prop ] = tweeners[ prop ] || [];
			tweeners[ prop ].unshift( callback );
		}
	},

	prefilter: function( callback, prepend ) {
		if ( prepend ) {
			animationPrefilters.unshift( callback );
		} else {
			animationPrefilters.push( callback );
		}
	}
});

jQuery.speed = function( speed, easing, fn ) {
	var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
		complete: fn || !fn && easing ||
			jQuery.isFunction( speed ) && speed,
		duration: speed,
		easing: fn && easing || easing && !jQuery.isFunction( easing ) && easing
	};

	opt.duration = jQuery.fx.off ? 0 : typeof opt.duration === "number" ? opt.duration :
		opt.duration in jQuery.fx.speeds ? jQuery.fx.speeds[ opt.duration ] : jQuery.fx.speeds._default;

	// normalize opt.queue - true/undefined/null -> "fx"
	if ( opt.queue == null || opt.queue === true ) {
		opt.queue = "fx";
	}

	// Queueing
	opt.old = opt.complete;

	opt.complete = function() {
		if ( jQuery.isFunction( opt.old ) ) {
			opt.old.call( this );
		}

		if ( opt.queue ) {
			jQuery.dequeue( this, opt.queue );
		}
	};

	return opt;
};

jQuery.fn.extend({
	fadeTo: function( speed, to, easing, callback ) {

		// show any hidden elements after setting opacity to 0
		return this.filter( isHidden ).css( "opacity", 0 ).show()

			// animate to the value specified
			.end().animate({ opacity: to }, speed, easing, callback );
	},
	animate: function( prop, speed, easing, callback ) {
		var empty = jQuery.isEmptyObject( prop ),
			optall = jQuery.speed( speed, easing, callback ),
			doAnimation = function() {
				// Operate on a copy of prop so per-property easing won't be lost
				var anim = Animation( this, jQuery.extend( {}, prop ), optall );

				// Empty animations, or finishing resolves immediately
				if ( empty || data_priv.get( this, "finish" ) ) {
					anim.stop( true );
				}
			};
			doAnimation.finish = doAnimation;

		return empty || optall.queue === false ?
			this.each( doAnimation ) :
			this.queue( optall.queue, doAnimation );
	},
	stop: function( type, clearQueue, gotoEnd ) {
		var stopQueue = function( hooks ) {
			var stop = hooks.stop;
			delete hooks.stop;
			stop( gotoEnd );
		};

		if ( typeof type !== "string" ) {
			gotoEnd = clearQueue;
			clearQueue = type;
			type = undefined;
		}
		if ( clearQueue && type !== false ) {
			this.queue( type || "fx", [] );
		}

		return this.each(function() {
			var dequeue = true,
				index = type != null && type + "queueHooks",
				timers = jQuery.timers,
				data = data_priv.get( this );

			if ( index ) {
				if ( data[ index ] && data[ index ].stop ) {
					stopQueue( data[ index ] );
				}
			} else {
				for ( index in data ) {
					if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
						stopQueue( data[ index ] );
					}
				}
			}

			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this && (type == null || timers[ index ].queue === type) ) {
					timers[ index ].anim.stop( gotoEnd );
					dequeue = false;
					timers.splice( index, 1 );
				}
			}

			// start the next in the queue if the last step wasn't forced
			// timers currently will call their complete callbacks, which will dequeue
			// but only if they were gotoEnd
			if ( dequeue || !gotoEnd ) {
				jQuery.dequeue( this, type );
			}
		});
	},
	finish: function( type ) {
		if ( type !== false ) {
			type = type || "fx";
		}
		return this.each(function() {
			var index,
				data = data_priv.get( this ),
				queue = data[ type + "queue" ],
				hooks = data[ type + "queueHooks" ],
				timers = jQuery.timers,
				length = queue ? queue.length : 0;

			// enable finishing flag on private data
			data.finish = true;

			// empty the queue first
			jQuery.queue( this, type, [] );

			if ( hooks && hooks.stop ) {
				hooks.stop.call( this, true );
			}

			// look for any active animations, and finish them
			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this && timers[ index ].queue === type ) {
					timers[ index ].anim.stop( true );
					timers.splice( index, 1 );
				}
			}

			// look for any animations in the old queue and finish them
			for ( index = 0; index < length; index++ ) {
				if ( queue[ index ] && queue[ index ].finish ) {
					queue[ index ].finish.call( this );
				}
			}

			// turn off finishing flag
			delete data.finish;
		});
	}
});

jQuery.each([ "toggle", "show", "hide" ], function( i, name ) {
	var cssFn = jQuery.fn[ name ];
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return speed == null || typeof speed === "boolean" ?
			cssFn.apply( this, arguments ) :
			this.animate( genFx( name, true ), speed, easing, callback );
	};
});

// Generate shortcuts for custom animations
jQuery.each({
	slideDown: genFx("show"),
	slideUp: genFx("hide"),
	slideToggle: genFx("toggle"),
	fadeIn: { opacity: "show" },
	fadeOut: { opacity: "hide" },
	fadeToggle: { opacity: "toggle" }
}, function( name, props ) {
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return this.animate( props, speed, easing, callback );
	};
});

jQuery.timers = [];
jQuery.fx.tick = function() {
	var timer,
		i = 0,
		timers = jQuery.timers;

	fxNow = jQuery.now();

	for ( ; i < timers.length; i++ ) {
		timer = timers[ i ];
		// Checks the timer has not already been removed
		if ( !timer() && timers[ i ] === timer ) {
			timers.splice( i--, 1 );
		}
	}

	if ( !timers.length ) {
		jQuery.fx.stop();
	}
	fxNow = undefined;
};

jQuery.fx.timer = function( timer ) {
	jQuery.timers.push( timer );
	if ( timer() ) {
		jQuery.fx.start();
	} else {
		jQuery.timers.pop();
	}
};

jQuery.fx.interval = 13;

jQuery.fx.start = function() {
	if ( !timerId ) {
		timerId = setInterval( jQuery.fx.tick, jQuery.fx.interval );
	}
};

jQuery.fx.stop = function() {
	clearInterval( timerId );
	timerId = null;
};

jQuery.fx.speeds = {
	slow: 600,
	fast: 200,
	// Default speed
	_default: 400
};


// Based off of the plugin by Clint Helfers, with permission.
// http://blindsignals.com/index.php/2009/07/jquery-delay/
jQuery.fn.delay = function( time, type ) {
	time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
	type = type || "fx";

	return this.queue( type, function( next, hooks ) {
		var timeout = setTimeout( next, time );
		hooks.stop = function() {
			clearTimeout( timeout );
		};
	});
};


(function() {
	var input = document.createElement( "input" ),
		select = document.createElement( "select" ),
		opt = select.appendChild( document.createElement( "option" ) );

	input.type = "checkbox";

	// Support: iOS 5.1, Android 4.x, Android 2.3
	// Check the default checkbox/radio value ("" on old WebKit; "on" elsewhere)
	support.checkOn = input.value !== "";

	// Must access the parent to make an option select properly
	// Support: IE9, IE10
	support.optSelected = opt.selected;

	// Make sure that the options inside disabled selects aren't marked as disabled
	// (WebKit marks them as disabled)
	select.disabled = true;
	support.optDisabled = !opt.disabled;

	// Check if an input maintains its value after becoming a radio
	// Support: IE9, IE10
	input = document.createElement( "input" );
	input.value = "t";
	input.type = "radio";
	support.radioValue = input.value === "t";
})();


var nodeHook, boolHook,
	attrHandle = jQuery.expr.attrHandle;

jQuery.fn.extend({
	attr: function( name, value ) {
		return access( this, jQuery.attr, name, value, arguments.length > 1 );
	},

	removeAttr: function( name ) {
		return this.each(function() {
			jQuery.removeAttr( this, name );
		});
	}
});

jQuery.extend({
	attr: function( elem, name, value ) {
		var hooks, ret,
			nType = elem.nodeType;

		// don't get/set attributes on text, comment and attribute nodes
		if ( !elem || nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		// Fallback to prop when attributes are not supported
		if ( typeof elem.getAttribute === strundefined ) {
			return jQuery.prop( elem, name, value );
		}

		// All attributes are lowercase
		// Grab necessary hook if one is defined
		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
			name = name.toLowerCase();
			hooks = jQuery.attrHooks[ name ] ||
				( jQuery.expr.match.bool.test( name ) ? boolHook : nodeHook );
		}

		if ( value !== undefined ) {

			if ( value === null ) {
				jQuery.removeAttr( elem, name );

			} else if ( hooks && "set" in hooks && (ret = hooks.set( elem, value, name )) !== undefined ) {
				return ret;

			} else {
				elem.setAttribute( name, value + "" );
				return value;
			}

		} else if ( hooks && "get" in hooks && (ret = hooks.get( elem, name )) !== null ) {
			return ret;

		} else {
			ret = jQuery.find.attr( elem, name );

			// Non-existent attributes return null, we normalize to undefined
			return ret == null ?
				undefined :
				ret;
		}
	},

	removeAttr: function( elem, value ) {
		var name, propName,
			i = 0,
			attrNames = value && value.match( rnotwhite );

		if ( attrNames && elem.nodeType === 1 ) {
			while ( (name = attrNames[i++]) ) {
				propName = jQuery.propFix[ name ] || name;

				// Boolean attributes get special treatment (#10870)
				if ( jQuery.expr.match.bool.test( name ) ) {
					// Set corresponding property to false
					elem[ propName ] = false;
				}

				elem.removeAttribute( name );
			}
		}
	},

	attrHooks: {
		type: {
			set: function( elem, value ) {
				if ( !support.radioValue && value === "radio" &&
					jQuery.nodeName( elem, "input" ) ) {
					// Setting the type on a radio button after the value resets the value in IE6-9
					// Reset value to default in case type is set after value during creation
					var val = elem.value;
					elem.setAttribute( "type", value );
					if ( val ) {
						elem.value = val;
					}
					return value;
				}
			}
		}
	}
});

// Hooks for boolean attributes
boolHook = {
	set: function( elem, value, name ) {
		if ( value === false ) {
			// Remove boolean attributes when set to false
			jQuery.removeAttr( elem, name );
		} else {
			elem.setAttribute( name, name );
		}
		return name;
	}
};
jQuery.each( jQuery.expr.match.bool.source.match( /\w+/g ), function( i, name ) {
	var getter = attrHandle[ name ] || jQuery.find.attr;

	attrHandle[ name ] = function( elem, name, isXML ) {
		var ret, handle;
		if ( !isXML ) {
			// Avoid an infinite loop by temporarily removing this function from the getter
			handle = attrHandle[ name ];
			attrHandle[ name ] = ret;
			ret = getter( elem, name, isXML ) != null ?
				name.toLowerCase() :
				null;
			attrHandle[ name ] = handle;
		}
		return ret;
	};
});




var rfocusable = /^(?:input|select|textarea|button)$/i;

jQuery.fn.extend({
	prop: function( name, value ) {
		return access( this, jQuery.prop, name, value, arguments.length > 1 );
	},

	removeProp: function( name ) {
		return this.each(function() {
			delete this[ jQuery.propFix[ name ] || name ];
		});
	}
});

jQuery.extend({
	propFix: {
		"for": "htmlFor",
		"class": "className"
	},

	prop: function( elem, name, value ) {
		var ret, hooks, notxml,
			nType = elem.nodeType;

		// don't get/set properties on text, comment and attribute nodes
		if ( !elem || nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		notxml = nType !== 1 || !jQuery.isXMLDoc( elem );

		if ( notxml ) {
			// Fix name and attach hooks
			name = jQuery.propFix[ name ] || name;
			hooks = jQuery.propHooks[ name ];
		}

		if ( value !== undefined ) {
			return hooks && "set" in hooks && (ret = hooks.set( elem, value, name )) !== undefined ?
				ret :
				( elem[ name ] = value );

		} else {
			return hooks && "get" in hooks && (ret = hooks.get( elem, name )) !== null ?
				ret :
				elem[ name ];
		}
	},

	propHooks: {
		tabIndex: {
			get: function( elem ) {
				return elem.hasAttribute( "tabindex" ) || rfocusable.test( elem.nodeName ) || elem.href ?
					elem.tabIndex :
					-1;
			}
		}
	}
});

// Support: IE9+
// Selectedness for an option in an optgroup can be inaccurate
if ( !support.optSelected ) {
	jQuery.propHooks.selected = {
		get: function( elem ) {
			var parent = elem.parentNode;
			if ( parent && parent.parentNode ) {
				parent.parentNode.selectedIndex;
			}
			return null;
		}
	};
}

jQuery.each([
	"tabIndex",
	"readOnly",
	"maxLength",
	"cellSpacing",
	"cellPadding",
	"rowSpan",
	"colSpan",
	"useMap",
	"frameBorder",
	"contentEditable"
], function() {
	jQuery.propFix[ this.toLowerCase() ] = this;
});




var rclass = /[\t\r\n\f]/g;

jQuery.fn.extend({
	addClass: function( value ) {
		var classes, elem, cur, clazz, j, finalValue,
			proceed = typeof value === "string" && value,
			i = 0,
			len = this.length;

		if ( jQuery.isFunction( value ) ) {
			return this.each(function( j ) {
				jQuery( this ).addClass( value.call( this, j, this.className ) );
			});
		}

		if ( proceed ) {
			// The disjunction here is for better compressibility (see removeClass)
			classes = ( value || "" ).match( rnotwhite ) || [];

			for ( ; i < len; i++ ) {
				elem = this[ i ];
				cur = elem.nodeType === 1 && ( elem.className ?
					( " " + elem.className + " " ).replace( rclass, " " ) :
					" "
				);

				if ( cur ) {
					j = 0;
					while ( (clazz = classes[j++]) ) {
						if ( cur.indexOf( " " + clazz + " " ) < 0 ) {
							cur += clazz + " ";
						}
					}

					// only assign if different to avoid unneeded rendering.
					finalValue = jQuery.trim( cur );
					if ( elem.className !== finalValue ) {
						elem.className = finalValue;
					}
				}
			}
		}

		return this;
	},

	removeClass: function( value ) {
		var classes, elem, cur, clazz, j, finalValue,
			proceed = arguments.length === 0 || typeof value === "string" && value,
			i = 0,
			len = this.length;

		if ( jQuery.isFunction( value ) ) {
			return this.each(function( j ) {
				jQuery( this ).removeClass( value.call( this, j, this.className ) );
			});
		}
		if ( proceed ) {
			classes = ( value || "" ).match( rnotwhite ) || [];

			for ( ; i < len; i++ ) {
				elem = this[ i ];
				// This expression is here for better compressibility (see addClass)
				cur = elem.nodeType === 1 && ( elem.className ?
					( " " + elem.className + " " ).replace( rclass, " " ) :
					""
				);

				if ( cur ) {
					j = 0;
					while ( (clazz = classes[j++]) ) {
						// Remove *all* instances
						while ( cur.indexOf( " " + clazz + " " ) >= 0 ) {
							cur = cur.replace( " " + clazz + " ", " " );
						}
					}

					// only assign if different to avoid unneeded rendering.
					finalValue = value ? jQuery.trim( cur ) : "";
					if ( elem.className !== finalValue ) {
						elem.className = finalValue;
					}
				}
			}
		}

		return this;
	},

	toggleClass: function( value, stateVal ) {
		var type = typeof value;

		if ( typeof stateVal === "boolean" && type === "string" ) {
			return stateVal ? this.addClass( value ) : this.removeClass( value );
		}

		if ( jQuery.isFunction( value ) ) {
			return this.each(function( i ) {
				jQuery( this ).toggleClass( value.call(this, i, this.className, stateVal), stateVal );
			});
		}

		return this.each(function() {
			if ( type === "string" ) {
				// toggle individual class names
				var className,
					i = 0,
					self = jQuery( this ),
					classNames = value.match( rnotwhite ) || [];

				while ( (className = classNames[ i++ ]) ) {
					// check each className given, space separated list
					if ( self.hasClass( className ) ) {
						self.removeClass( className );
					} else {
						self.addClass( className );
					}
				}

			// Toggle whole class name
			} else if ( type === strundefined || type === "boolean" ) {
				if ( this.className ) {
					// store className if set
					data_priv.set( this, "__className__", this.className );
				}

				// If the element has a class name or if we're passed "false",
				// then remove the whole classname (if there was one, the above saved it).
				// Otherwise bring back whatever was previously saved (if anything),
				// falling back to the empty string if nothing was stored.
				this.className = this.className || value === false ? "" : data_priv.get( this, "__className__" ) || "";
			}
		});
	},

	hasClass: function( selector ) {
		var className = " " + selector + " ",
			i = 0,
			l = this.length;
		for ( ; i < l; i++ ) {
			if ( this[i].nodeType === 1 && (" " + this[i].className + " ").replace(rclass, " ").indexOf( className ) >= 0 ) {
				return true;
			}
		}

		return false;
	}
});




var rreturn = /\r/g;

jQuery.fn.extend({
	val: function( value ) {
		var hooks, ret, isFunction,
			elem = this[0];

		if ( !arguments.length ) {
			if ( elem ) {
				hooks = jQuery.valHooks[ elem.type ] || jQuery.valHooks[ elem.nodeName.toLowerCase() ];

				if ( hooks && "get" in hooks && (ret = hooks.get( elem, "value" )) !== undefined ) {
					return ret;
				}

				ret = elem.value;

				return typeof ret === "string" ?
					// handle most common string cases
					ret.replace(rreturn, "") :
					// handle cases where value is null/undef or number
					ret == null ? "" : ret;
			}

			return;
		}

		isFunction = jQuery.isFunction( value );

		return this.each(function( i ) {
			var val;

			if ( this.nodeType !== 1 ) {
				return;
			}

			if ( isFunction ) {
				val = value.call( this, i, jQuery( this ).val() );
			} else {
				val = value;
			}

			// Treat null/undefined as ""; convert numbers to string
			if ( val == null ) {
				val = "";

			} else if ( typeof val === "number" ) {
				val += "";

			} else if ( jQuery.isArray( val ) ) {
				val = jQuery.map( val, function( value ) {
					return value == null ? "" : value + "";
				});
			}

			hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

			// If set returns undefined, fall back to normal setting
			if ( !hooks || !("set" in hooks) || hooks.set( this, val, "value" ) === undefined ) {
				this.value = val;
			}
		});
	}
});

jQuery.extend({
	valHooks: {
		option: {
			get: function( elem ) {
				var val = jQuery.find.attr( elem, "value" );
				return val != null ?
					val :
					// Support: IE10-11+
					// option.text throws exceptions (#14686, #14858)
					jQuery.trim( jQuery.text( elem ) );
			}
		},
		select: {
			get: function( elem ) {
				var value, option,
					options = elem.options,
					index = elem.selectedIndex,
					one = elem.type === "select-one" || index < 0,
					values = one ? null : [],
					max = one ? index + 1 : options.length,
					i = index < 0 ?
						max :
						one ? index : 0;

				// Loop through all the selected options
				for ( ; i < max; i++ ) {
					option = options[ i ];

					// IE6-9 doesn't update selected after form reset (#2551)
					if ( ( option.selected || i === index ) &&
							// Don't return options that are disabled or in a disabled optgroup
							( support.optDisabled ? !option.disabled : option.getAttribute( "disabled" ) === null ) &&
							( !option.parentNode.disabled || !jQuery.nodeName( option.parentNode, "optgroup" ) ) ) {

						// Get the specific value for the option
						value = jQuery( option ).val();

						// We don't need an array for one selects
						if ( one ) {
							return value;
						}

						// Multi-Selects return an array
						values.push( value );
					}
				}

				return values;
			},

			set: function( elem, value ) {
				var optionSet, option,
					options = elem.options,
					values = jQuery.makeArray( value ),
					i = options.length;

				while ( i-- ) {
					option = options[ i ];
					if ( (option.selected = jQuery.inArray( option.value, values ) >= 0) ) {
						optionSet = true;
					}
				}

				// force browsers to behave consistently when non-matching value is set
				if ( !optionSet ) {
					elem.selectedIndex = -1;
				}
				return values;
			}
		}
	}
});

// Radios and checkboxes getter/setter
jQuery.each([ "radio", "checkbox" ], function() {
	jQuery.valHooks[ this ] = {
		set: function( elem, value ) {
			if ( jQuery.isArray( value ) ) {
				return ( elem.checked = jQuery.inArray( jQuery(elem).val(), value ) >= 0 );
			}
		}
	};
	if ( !support.checkOn ) {
		jQuery.valHooks[ this ].get = function( elem ) {
			// Support: Webkit
			// "" is returned instead of "on" if a value isn't specified
			return elem.getAttribute("value") === null ? "on" : elem.value;
		};
	}
});




// Return jQuery for attributes-only inclusion


jQuery.each( ("blur focus focusin focusout load resize scroll unload click dblclick " +
	"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
	"change select submit keydown keypress keyup error contextmenu").split(" "), function( i, name ) {

	// Handle event binding
	jQuery.fn[ name ] = function( data, fn ) {
		return arguments.length > 0 ?
			this.on( name, null, data, fn ) :
			this.trigger( name );
	};
});

jQuery.fn.extend({
	hover: function( fnOver, fnOut ) {
		return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
	},

	bind: function( types, data, fn ) {
		return this.on( types, null, data, fn );
	},
	unbind: function( types, fn ) {
		return this.off( types, null, fn );
	},

	delegate: function( selector, types, data, fn ) {
		return this.on( types, selector, data, fn );
	},
	undelegate: function( selector, types, fn ) {
		// ( namespace ) or ( selector, types [, fn] )
		return arguments.length === 1 ? this.off( selector, "**" ) : this.off( types, selector || "**", fn );
	}
});


var nonce = jQuery.now();

var rquery = (/\?/);



// Support: Android 2.3
// Workaround failure to string-cast null input
jQuery.parseJSON = function( data ) {
	return JSON.parse( data + "" );
};


// Cross-browser xml parsing
jQuery.parseXML = function( data ) {
	var xml, tmp;
	if ( !data || typeof data !== "string" ) {
		return null;
	}

	// Support: IE9
	try {
		tmp = new DOMParser();
		xml = tmp.parseFromString( data, "text/xml" );
	} catch ( e ) {
		xml = undefined;
	}

	if ( !xml || xml.getElementsByTagName( "parsererror" ).length ) {
		jQuery.error( "Invalid XML: " + data );
	}
	return xml;
};


var
	// Document location
	ajaxLocParts,
	ajaxLocation,

	rhash = /#.*$/,
	rts = /([?&])_=[^&]*/,
	rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg,
	// #7653, #8125, #8152: local protocol detection
	rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
	rnoContent = /^(?:GET|HEAD)$/,
	rprotocol = /^\/\//,
	rurl = /^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/,

	/* Prefilters
	 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
	 * 2) These are called:
	 *    - BEFORE asking for a transport
	 *    - AFTER param serialization (s.data is a string if s.processData is true)
	 * 3) key is the dataType
	 * 4) the catchall symbol "*" can be used
	 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
	 */
	prefilters = {},

	/* Transports bindings
	 * 1) key is the dataType
	 * 2) the catchall symbol "*" can be used
	 * 3) selection will start with transport dataType and THEN go to "*" if needed
	 */
	transports = {},

	// Avoid comment-prolog char sequence (#10098); must appease lint and evade compression
	allTypes = "*/".concat("*");

// #8138, IE may throw an exception when accessing
// a field from window.location if document.domain has been set
try {
	ajaxLocation = location.href;
} catch( e ) {
	// Use the href attribute of an A element
	// since IE will modify it given document.location
	ajaxLocation = document.createElement( "a" );
	ajaxLocation.href = "";
	ajaxLocation = ajaxLocation.href;
}

// Segment location into parts
ajaxLocParts = rurl.exec( ajaxLocation.toLowerCase() ) || [];

// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
function addToPrefiltersOrTransports( structure ) {

	// dataTypeExpression is optional and defaults to "*"
	return function( dataTypeExpression, func ) {

		if ( typeof dataTypeExpression !== "string" ) {
			func = dataTypeExpression;
			dataTypeExpression = "*";
		}

		var dataType,
			i = 0,
			dataTypes = dataTypeExpression.toLowerCase().match( rnotwhite ) || [];

		if ( jQuery.isFunction( func ) ) {
			// For each dataType in the dataTypeExpression
			while ( (dataType = dataTypes[i++]) ) {
				// Prepend if requested
				if ( dataType[0] === "+" ) {
					dataType = dataType.slice( 1 ) || "*";
					(structure[ dataType ] = structure[ dataType ] || []).unshift( func );

				// Otherwise append
				} else {
					(structure[ dataType ] = structure[ dataType ] || []).push( func );
				}
			}
		}
	};
}

// Base inspection function for prefilters and transports
function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR ) {

	var inspected = {},
		seekingTransport = ( structure === transports );

	function inspect( dataType ) {
		var selected;
		inspected[ dataType ] = true;
		jQuery.each( structure[ dataType ] || [], function( _, prefilterOrFactory ) {
			var dataTypeOrTransport = prefilterOrFactory( options, originalOptions, jqXHR );
			if ( typeof dataTypeOrTransport === "string" && !seekingTransport && !inspected[ dataTypeOrTransport ] ) {
				options.dataTypes.unshift( dataTypeOrTransport );
				inspect( dataTypeOrTransport );
				return false;
			} else if ( seekingTransport ) {
				return !( selected = dataTypeOrTransport );
			}
		});
		return selected;
	}

	return inspect( options.dataTypes[ 0 ] ) || !inspected[ "*" ] && inspect( "*" );
}

// A special extend for ajax options
// that takes "flat" options (not to be deep extended)
// Fixes #9887
function ajaxExtend( target, src ) {
	var key, deep,
		flatOptions = jQuery.ajaxSettings.flatOptions || {};

	for ( key in src ) {
		if ( src[ key ] !== undefined ) {
			( flatOptions[ key ] ? target : ( deep || (deep = {}) ) )[ key ] = src[ key ];
		}
	}
	if ( deep ) {
		jQuery.extend( true, target, deep );
	}

	return target;
}

/* Handles responses to an ajax request:
 * - finds the right dataType (mediates between content-type and expected dataType)
 * - returns the corresponding response
 */
function ajaxHandleResponses( s, jqXHR, responses ) {

	var ct, type, finalDataType, firstDataType,
		contents = s.contents,
		dataTypes = s.dataTypes;

	// Remove auto dataType and get content-type in the process
	while ( dataTypes[ 0 ] === "*" ) {
		dataTypes.shift();
		if ( ct === undefined ) {
			ct = s.mimeType || jqXHR.getResponseHeader("Content-Type");
		}
	}

	// Check if we're dealing with a known content-type
	if ( ct ) {
		for ( type in contents ) {
			if ( contents[ type ] && contents[ type ].test( ct ) ) {
				dataTypes.unshift( type );
				break;
			}
		}
	}

	// Check to see if we have a response for the expected dataType
	if ( dataTypes[ 0 ] in responses ) {
		finalDataType = dataTypes[ 0 ];
	} else {
		// Try convertible dataTypes
		for ( type in responses ) {
			if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[0] ] ) {
				finalDataType = type;
				break;
			}
			if ( !firstDataType ) {
				firstDataType = type;
			}
		}
		// Or just use first one
		finalDataType = finalDataType || firstDataType;
	}

	// If we found a dataType
	// We add the dataType to the list if needed
	// and return the corresponding response
	if ( finalDataType ) {
		if ( finalDataType !== dataTypes[ 0 ] ) {
			dataTypes.unshift( finalDataType );
		}
		return responses[ finalDataType ];
	}
}

/* Chain conversions given the request and the original response
 * Also sets the responseXXX fields on the jqXHR instance
 */
function ajaxConvert( s, response, jqXHR, isSuccess ) {
	var conv2, current, conv, tmp, prev,
		converters = {},
		// Work with a copy of dataTypes in case we need to modify it for conversion
		dataTypes = s.dataTypes.slice();

	// Create converters map with lowercased keys
	if ( dataTypes[ 1 ] ) {
		for ( conv in s.converters ) {
			converters[ conv.toLowerCase() ] = s.converters[ conv ];
		}
	}

	current = dataTypes.shift();

	// Convert to each sequential dataType
	while ( current ) {

		if ( s.responseFields[ current ] ) {
			jqXHR[ s.responseFields[ current ] ] = response;
		}

		// Apply the dataFilter if provided
		if ( !prev && isSuccess && s.dataFilter ) {
			response = s.dataFilter( response, s.dataType );
		}

		prev = current;
		current = dataTypes.shift();

		if ( current ) {

		// There's only work to do if current dataType is non-auto
			if ( current === "*" ) {

				current = prev;

			// Convert response if prev dataType is non-auto and differs from current
			} else if ( prev !== "*" && prev !== current ) {

				// Seek a direct converter
				conv = converters[ prev + " " + current ] || converters[ "* " + current ];

				// If none found, seek a pair
				if ( !conv ) {
					for ( conv2 in converters ) {

						// If conv2 outputs current
						tmp = conv2.split( " " );
						if ( tmp[ 1 ] === current ) {

							// If prev can be converted to accepted input
							conv = converters[ prev + " " + tmp[ 0 ] ] ||
								converters[ "* " + tmp[ 0 ] ];
							if ( conv ) {
								// Condense equivalence converters
								if ( conv === true ) {
									conv = converters[ conv2 ];

								// Otherwise, insert the intermediate dataType
								} else if ( converters[ conv2 ] !== true ) {
									current = tmp[ 0 ];
									dataTypes.unshift( tmp[ 1 ] );
								}
								break;
							}
						}
					}
				}

				// Apply converter (if not an equivalence)
				if ( conv !== true ) {

					// Unless errors are allowed to bubble, catch and return them
					if ( conv && s[ "throws" ] ) {
						response = conv( response );
					} else {
						try {
							response = conv( response );
						} catch ( e ) {
							return { state: "parsererror", error: conv ? e : "No conversion from " + prev + " to " + current };
						}
					}
				}
			}
		}
	}

	return { state: "success", data: response };
}

jQuery.extend({

	// Counter for holding the number of active queries
	active: 0,

	// Last-Modified header cache for next request
	lastModified: {},
	etag: {},

	ajaxSettings: {
		url: ajaxLocation,
		type: "GET",
		isLocal: rlocalProtocol.test( ajaxLocParts[ 1 ] ),
		global: true,
		processData: true,
		async: true,
		contentType: "application/x-www-form-urlencoded; charset=UTF-8",
		/*
		timeout: 0,
		data: null,
		dataType: null,
		username: null,
		password: null,
		cache: null,
		throws: false,
		traditional: false,
		headers: {},
		*/

		accepts: {
			"*": allTypes,
			text: "text/plain",
			html: "text/html",
			xml: "application/xml, text/xml",
			json: "application/json, text/javascript"
		},

		contents: {
			xml: /xml/,
			html: /html/,
			json: /json/
		},

		responseFields: {
			xml: "responseXML",
			text: "responseText",
			json: "responseJSON"
		},

		// Data converters
		// Keys separate source (or catchall "*") and destination types with a single space
		converters: {

			// Convert anything to text
			"* text": String,

			// Text to html (true = no transformation)
			"text html": true,

			// Evaluate text as a json expression
			"text json": jQuery.parseJSON,

			// Parse text as xml
			"text xml": jQuery.parseXML
		},

		// For options that shouldn't be deep extended:
		// you can add your own custom options here if
		// and when you create one that shouldn't be
		// deep extended (see ajaxExtend)
		flatOptions: {
			url: true,
			context: true
		}
	},

	// Creates a full fledged settings object into target
	// with both ajaxSettings and settings fields.
	// If target is omitted, writes into ajaxSettings.
	ajaxSetup: function( target, settings ) {
		return settings ?

			// Building a settings object
			ajaxExtend( ajaxExtend( target, jQuery.ajaxSettings ), settings ) :

			// Extending ajaxSettings
			ajaxExtend( jQuery.ajaxSettings, target );
	},

	ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
	ajaxTransport: addToPrefiltersOrTransports( transports ),

	// Main method
	ajax: function( url, options ) {

		// If url is an object, simulate pre-1.5 signature
		if ( typeof url === "object" ) {
			options = url;
			url = undefined;
		}

		// Force options to be an object
		options = options || {};

		var transport,
			// URL without anti-cache param
			cacheURL,
			// Response headers
			responseHeadersString,
			responseHeaders,
			// timeout handle
			timeoutTimer,
			// Cross-domain detection vars
			parts,
			// To know if global events are to be dispatched
			fireGlobals,
			// Loop variable
			i,
			// Create the final options object
			s = jQuery.ajaxSetup( {}, options ),
			// Callbacks context
			callbackContext = s.context || s,
			// Context for global events is callbackContext if it is a DOM node or jQuery collection
			globalEventContext = s.context && ( callbackContext.nodeType || callbackContext.jquery ) ?
				jQuery( callbackContext ) :
				jQuery.event,
			// Deferreds
			deferred = jQuery.Deferred(),
			completeDeferred = jQuery.Callbacks("once memory"),
			// Status-dependent callbacks
			statusCode = s.statusCode || {},
			// Headers (they are sent all at once)
			requestHeaders = {},
			requestHeadersNames = {},
			// The jqXHR state
			state = 0,
			// Default abort message
			strAbort = "canceled",
			// Fake xhr
			jqXHR = {
				readyState: 0,

				// Builds headers hashtable if needed
				getResponseHeader: function( key ) {
					var match;
					if ( state === 2 ) {
						if ( !responseHeaders ) {
							responseHeaders = {};
							while ( (match = rheaders.exec( responseHeadersString )) ) {
								responseHeaders[ match[1].toLowerCase() ] = match[ 2 ];
							}
						}
						match = responseHeaders[ key.toLowerCase() ];
					}
					return match == null ? null : match;
				},

				// Raw string
				getAllResponseHeaders: function() {
					return state === 2 ? responseHeadersString : null;
				},

				// Caches the header
				setRequestHeader: function( name, value ) {
					var lname = name.toLowerCase();
					if ( !state ) {
						name = requestHeadersNames[ lname ] = requestHeadersNames[ lname ] || name;
						requestHeaders[ name ] = value;
					}
					return this;
				},

				// Overrides response content-type header
				overrideMimeType: function( type ) {
					if ( !state ) {
						s.mimeType = type;
					}
					return this;
				},

				// Status-dependent callbacks
				statusCode: function( map ) {
					var code;
					if ( map ) {
						if ( state < 2 ) {
							for ( code in map ) {
								// Lazy-add the new callback in a way that preserves old ones
								statusCode[ code ] = [ statusCode[ code ], map[ code ] ];
							}
						} else {
							// Execute the appropriate callbacks
							jqXHR.always( map[ jqXHR.status ] );
						}
					}
					return this;
				},

				// Cancel the request
				abort: function( statusText ) {
					var finalText = statusText || strAbort;
					if ( transport ) {
						transport.abort( finalText );
					}
					done( 0, finalText );
					return this;
				}
			};

		// Attach deferreds
		deferred.promise( jqXHR ).complete = completeDeferred.add;
		jqXHR.success = jqXHR.done;
		jqXHR.error = jqXHR.fail;

		// Remove hash character (#7531: and string promotion)
		// Add protocol if not provided (prefilters might expect it)
		// Handle falsy url in the settings object (#10093: consistency with old signature)
		// We also use the url parameter if available
		s.url = ( ( url || s.url || ajaxLocation ) + "" ).replace( rhash, "" )
			.replace( rprotocol, ajaxLocParts[ 1 ] + "//" );

		// Alias method option to type as per ticket #12004
		s.type = options.method || options.type || s.method || s.type;

		// Extract dataTypes list
		s.dataTypes = jQuery.trim( s.dataType || "*" ).toLowerCase().match( rnotwhite ) || [ "" ];

		// A cross-domain request is in order when we have a protocol:host:port mismatch
		if ( s.crossDomain == null ) {
			parts = rurl.exec( s.url.toLowerCase() );
			s.crossDomain = !!( parts &&
				( parts[ 1 ] !== ajaxLocParts[ 1 ] || parts[ 2 ] !== ajaxLocParts[ 2 ] ||
					( parts[ 3 ] || ( parts[ 1 ] === "http:" ? "80" : "443" ) ) !==
						( ajaxLocParts[ 3 ] || ( ajaxLocParts[ 1 ] === "http:" ? "80" : "443" ) ) )
			);
		}

		// Convert data if not already a string
		if ( s.data && s.processData && typeof s.data !== "string" ) {
			s.data = jQuery.param( s.data, s.traditional );
		}

		// Apply prefilters
		inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

		// If request was aborted inside a prefilter, stop there
		if ( state === 2 ) {
			return jqXHR;
		}

		// We can fire global events as of now if asked to
		fireGlobals = s.global;

		// Watch for a new set of requests
		if ( fireGlobals && jQuery.active++ === 0 ) {
			jQuery.event.trigger("ajaxStart");
		}

		// Uppercase the type
		s.type = s.type.toUpperCase();

		// Determine if request has content
		s.hasContent = !rnoContent.test( s.type );

		// Save the URL in case we're toying with the If-Modified-Since
		// and/or If-None-Match header later on
		cacheURL = s.url;

		// More options handling for requests with no content
		if ( !s.hasContent ) {

			// If data is available, append data to url
			if ( s.data ) {
				cacheURL = ( s.url += ( rquery.test( cacheURL ) ? "&" : "?" ) + s.data );
				// #9682: remove data so that it's not used in an eventual retry
				delete s.data;
			}

			// Add anti-cache in url if needed
			if ( s.cache === false ) {
				s.url = rts.test( cacheURL ) ?

					// If there is already a '_' parameter, set its value
					cacheURL.replace( rts, "$1_=" + nonce++ ) :

					// Otherwise add one to the end
					cacheURL + ( rquery.test( cacheURL ) ? "&" : "?" ) + "_=" + nonce++;
			}
		}

		// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
		if ( s.ifModified ) {
			if ( jQuery.lastModified[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ cacheURL ] );
			}
			if ( jQuery.etag[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ cacheURL ] );
			}
		}

		// Set the correct header, if data is being sent
		if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
			jqXHR.setRequestHeader( "Content-Type", s.contentType );
		}

		// Set the Accepts header for the server, depending on the dataType
		jqXHR.setRequestHeader(
			"Accept",
			s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[0] ] ?
				s.accepts[ s.dataTypes[0] ] + ( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
				s.accepts[ "*" ]
		);

		// Check for headers option
		for ( i in s.headers ) {
			jqXHR.setRequestHeader( i, s.headers[ i ] );
		}

		// Allow custom headers/mimetypes and early abort
		if ( s.beforeSend && ( s.beforeSend.call( callbackContext, jqXHR, s ) === false || state === 2 ) ) {
			// Abort if not done already and return
			return jqXHR.abort();
		}

		// aborting is no longer a cancellation
		strAbort = "abort";

		// Install callbacks on deferreds
		for ( i in { success: 1, error: 1, complete: 1 } ) {
			jqXHR[ i ]( s[ i ] );
		}

		// Get transport
		transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

		// If no transport, we auto-abort
		if ( !transport ) {
			done( -1, "No Transport" );
		} else {
			jqXHR.readyState = 1;

			// Send global event
			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
			}
			// Timeout
			if ( s.async && s.timeout > 0 ) {
				timeoutTimer = setTimeout(function() {
					jqXHR.abort("timeout");
				}, s.timeout );
			}

			try {
				state = 1;
				transport.send( requestHeaders, done );
			} catch ( e ) {
				// Propagate exception as error if not done
				if ( state < 2 ) {
					done( -1, e );
				// Simply rethrow otherwise
				} else {
					throw e;
				}
			}
		}

		// Callback for when everything is done
		function done( status, nativeStatusText, responses, headers ) {
			var isSuccess, success, error, response, modified,
				statusText = nativeStatusText;

			// Called once
			if ( state === 2 ) {
				return;
			}

			// State is "done" now
			state = 2;

			// Clear timeout if it exists
			if ( timeoutTimer ) {
				clearTimeout( timeoutTimer );
			}

			// Dereference transport for early garbage collection
			// (no matter how long the jqXHR object will be used)
			transport = undefined;

			// Cache response headers
			responseHeadersString = headers || "";

			// Set readyState
			jqXHR.readyState = status > 0 ? 4 : 0;

			// Determine if successful
			isSuccess = status >= 200 && status < 300 || status === 304;

			// Get response data
			if ( responses ) {
				response = ajaxHandleResponses( s, jqXHR, responses );
			}

			// Convert no matter what (that way responseXXX fields are always set)
			response = ajaxConvert( s, response, jqXHR, isSuccess );

			// If successful, handle type chaining
			if ( isSuccess ) {

				// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
				if ( s.ifModified ) {
					modified = jqXHR.getResponseHeader("Last-Modified");
					if ( modified ) {
						jQuery.lastModified[ cacheURL ] = modified;
					}
					modified = jqXHR.getResponseHeader("etag");
					if ( modified ) {
						jQuery.etag[ cacheURL ] = modified;
					}
				}

				// if no content
				if ( status === 204 || s.type === "HEAD" ) {
					statusText = "nocontent";

				// if not modified
				} else if ( status === 304 ) {
					statusText = "notmodified";

				// If we have data, let's convert it
				} else {
					statusText = response.state;
					success = response.data;
					error = response.error;
					isSuccess = !error;
				}
			} else {
				// We extract error from statusText
				// then normalize statusText and status for non-aborts
				error = statusText;
				if ( status || !statusText ) {
					statusText = "error";
					if ( status < 0 ) {
						status = 0;
					}
				}
			}

			// Set data for the fake xhr object
			jqXHR.status = status;
			jqXHR.statusText = ( nativeStatusText || statusText ) + "";

			// Success/Error
			if ( isSuccess ) {
				deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
			} else {
				deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
			}

			// Status-dependent callbacks
			jqXHR.statusCode( statusCode );
			statusCode = undefined;

			if ( fireGlobals ) {
				globalEventContext.trigger( isSuccess ? "ajaxSuccess" : "ajaxError",
					[ jqXHR, s, isSuccess ? success : error ] );
			}

			// Complete
			completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );
				// Handle the global AJAX counter
				if ( !( --jQuery.active ) ) {
					jQuery.event.trigger("ajaxStop");
				}
			}
		}

		return jqXHR;
	},

	getJSON: function( url, data, callback ) {
		return jQuery.get( url, data, callback, "json" );
	},

	getScript: function( url, callback ) {
		return jQuery.get( url, undefined, callback, "script" );
	}
});

jQuery.each( [ "get", "post" ], function( i, method ) {
	jQuery[ method ] = function( url, data, callback, type ) {
		// shift arguments if data argument was omitted
		if ( jQuery.isFunction( data ) ) {
			type = type || callback;
			callback = data;
			data = undefined;
		}

		return jQuery.ajax({
			url: url,
			type: method,
			dataType: type,
			data: data,
			success: callback
		});
	};
});

// Attach a bunch of functions for handling common AJAX events
jQuery.each( [ "ajaxStart", "ajaxStop", "ajaxComplete", "ajaxError", "ajaxSuccess", "ajaxSend" ], function( i, type ) {
	jQuery.fn[ type ] = function( fn ) {
		return this.on( type, fn );
	};
});


jQuery._evalUrl = function( url ) {
	return jQuery.ajax({
		url: url,
		type: "GET",
		dataType: "script",
		async: false,
		global: false,
		"throws": true
	});
};


jQuery.fn.extend({
	wrapAll: function( html ) {
		var wrap;

		if ( jQuery.isFunction( html ) ) {
			return this.each(function( i ) {
				jQuery( this ).wrapAll( html.call(this, i) );
			});
		}

		if ( this[ 0 ] ) {

			// The elements to wrap the target around
			wrap = jQuery( html, this[ 0 ].ownerDocument ).eq( 0 ).clone( true );

			if ( this[ 0 ].parentNode ) {
				wrap.insertBefore( this[ 0 ] );
			}

			wrap.map(function() {
				var elem = this;

				while ( elem.firstElementChild ) {
					elem = elem.firstElementChild;
				}

				return elem;
			}).append( this );
		}

		return this;
	},

	wrapInner: function( html ) {
		if ( jQuery.isFunction( html ) ) {
			return this.each(function( i ) {
				jQuery( this ).wrapInner( html.call(this, i) );
			});
		}

		return this.each(function() {
			var self = jQuery( this ),
				contents = self.contents();

			if ( contents.length ) {
				contents.wrapAll( html );

			} else {
				self.append( html );
			}
		});
	},

	wrap: function( html ) {
		var isFunction = jQuery.isFunction( html );

		return this.each(function( i ) {
			jQuery( this ).wrapAll( isFunction ? html.call(this, i) : html );
		});
	},

	unwrap: function() {
		return this.parent().each(function() {
			if ( !jQuery.nodeName( this, "body" ) ) {
				jQuery( this ).replaceWith( this.childNodes );
			}
		}).end();
	}
});


jQuery.expr.filters.hidden = function( elem ) {
	// Support: Opera <= 12.12
	// Opera reports offsetWidths and offsetHeights less than zero on some elements
	return elem.offsetWidth <= 0 && elem.offsetHeight <= 0;
};
jQuery.expr.filters.visible = function( elem ) {
	return !jQuery.expr.filters.hidden( elem );
};




var r20 = /%20/g,
	rbracket = /\[\]$/,
	rCRLF = /\r?\n/g,
	rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
	rsubmittable = /^(?:input|select|textarea|keygen)/i;

function buildParams( prefix, obj, traditional, add ) {
	var name;

	if ( jQuery.isArray( obj ) ) {
		// Serialize array item.
		jQuery.each( obj, function( i, v ) {
			if ( traditional || rbracket.test( prefix ) ) {
				// Treat each array item as a scalar.
				add( prefix, v );

			} else {
				// Item is non-scalar (array or object), encode its numeric index.
				buildParams( prefix + "[" + ( typeof v === "object" ? i : "" ) + "]", v, traditional, add );
			}
		});

	} else if ( !traditional && jQuery.type( obj ) === "object" ) {
		// Serialize object item.
		for ( name in obj ) {
			buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
		}

	} else {
		// Serialize scalar item.
		add( prefix, obj );
	}
}

// Serialize an array of form elements or a set of
// key/values into a query string
jQuery.param = function( a, traditional ) {
	var prefix,
		s = [],
		add = function( key, value ) {
			// If value is a function, invoke it and return its value
			value = jQuery.isFunction( value ) ? value() : ( value == null ? "" : value );
			s[ s.length ] = encodeURIComponent( key ) + "=" + encodeURIComponent( value );
		};

	// Set traditional to true for jQuery <= 1.3.2 behavior.
	if ( traditional === undefined ) {
		traditional = jQuery.ajaxSettings && jQuery.ajaxSettings.traditional;
	}

	// If an array was passed in, assume that it is an array of form elements.
	if ( jQuery.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {
		// Serialize the form elements
		jQuery.each( a, function() {
			add( this.name, this.value );
		});

	} else {
		// If traditional, encode the "old" way (the way 1.3.2 or older
		// did it), otherwise encode params recursively.
		for ( prefix in a ) {
			buildParams( prefix, a[ prefix ], traditional, add );
		}
	}

	// Return the resulting serialization
	return s.join( "&" ).replace( r20, "+" );
};

jQuery.fn.extend({
	serialize: function() {
		return jQuery.param( this.serializeArray() );
	},
	serializeArray: function() {
		return this.map(function() {
			// Can add propHook for "elements" to filter or add form elements
			var elements = jQuery.prop( this, "elements" );
			return elements ? jQuery.makeArray( elements ) : this;
		})
		.filter(function() {
			var type = this.type;

			// Use .is( ":disabled" ) so that fieldset[disabled] works
			return this.name && !jQuery( this ).is( ":disabled" ) &&
				rsubmittable.test( this.nodeName ) && !rsubmitterTypes.test( type ) &&
				( this.checked || !rcheckableType.test( type ) );
		})
		.map(function( i, elem ) {
			var val = jQuery( this ).val();

			return val == null ?
				null :
				jQuery.isArray( val ) ?
					jQuery.map( val, function( val ) {
						return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
					}) :
					{ name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
		}).get();
	}
});


jQuery.ajaxSettings.xhr = function() {
	try {
		return new XMLHttpRequest();
	} catch( e ) {}
};

var xhrId = 0,
	xhrCallbacks = {},
	xhrSuccessStatus = {
		// file protocol always yields status code 0, assume 200
		0: 200,
		// Support: IE9
		// #1450: sometimes IE returns 1223 when it should be 204
		1223: 204
	},
	xhrSupported = jQuery.ajaxSettings.xhr();

// Support: IE9
// Open requests must be manually aborted on unload (#5280)
if ( window.ActiveXObject ) {
	jQuery( window ).on( "unload", function() {
		for ( var key in xhrCallbacks ) {
			xhrCallbacks[ key ]();
		}
	});
}

support.cors = !!xhrSupported && ( "withCredentials" in xhrSupported );
support.ajax = xhrSupported = !!xhrSupported;

jQuery.ajaxTransport(function( options ) {
	var callback;

	// Cross domain only allowed if supported through XMLHttpRequest
	if ( support.cors || xhrSupported && !options.crossDomain ) {
		return {
			send: function( headers, complete ) {
				var i,
					xhr = options.xhr(),
					id = ++xhrId;

				xhr.open( options.type, options.url, options.async, options.username, options.password );

				// Apply custom fields if provided
				if ( options.xhrFields ) {
					for ( i in options.xhrFields ) {
						xhr[ i ] = options.xhrFields[ i ];
					}
				}

				// Override mime type if needed
				if ( options.mimeType && xhr.overrideMimeType ) {
					xhr.overrideMimeType( options.mimeType );
				}

				// X-Requested-With header
				// For cross-domain requests, seeing as conditions for a preflight are
				// akin to a jigsaw puzzle, we simply never set it to be sure.
				// (it can always be set on a per-request basis or even using ajaxSetup)
				// For same-domain requests, won't change header if already provided.
				if ( !options.crossDomain && !headers["X-Requested-With"] ) {
					headers["X-Requested-With"] = "XMLHttpRequest";
				}

				// Set headers
				for ( i in headers ) {
					xhr.setRequestHeader( i, headers[ i ] );
				}

				// Callback
				callback = function( type ) {
					return function() {
						if ( callback ) {
							delete xhrCallbacks[ id ];
							callback = xhr.onload = xhr.onerror = null;

							if ( type === "abort" ) {
								xhr.abort();
							} else if ( type === "error" ) {
								complete(
									// file: protocol always yields status 0; see #8605, #14207
									xhr.status,
									xhr.statusText
								);
							} else {
								complete(
									xhrSuccessStatus[ xhr.status ] || xhr.status,
									xhr.statusText,
									// Support: IE9
									// Accessing binary-data responseText throws an exception
									// (#11426)
									typeof xhr.responseText === "string" ? {
										text: xhr.responseText
									} : undefined,
									xhr.getAllResponseHeaders()
								);
							}
						}
					};
				};

				// Listen to events
				xhr.onload = callback();
				xhr.onerror = callback("error");

				// Create the abort callback
				callback = xhrCallbacks[ id ] = callback("abort");

				try {
					// Do send the request (this may raise an exception)
					xhr.send( options.hasContent && options.data || null );
				} catch ( e ) {
					// #14683: Only rethrow if this hasn't been notified as an error yet
					if ( callback ) {
						throw e;
					}
				}
			},

			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
});




// Install script dataType
jQuery.ajaxSetup({
	accepts: {
		script: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"
	},
	contents: {
		script: /(?:java|ecma)script/
	},
	converters: {
		"text script": function( text ) {
			jQuery.globalEval( text );
			return text;
		}
	}
});

// Handle cache's special case and crossDomain
jQuery.ajaxPrefilter( "script", function( s ) {
	if ( s.cache === undefined ) {
		s.cache = false;
	}
	if ( s.crossDomain ) {
		s.type = "GET";
	}
});

// Bind script tag hack transport
jQuery.ajaxTransport( "script", function( s ) {
	// This transport only deals with cross domain requests
	if ( s.crossDomain ) {
		var script, callback;
		return {
			send: function( _, complete ) {
				script = jQuery("<script>").prop({
					async: true,
					charset: s.scriptCharset,
					src: s.url
				}).on(
					"load error",
					callback = function( evt ) {
						script.remove();
						callback = null;
						if ( evt ) {
							complete( evt.type === "error" ? 404 : 200, evt.type );
						}
					}
				);
				document.head.appendChild( script[ 0 ] );
			},
			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
});




var oldCallbacks = [],
	rjsonp = /(=)\?(?=&|$)|\?\?/;

// Default jsonp settings
jQuery.ajaxSetup({
	jsonp: "callback",
	jsonpCallback: function() {
		var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce++ ) );
		this[ callback ] = true;
		return callback;
	}
});

// Detect, normalize options and install callbacks for jsonp requests
jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

	var callbackName, overwritten, responseContainer,
		jsonProp = s.jsonp !== false && ( rjsonp.test( s.url ) ?
			"url" :
			typeof s.data === "string" && !( s.contentType || "" ).indexOf("application/x-www-form-urlencoded") && rjsonp.test( s.data ) && "data"
		);

	// Handle iff the expected data type is "jsonp" or we have a parameter to set
	if ( jsonProp || s.dataTypes[ 0 ] === "jsonp" ) {

		// Get callback name, remembering preexisting value associated with it
		callbackName = s.jsonpCallback = jQuery.isFunction( s.jsonpCallback ) ?
			s.jsonpCallback() :
			s.jsonpCallback;

		// Insert callback into url or form data
		if ( jsonProp ) {
			s[ jsonProp ] = s[ jsonProp ].replace( rjsonp, "$1" + callbackName );
		} else if ( s.jsonp !== false ) {
			s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
		}

		// Use data converter to retrieve json after script execution
		s.converters["script json"] = function() {
			if ( !responseContainer ) {
				jQuery.error( callbackName + " was not called" );
			}
			return responseContainer[ 0 ];
		};

		// force json dataType
		s.dataTypes[ 0 ] = "json";

		// Install callback
		overwritten = window[ callbackName ];
		window[ callbackName ] = function() {
			responseContainer = arguments;
		};

		// Clean-up function (fires after converters)
		jqXHR.always(function() {
			// Restore preexisting value
			window[ callbackName ] = overwritten;

			// Save back as free
			if ( s[ callbackName ] ) {
				// make sure that re-using the options doesn't screw things around
				s.jsonpCallback = originalSettings.jsonpCallback;

				// save the callback name for future use
				oldCallbacks.push( callbackName );
			}

			// Call if it was a function and we have a response
			if ( responseContainer && jQuery.isFunction( overwritten ) ) {
				overwritten( responseContainer[ 0 ] );
			}

			responseContainer = overwritten = undefined;
		});

		// Delegate to script
		return "script";
	}
});




// data: string of html
// context (optional): If specified, the fragment will be created in this context, defaults to document
// keepScripts (optional): If true, will include scripts passed in the html string
jQuery.parseHTML = function( data, context, keepScripts ) {
	if ( !data || typeof data !== "string" ) {
		return null;
	}
	if ( typeof context === "boolean" ) {
		keepScripts = context;
		context = false;
	}
	context = context || document;

	var parsed = rsingleTag.exec( data ),
		scripts = !keepScripts && [];

	// Single tag
	if ( parsed ) {
		return [ context.createElement( parsed[1] ) ];
	}

	parsed = jQuery.buildFragment( [ data ], context, scripts );

	if ( scripts && scripts.length ) {
		jQuery( scripts ).remove();
	}

	return jQuery.merge( [], parsed.childNodes );
};


// Keep a copy of the old load method
var _load = jQuery.fn.load;

/**
 * Load a url into a page
 */
jQuery.fn.load = function( url, params, callback ) {
	if ( typeof url !== "string" && _load ) {
		return _load.apply( this, arguments );
	}

	var selector, type, response,
		self = this,
		off = url.indexOf(" ");

	if ( off >= 0 ) {
		selector = jQuery.trim( url.slice( off ) );
		url = url.slice( 0, off );
	}

	// If it's a function
	if ( jQuery.isFunction( params ) ) {

		// We assume that it's the callback
		callback = params;
		params = undefined;

	// Otherwise, build a param string
	} else if ( params && typeof params === "object" ) {
		type = "POST";
	}

	// If we have elements to modify, make the request
	if ( self.length > 0 ) {
		jQuery.ajax({
			url: url,

			// if "type" variable is undefined, then "GET" method will be used
			type: type,
			dataType: "html",
			data: params
		}).done(function( responseText ) {

			// Save response for use in complete callback
			response = arguments;

			self.html( selector ?

				// If a selector was specified, locate the right elements in a dummy div
				// Exclude scripts to avoid IE 'Permission Denied' errors
				jQuery("<div>").append( jQuery.parseHTML( responseText ) ).find( selector ) :

				// Otherwise use the full result
				responseText );

		}).complete( callback && function( jqXHR, status ) {
			self.each( callback, response || [ jqXHR.responseText, status, jqXHR ] );
		});
	}

	return this;
};




jQuery.expr.filters.animated = function( elem ) {
	return jQuery.grep(jQuery.timers, function( fn ) {
		return elem === fn.elem;
	}).length;
};




var docElem = window.document.documentElement;

/**
 * Gets a window from an element
 */
function getWindow( elem ) {
	return jQuery.isWindow( elem ) ? elem : elem.nodeType === 9 && elem.defaultView;
}

jQuery.offset = {
	setOffset: function( elem, options, i ) {
		var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
			position = jQuery.css( elem, "position" ),
			curElem = jQuery( elem ),
			props = {};

		// Set position first, in-case top/left are set even on static elem
		if ( position === "static" ) {
			elem.style.position = "relative";
		}

		curOffset = curElem.offset();
		curCSSTop = jQuery.css( elem, "top" );
		curCSSLeft = jQuery.css( elem, "left" );
		calculatePosition = ( position === "absolute" || position === "fixed" ) &&
			( curCSSTop + curCSSLeft ).indexOf("auto") > -1;

		// Need to be able to calculate position if either top or left is auto and position is either absolute or fixed
		if ( calculatePosition ) {
			curPosition = curElem.position();
			curTop = curPosition.top;
			curLeft = curPosition.left;

		} else {
			curTop = parseFloat( curCSSTop ) || 0;
			curLeft = parseFloat( curCSSLeft ) || 0;
		}

		if ( jQuery.isFunction( options ) ) {
			options = options.call( elem, i, curOffset );
		}

		if ( options.top != null ) {
			props.top = ( options.top - curOffset.top ) + curTop;
		}
		if ( options.left != null ) {
			props.left = ( options.left - curOffset.left ) + curLeft;
		}

		if ( "using" in options ) {
			options.using.call( elem, props );

		} else {
			curElem.css( props );
		}
	}
};

jQuery.fn.extend({
	offset: function( options ) {
		if ( arguments.length ) {
			return options === undefined ?
				this :
				this.each(function( i ) {
					jQuery.offset.setOffset( this, options, i );
				});
		}

		var docElem, win,
			elem = this[ 0 ],
			box = { top: 0, left: 0 },
			doc = elem && elem.ownerDocument;

		if ( !doc ) {
			return;
		}

		docElem = doc.documentElement;

		// Make sure it's not a disconnected DOM node
		if ( !jQuery.contains( docElem, elem ) ) {
			return box;
		}

		// If we don't have gBCR, just use 0,0 rather than error
		// BlackBerry 5, iOS 3 (original iPhone)
		if ( typeof elem.getBoundingClientRect !== strundefined ) {
			box = elem.getBoundingClientRect();
		}
		win = getWindow( doc );
		return {
			top: box.top + win.pageYOffset - docElem.clientTop,
			left: box.left + win.pageXOffset - docElem.clientLeft
		};
	},

	position: function() {
		if ( !this[ 0 ] ) {
			return;
		}

		var offsetParent, offset,
			elem = this[ 0 ],
			parentOffset = { top: 0, left: 0 };

		// Fixed elements are offset from window (parentOffset = {top:0, left: 0}, because it is its only offset parent
		if ( jQuery.css( elem, "position" ) === "fixed" ) {
			// We assume that getBoundingClientRect is available when computed position is fixed
			offset = elem.getBoundingClientRect();

		} else {
			// Get *real* offsetParent
			offsetParent = this.offsetParent();

			// Get correct offsets
			offset = this.offset();
			if ( !jQuery.nodeName( offsetParent[ 0 ], "html" ) ) {
				parentOffset = offsetParent.offset();
			}

			// Add offsetParent borders
			parentOffset.top += jQuery.css( offsetParent[ 0 ], "borderTopWidth", true );
			parentOffset.left += jQuery.css( offsetParent[ 0 ], "borderLeftWidth", true );
		}

		// Subtract parent offsets and element margins
		return {
			top: offset.top - parentOffset.top - jQuery.css( elem, "marginTop", true ),
			left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true )
		};
	},

	offsetParent: function() {
		return this.map(function() {
			var offsetParent = this.offsetParent || docElem;

			while ( offsetParent && ( !jQuery.nodeName( offsetParent, "html" ) && jQuery.css( offsetParent, "position" ) === "static" ) ) {
				offsetParent = offsetParent.offsetParent;
			}

			return offsetParent || docElem;
		});
	}
});

// Create scrollLeft and scrollTop methods
jQuery.each( { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function( method, prop ) {
	var top = "pageYOffset" === prop;

	jQuery.fn[ method ] = function( val ) {
		return access( this, function( elem, method, val ) {
			var win = getWindow( elem );

			if ( val === undefined ) {
				return win ? win[ prop ] : elem[ method ];
			}

			if ( win ) {
				win.scrollTo(
					!top ? val : window.pageXOffset,
					top ? val : window.pageYOffset
				);

			} else {
				elem[ method ] = val;
			}
		}, method, val, arguments.length, null );
	};
});

// Add the top/left cssHooks using jQuery.fn.position
// Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
// getComputedStyle returns percent when specified for top/left/bottom/right
// rather than make the css module depend on the offset module, we just check for it here
jQuery.each( [ "top", "left" ], function( i, prop ) {
	jQuery.cssHooks[ prop ] = addGetHookIf( support.pixelPosition,
		function( elem, computed ) {
			if ( computed ) {
				computed = curCSS( elem, prop );
				// if curCSS returns percentage, fallback to offset
				return rnumnonpx.test( computed ) ?
					jQuery( elem ).position()[ prop ] + "px" :
					computed;
			}
		}
	);
});


// Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
	jQuery.each( { padding: "inner" + name, content: type, "": "outer" + name }, function( defaultExtra, funcName ) {
		// margin is only for outerHeight, outerWidth
		jQuery.fn[ funcName ] = function( margin, value ) {
			var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
				extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );

			return access( this, function( elem, type, value ) {
				var doc;

				if ( jQuery.isWindow( elem ) ) {
					// As of 5/8/2012 this will yield incorrect results for Mobile Safari, but there
					// isn't a whole lot we can do. See pull request at this URL for discussion:
					// https://github.com/jquery/jquery/pull/764
					return elem.document.documentElement[ "client" + name ];
				}

				// Get document width or height
				if ( elem.nodeType === 9 ) {
					doc = elem.documentElement;

					// Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height],
					// whichever is greatest
					return Math.max(
						elem.body[ "scroll" + name ], doc[ "scroll" + name ],
						elem.body[ "offset" + name ], doc[ "offset" + name ],
						doc[ "client" + name ]
					);
				}

				return value === undefined ?
					// Get width or height on the element, requesting but not forcing parseFloat
					jQuery.css( elem, type, extra ) :

					// Set width or height on the element
					jQuery.style( elem, type, value, extra );
			}, type, chainable ? margin : undefined, chainable, null );
		};
	});
});


// The number of elements contained in the matched element set
jQuery.fn.size = function() {
	return this.length;
};

jQuery.fn.andSelf = jQuery.fn.addBack;




// Register as a named AMD module, since jQuery can be concatenated with other
// files that may use define, but not via a proper concatenation script that
// understands anonymous AMD modules. A named AMD is safest and most robust
// way to register. Lowercase jquery is used because AMD module names are
// derived from file names, and jQuery is normally delivered in a lowercase
// file name. Do this after creating the global so that if an AMD module wants
// to call noConflict to hide this version of jQuery, it will work.

// Note that for maximum portability, libraries that are not jQuery should
// declare themselves as anonymous modules, and avoid setting a global if an
// AMD loader is present. jQuery is a special case. For more information, see
// https://github.com/jrburke/requirejs/wiki/Updating-existing-libraries#wiki-anon

if ( typeof define === "function" && define.amd ) {
	define( "jquery", [], function() {
		return jQuery;
	});
}




var
	// Map over jQuery in case of overwrite
	_jQuery = window.jQuery,

	// Map over the $ in case of overwrite
	_$ = window.$;

jQuery.noConflict = function( deep ) {
	if ( window.$ === jQuery ) {
		window.$ = _$;
	}

	if ( deep && window.jQuery === jQuery ) {
		window.jQuery = _jQuery;
	}

	return jQuery;
};

// Expose jQuery and $ identifiers, even in
// AMD (#7102#comment:10, https://github.com/jquery/jquery/pull/557)
// and CommonJS for browser emulators (#13566)
if ( typeof noGlobal === strundefined ) {
	window.jQuery = window.$ = jQuery;
}




return jQuery;

}));

},{}],"jquery":[function(require,module,exports){
module.exports=require('QRCzyp');
},{}],"underscore":[function(require,module,exports){
module.exports=require('s12qeW');
},{}],"s12qeW":[function(require,module,exports){
//     Underscore.js 1.7.0
//     http://underscorejs.org
//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.7.0';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var createCallback = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  _.iteratee = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return createCallback(value, context, argCount);
    if (_.isObject(value)) return _.matches(value);
    return _.property(value);
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    if (obj == null) return obj;
    iteratee = createCallback(iteratee, context);
    var i, length = obj.length;
    if (length === +length) {
      for (i = 0; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    if (obj == null) return [];
    iteratee = _.iteratee(iteratee, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length),
        currentKey;
    for (var index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = function(obj, iteratee, memo, context) {
    if (obj == null) obj = [];
    iteratee = createCallback(iteratee, context, 4);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index = 0, currentKey;
    if (arguments.length < 3) {
      if (!length) throw new TypeError(reduceError);
      memo = obj[keys ? keys[index++] : index++];
    }
    for (; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      memo = iteratee(memo, obj[currentKey], currentKey, obj);
    }
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = function(obj, iteratee, memo, context) {
    if (obj == null) obj = [];
    iteratee = createCallback(iteratee, context, 4);
    var keys = obj.length !== + obj.length && _.keys(obj),
        index = (keys || obj).length,
        currentKey;
    if (arguments.length < 3) {
      if (!index) throw new TypeError(reduceError);
      memo = obj[keys ? keys[--index] : --index];
    }
    while (index--) {
      currentKey = keys ? keys[index] : index;
      memo = iteratee(memo, obj[currentKey], currentKey, obj);
    }
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var result;
    predicate = _.iteratee(predicate, context);
    _.some(obj, function(value, index, list) {
      if (predicate(value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    if (obj == null) return results;
    predicate = _.iteratee(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(_.iteratee(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    if (obj == null) return true;
    predicate = _.iteratee(predicate, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index, currentKey;
    for (index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    if (obj == null) return false;
    predicate = _.iteratee(predicate, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index, currentKey;
    for (index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (obj.length !== +obj.length) obj = _.values(obj);
    return _.indexOf(obj, target) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matches(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matches(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = obj.length === +obj.length ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = obj.length === +obj.length ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = obj && obj.length === +obj.length ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (obj.length !== +obj.length) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = _.iteratee(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = _.iteratee(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = low + high >>> 1;
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return obj.length === +obj.length ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = _.iteratee(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    if (n < 0) return [];
    return slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return slice.call(array, Math.max(array.length - n, 0));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    for (var i = 0, length = input.length; i < length; i++) {
      var value = input[i];
      if (!_.isArray(value) && !_.isArguments(value)) {
        if (!strict) output.push(value);
      } else if (shallow) {
        push.apply(output, value);
      } else {
        flatten(value, shallow, strict, output);
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (array == null) return [];
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = _.iteratee(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = array.length; i < length; i++) {
      var value = array[i];
      if (isSorted) {
        if (!i || seen !== value) result.push(value);
        seen = value;
      } else if (iteratee) {
        var computed = iteratee(value, i, array);
        if (_.indexOf(seen, computed) < 0) {
          seen.push(computed);
          result.push(value);
        }
      } else if (_.indexOf(result, value) < 0) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true, []));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    if (array == null) return [];
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = array.length; i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(slice.call(arguments, 1), true, true, []);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function(array) {
    if (array == null) return [];
    var length = _.max(arguments, 'length').length;
    var results = Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = isSorted < 0 ? Math.max(0, length + isSorted) : isSorted;
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var idx = array.length;
    if (typeof from == 'number') {
      idx = from < 0 ? idx + from + 1 : Math.min(idx, from + 1);
    }
    while (--idx >= 0) if (array[idx] === item) return idx;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var Ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    args = slice.call(arguments, 2);
    bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      Ctor.prototype = func.prototype;
      var self = new Ctor;
      Ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (_.isObject(result)) return result;
      return self;
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    return function() {
      var position = 0;
      var args = boundArgs.slice();
      for (var i = 0, length = args.length; i < length; i++) {
        if (args[i] === _) args[i] = arguments[position++];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return func.apply(this, args);
    };
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = hasher ? hasher.apply(this, arguments) : key;
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last > 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed before being called N times.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      } else {
        func = null;
      }
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    if (!_.isObject(obj)) return obj;
    var source, prop;
    for (var i = 1, length = arguments.length; i < length; i++) {
      source = arguments[i];
      for (prop in source) {
        if (hasOwnProperty.call(source, prop)) {
            obj[prop] = source[prop];
        }
      }
    }
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj, iteratee, context) {
    var result = {}, key;
    if (obj == null) return result;
    if (_.isFunction(iteratee)) {
      iteratee = createCallback(iteratee, context);
      for (key in obj) {
        var value = obj[key];
        if (iteratee(value, key, obj)) result[key] = value;
      }
    } else {
      var keys = concat.apply([], slice.call(arguments, 1));
      obj = new Object(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];
        if (key in obj) result[key] = obj[key];
      }
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(concat.apply([], slice.call(arguments, 1)), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    if (!_.isObject(obj)) return obj;
    for (var i = 1, length = arguments.length; i < length; i++) {
      var source = arguments[i];
      for (var prop in source) {
        if (obj[prop] === void 0) obj[prop] = source[prop];
      }
    }
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (
      aCtor !== bCtor &&
      // Handle Object.create(x) cases
      'constructor' in a && 'constructor' in b &&
      !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
        _.isFunction(bCtor) && bCtor instanceof bCtor)
    ) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size, result;
    // Recursively compare objects and arrays.
    if (className === '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size === b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      size = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      result = _.keys(b).length === size;
      if (result) {
        while (size--) {
          // Deep compare each member
          key = keys[size];
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj) || _.isArguments(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around an IE 11 bug.
  if (typeof /./ !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = function(key) {
    return function(obj) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  _.matches = function(attrs) {
    var pairs = _.pairs(attrs), length = pairs.length;
    return function(obj) {
      if (obj == null) return !length;
      obj = new Object(obj);
      for (var i = 0; i < length; i++) {
        var pair = pairs[i], key = pair[0];
        if (pair[1] !== obj[key] || !(key in obj)) return false;
      }
      return true;
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = createCallback(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? object[property]() : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}],16:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function (require) {

	var makePromise = require('./makePromise');
	var Scheduler = require('./Scheduler');
	var async = require('./async');

	return makePromise({
		scheduler: new Scheduler(async)
	});

});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); });

},{"./Scheduler":18,"./async":20,"./makePromise":30}],17:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {
	/**
	 * Circular queue
	 * @param {number} capacityPow2 power of 2 to which this queue's capacity
	 *  will be set initially. eg when capacityPow2 == 3, queue capacity
	 *  will be 8.
	 * @constructor
	 */
	function Queue(capacityPow2) {
		this.head = this.tail = this.length = 0;
		this.buffer = new Array(1 << capacityPow2);
	}

	Queue.prototype.push = function(x) {
		if(this.length === this.buffer.length) {
			this._ensureCapacity(this.length * 2);
		}

		this.buffer[this.tail] = x;
		this.tail = (this.tail + 1) & (this.buffer.length - 1);
		++this.length;
		return this.length;
	};

	Queue.prototype.shift = function() {
		var x = this.buffer[this.head];
		this.buffer[this.head] = void 0;
		this.head = (this.head + 1) & (this.buffer.length - 1);
		--this.length;
		return x;
	};

	Queue.prototype._ensureCapacity = function(capacity) {
		var head = this.head;
		var buffer = this.buffer;
		var newBuffer = new Array(capacity);
		var i = 0;
		var len;

		if(head === 0) {
			len = this.length;
			for(; i<len; ++i) {
				newBuffer[i] = buffer[i];
			}
		} else {
			capacity = buffer.length;
			len = this.tail;
			for(; head<capacity; ++i, ++head) {
				newBuffer[i] = buffer[head];
			}

			for(head=0; head<len; ++i, ++head) {
				newBuffer[i] = buffer[head];
			}
		}

		this.buffer = newBuffer;
		this.head = 0;
		this.tail = this.length;
	};

	return Queue;

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],18:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var Queue = require('./Queue');

	// Credit to Twisol (https://github.com/Twisol) for suggesting
	// this type of extensible queue + trampoline approach for next-tick conflation.

	/**
	 * Async task scheduler
	 * @param {function} async function to schedule a single async function
	 * @constructor
	 */
	function Scheduler(async) {
		this._async = async;
		this._queue = new Queue(15);
		this._afterQueue = new Queue(5);
		this._running = false;

		var self = this;
		this.drain = function() {
			self._drain();
		};
	}

	/**
	 * Enqueue a task
	 * @param {{ run:function }} task
	 */
	Scheduler.prototype.enqueue = function(task) {
		this._add(this._queue, task);
	};

	/**
	 * Enqueue a task to run after the main task queue
	 * @param {{ run:function }} task
	 */
	Scheduler.prototype.afterQueue = function(task) {
		this._add(this._afterQueue, task);
	};

	/**
	 * Drain the handler queue entirely, and then the after queue
	 */
	Scheduler.prototype._drain = function() {
		runQueue(this._queue);
		this._running = false;
		runQueue(this._afterQueue);
	};

	/**
	 * Add a task to the q, and schedule drain if not already scheduled
	 * @param {Queue} queue
	 * @param {{run:function}} task
	 * @private
	 */
	Scheduler.prototype._add = function(queue, task) {
		queue.push(task);
		if(!this._running) {
			this._running = true;
			this._async(this.drain);
		}
	};

	/**
	 * Run all the tasks in the q
	 * @param queue
	 */
	function runQueue(queue) {
		while(queue.length > 0) {
			queue.shift().run();
		}
	}

	return Scheduler;

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"./Queue":17}],19:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	/**
	 * Custom error type for promises rejected by promise.timeout
	 * @param {string} message
	 * @constructor
	 */
	function TimeoutError (message) {
		Error.call(this);
		this.message = message;
		this.name = TimeoutError.name;
		if (typeof Error.captureStackTrace === 'function') {
			Error.captureStackTrace(this, TimeoutError);
		}
	}

	TimeoutError.prototype = Object.create(Error.prototype);
	TimeoutError.prototype.constructor = TimeoutError;

	return TimeoutError;
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));
},{}],20:[function(require,module,exports){
(function (process){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	// Sniff "best" async scheduling option
	// Prefer process.nextTick or MutationObserver, then check for
	// vertx and finally fall back to setTimeout

	/*jshint maxcomplexity:6*/
	/*global process,document,setTimeout,MutationObserver,WebKitMutationObserver*/
	var nextTick, MutationObs;

	if (typeof process !== 'undefined' && process !== null &&
		typeof process.nextTick === 'function') {
		nextTick = function(f) {
			process.nextTick(f);
		};

	} else if (MutationObs =
		(typeof MutationObserver === 'function' && MutationObserver) ||
		(typeof WebKitMutationObserver === 'function' && WebKitMutationObserver)) {
		nextTick = (function (document, MutationObserver) {
			var scheduled;
			var el = document.createElement('div');
			var o = new MutationObserver(run);
			o.observe(el, { attributes: true });

			function run() {
				var f = scheduled;
				scheduled = void 0;
				f();
			}

			return function (f) {
				scheduled = f;
				el.setAttribute('class', 'x');
			};
		}(document, MutationObs));

	} else {
		nextTick = (function(cjsRequire) {
			var vertx;
			try {
				// vert.x 1.x || 2.x
				vertx = cjsRequire('vertx');
			} catch (ignore) {}

			if (vertx) {
				if (typeof vertx.runOnLoop === 'function') {
					return vertx.runOnLoop;
				}
				if (typeof vertx.runOnContext === 'function') {
					return vertx.runOnContext;
				}
			}

			// capture setTimeout to avoid being caught by fake timers
			// used in time based tests
			var capturedSetTimeout = setTimeout;
			return function (t) {
				capturedSetTimeout(t, 0);
			};
		}(require));
	}

	return nextTick;
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

}).call(this,require("+NscNm"))
},{"+NscNm":11}],21:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function array(Promise) {

		var arrayReduce = Array.prototype.reduce;
		var arrayReduceRight = Array.prototype.reduceRight;

		var toPromise = Promise.resolve;
		var all = Promise.all;

		// Additional array combinators

		Promise.any = any;
		Promise.some = some;
		Promise.settle = settle;

		Promise.map = map;
		Promise.filter = filter;
		Promise.reduce = reduce;
		Promise.reduceRight = reduceRight;

		/**
		 * When this promise fulfills with an array, do
		 * onFulfilled.apply(void 0, array)
		 * @param {function} onFulfilled function to apply
		 * @returns {Promise} promise for the result of applying onFulfilled
		 */
		Promise.prototype.spread = function(onFulfilled) {
			return this.then(all).then(function(array) {
				return onFulfilled.apply(void 0, array);
			});
		};

		return Promise;

		/**
		 * One-winner competitive race.
		 * Return a promise that will fulfill when one of the promises
		 * in the input array fulfills, or will reject when all promises
		 * have rejected.
		 * @param {array} promises
		 * @returns {Promise} promise for the first fulfilled value
		 */
		function any(promises) {
			return new Promise(function(resolve, reject) {
				var errors = [];
				var pending = initRace(promises, resolve, handleReject);

				if(pending === 0) {
					reject(new RangeError('any() input must not be empty'));
				}

				function handleReject(e) {
					errors.push(e);
					if(--pending === 0) {
						reject(errors);
					}
				}
			});
		}

		/**
		 * N-winner competitive race
		 * Return a promise that will fulfill when n input promises have
		 * fulfilled, or will reject when it becomes impossible for n
		 * input promises to fulfill (ie when promises.length - n + 1
		 * have rejected)
		 * @param {array} promises
		 * @param {number} n
		 * @returns {Promise} promise for the earliest n fulfillment values
		 *
		 * @deprecated
		 */
		function some(promises, n) {
			return new Promise(function(resolve, reject, notify) {
				var results = [];
				var errors = [];
				var nReject;
				var nFulfill = initRace(promises, handleResolve, handleReject, notify);

				n = Math.max(n, 0);
				nReject = (nFulfill - n + 1);
				nFulfill = Math.min(n, nFulfill);

				if(n > nFulfill) {
					reject(new RangeError('some() input must contain at least '
						+ n + ' element(s), but had ' + nFulfill));
				} else if(nFulfill === 0) {
					resolve(results);
				}

				function handleResolve(x) {
					if(nFulfill > 0) {
						--nFulfill;
						results.push(x);

						if(nFulfill === 0) {
							resolve(results);
						}
					}
				}

				function handleReject(e) {
					if(nReject > 0) {
						--nReject;
						errors.push(e);

						if(nReject === 0) {
							reject(errors);
						}
					}
				}
			});
		}

		/**
		 * Initialize a race observing each promise in the input promises
		 * @param {Array} promises
		 * @param {function} resolve
		 * @param {function} reject
		 * @param {?function=} notify
		 * @returns {Number} actual count of items being raced
		 */
		function initRace(promises, resolve, reject, notify) {
			return arrayReduce.call(promises, function(pending, p) {
				toPromise(p).then(resolve, reject, notify);
				return pending + 1;
			}, 0);
		}

		/**
		 * Apply f to the value of each promise in a list of promises
		 * and return a new list containing the results.
		 * @param {array} promises
		 * @param {function(x:*, index:Number):*} f mapping function
		 * @returns {Promise}
		 */
		function map(promises, f) {
			if(typeof promises !== 'object') {
				return toPromise([]);
			}

			return all(mapArray(function(x, i) {
				return toPromise(x).fold(mapWithIndex, i);
			}, promises));

			function mapWithIndex(k, x) {
				return f(x, k);
			}
		}

		/**
		 * Filter the provided array of promises using the provided predicate.  Input may
		 * contain promises and values
		 * @param {Array} promises array of promises and values
		 * @param {function(x:*, index:Number):boolean} predicate filtering predicate.
		 *  Must return truthy (or promise for truthy) for items to retain.
		 * @returns {Promise} promise that will fulfill with an array containing all items
		 *  for which predicate returned truthy.
		 */
		function filter(promises, predicate) {
			return all(promises).then(function(values) {
				return all(mapArray(predicate, values)).then(function(results) {
					var len = results.length;
					var filtered = new Array(len);
					for(var i=0, j= 0, x; i<len; ++i) {
						x = results[i];
						if(x === void 0 && !(i in results)) {
							continue;
						}
						if(results[i]) {
							filtered[j++] = values[i];
						}
					}
					filtered.length = j;
					return filtered;
				});
			});
		}

		/**
		 * Return a promise that will always fulfill with an array containing
		 * the outcome states of all input promises.  The returned promise
		 * will never reject.
		 * @param {array} promises
		 * @returns {Promise} promise for array of settled state descriptors
		 */
		function settle(promises) {
			return all(mapArray(function(p) {
				p = toPromise(p);
				return p.then(inspect, inspect);

				function inspect() {
					return p.inspect();
				}
			}, promises));
		}

		/**
		 * Reduce an array of promises and values
		 * @param {Array} promises
		 * @param {function(accumulated:*, x:*, index:Number):*} f reduce function
		 * @returns {Promise} promise for reduced value
		 */
		function reduce(promises, f) {
			var reducer = makeReducer(f);
			return arguments.length > 2
				? arrayReduce.call(promises, reducer, arguments[2])
				: arrayReduce.call(promises, reducer);
		}

		/**
		 * Reduce an array of promises and values from the right
		 * @param {Array} promises
		 * @param {function(accumulated:*, x:*, index:Number):*} f reduce function
		 * @returns {Promise} promise for reduced value
		 */
		function reduceRight(promises, f) {
			var reducer = makeReducer(f);
			return arguments.length > 2
				? arrayReduceRight.call(promises, reducer, arguments[2])
				: arrayReduceRight.call(promises, reducer);
		}

		function makeReducer(f) {
			return function reducer(result, x, i) {
				return toPromise(result).then(function(r) {
					return toPromise(x).then(function(x) {
						return f(r, x, i);
					});
				});
			};
		}

		function mapArray(f, a) {
			var l = a.length;
			var b = new Array(l);
			for(var i=0, x; i<l; ++i) {
				x = a[i];
				if(x === void 0 && !(i in a)) {
					continue;
				}
				b[i] = f(a[i], i);
			}
			return b;
		}
	};



});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],22:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function flow(Promise) {

		var resolve = Promise.resolve;
		var reject = Promise.reject;
		var origCatch = Promise.prototype['catch'];

		/**
		 * Handle the ultimate fulfillment value or rejection reason, and assume
		 * responsibility for all errors.  If an error propagates out of result
		 * or handleFatalError, it will be rethrown to the host, resulting in a
		 * loud stack track on most platforms and a crash on some.
		 * @param {function?} onResult
		 * @param {function?} onError
		 * @returns {undefined}
		 */
		Promise.prototype.done = function(onResult, onError) {
			this._handler.visit(this._handler.receiver, onResult, onError);
		};

		/**
		 * Add Error-type and predicate matching to catch.  Examples:
		 * promise.catch(TypeError, handleTypeError)
		 *   .catch(predicate, handleMatchedErrors)
		 *   .catch(handleRemainingErrors)
		 * @param onRejected
		 * @returns {*}
		 */
		Promise.prototype['catch'] = Promise.prototype.otherwise = function(onRejected) {
			if (arguments.length < 2) {
				return origCatch.call(this, onRejected);
			} else {
				if(typeof onRejected !== 'function') {
					return this.ensure(rejectInvalidPredicate);
				}

				return origCatch.call(this, createCatchFilter(arguments[1], onRejected));
			}
		};

		/**
		 * Wraps the provided catch handler, so that it will only be called
		 * if the predicate evaluates truthy
		 * @param {?function} handler
		 * @param {function} predicate
		 * @returns {function} conditional catch handler
		 */
		function createCatchFilter(handler, predicate) {
			return function(e) {
				return evaluatePredicate(e, predicate)
					? handler.call(this, e)
					: reject(e);
			};
		}

		/**
		 * Ensures that onFulfilledOrRejected will be called regardless of whether
		 * this promise is fulfilled or rejected.  onFulfilledOrRejected WILL NOT
		 * receive the promises' value or reason.  Any returned value will be disregarded.
		 * onFulfilledOrRejected may throw or return a rejected promise to signal
		 * an additional error.
		 * @param {function} handler handler to be called regardless of
		 *  fulfillment or rejection
		 * @returns {Promise}
		 */
		Promise.prototype['finally'] = Promise.prototype.ensure = function(handler) {
			if(typeof handler !== 'function') {
				return this;
			}

			return this.then(function(x) {
				return runSideEffect(handler, this, identity, x);
			}, function(e) {
				return runSideEffect(handler, this, reject, e);
			});
		};

		function runSideEffect (handler, thisArg, propagate, value) {
			var result = handler.call(thisArg);
			return maybeThenable(result)
				? propagateValue(result, propagate, value)
				: propagate(value);
		}

		function propagateValue (result, propagate, x) {
			return resolve(result).then(function () {
				return propagate(x);
			});
		}

		/**
		 * Recover from a failure by returning a defaultValue.  If defaultValue
		 * is a promise, it's fulfillment value will be used.  If defaultValue is
		 * a promise that rejects, the returned promise will reject with the
		 * same reason.
		 * @param {*} defaultValue
		 * @returns {Promise} new promise
		 */
		Promise.prototype['else'] = Promise.prototype.orElse = function(defaultValue) {
			return this.then(void 0, function() {
				return defaultValue;
			});
		};

		/**
		 * Shortcut for .then(function() { return value; })
		 * @param  {*} value
		 * @return {Promise} a promise that:
		 *  - is fulfilled if value is not a promise, or
		 *  - if value is a promise, will fulfill with its value, or reject
		 *    with its reason.
		 */
		Promise.prototype['yield'] = function(value) {
			return this.then(function() {
				return value;
			});
		};

		/**
		 * Runs a side effect when this promise fulfills, without changing the
		 * fulfillment value.
		 * @param {function} onFulfilledSideEffect
		 * @returns {Promise}
		 */
		Promise.prototype.tap = function(onFulfilledSideEffect) {
			return this.then(onFulfilledSideEffect)['yield'](this);
		};

		return Promise;
	};

	function rejectInvalidPredicate() {
		throw new TypeError('catch predicate must be a function');
	}

	function evaluatePredicate(e, predicate) {
		return isError(predicate) ? e instanceof predicate : predicate(e);
	}

	function isError(predicate) {
		return predicate === Error
			|| (predicate != null && predicate.prototype instanceof Error);
	}

	function maybeThenable(x) {
		return (typeof x === 'object' || typeof x === 'function') && x !== null;
	}

	function identity(x) {
		return x;
	}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],23:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */
/** @author Jeff Escalante */

(function(define) { 'use strict';
define(function() {

	return function fold(Promise) {

		Promise.prototype.fold = function(f, z) {
			var promise = this._beget();

			this._handler.fold(function(z, x, to) {
				Promise._handler(z).fold(function(x, z, to) {
					to.resolve(f.call(this, z, x));
				}, x, this, to);
			}, z, promise._handler.receiver, promise._handler);

			return promise;
		};

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],24:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function inspection(Promise) {

		Promise.prototype.inspect = function() {
			return inspect(Promise._handler(this));
		};

		function inspect(handler) {
			var state = handler.state();

			if(state === 0) {
				return { state: 'pending' };
			}

			if(state > 0) {
				return { state: 'fulfilled', value: handler.value };
			}

			return { state: 'rejected', reason: handler.value };
		}

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],25:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function generate(Promise) {

		var resolve = Promise.resolve;

		Promise.iterate = iterate;
		Promise.unfold = unfold;

		return Promise;

		/**
		 * @deprecated Use github.com/cujojs/most streams and most.iterate
		 * Generate a (potentially infinite) stream of promised values:
		 * x, f(x), f(f(x)), etc. until condition(x) returns true
		 * @param {function} f function to generate a new x from the previous x
		 * @param {function} condition function that, given the current x, returns
		 *  truthy when the iterate should stop
		 * @param {function} handler function to handle the value produced by f
		 * @param {*|Promise} x starting value, may be a promise
		 * @return {Promise} the result of the last call to f before
		 *  condition returns true
		 */
		function iterate(f, condition, handler, x) {
			return unfold(function(x) {
				return [x, f(x)];
			}, condition, handler, x);
		}

		/**
		 * @deprecated Use github.com/cujojs/most streams and most.unfold
		 * Generate a (potentially infinite) stream of promised values
		 * by applying handler(generator(seed)) iteratively until
		 * condition(seed) returns true.
		 * @param {function} unspool function that generates a [value, newSeed]
		 *  given a seed.
		 * @param {function} condition function that, given the current seed, returns
		 *  truthy when the unfold should stop
		 * @param {function} handler function to handle the value produced by unspool
		 * @param x {*|Promise} starting value, may be a promise
		 * @return {Promise} the result of the last value produced by unspool before
		 *  condition returns true
		 */
		function unfold(unspool, condition, handler, x) {
			return resolve(x).then(function(seed) {
				return resolve(condition(seed)).then(function(done) {
					return done ? seed : resolve(unspool(seed)).spread(next);
				});
			});

			function next(item, newSeed) {
				return resolve(handler(item)).then(function() {
					return unfold(unspool, condition, handler, newSeed);
				});
			}
		}
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],26:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function progress(Promise) {

		/**
		 * @deprecated
		 * Register a progress handler for this promise
		 * @param {function} onProgress
		 * @returns {Promise}
		 */
		Promise.prototype.progress = function(onProgress) {
			return this.then(void 0, void 0, onProgress);
		};

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],27:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var timer = require('../timer');
	var TimeoutError = require('../TimeoutError');

	function setTimeout(f, ms, x, y) {
		return timer.set(function() {
			f(x, y, ms);
		}, ms);
	}

	return function timed(Promise) {
		/**
		 * Return a new promise whose fulfillment value is revealed only
		 * after ms milliseconds
		 * @param {number} ms milliseconds
		 * @returns {Promise}
		 */
		Promise.prototype.delay = function(ms) {
			var p = this._beget();
			this._handler.fold(handleDelay, ms, void 0, p._handler);
			return p;
		};

		function handleDelay(ms, x, h) {
			setTimeout(resolveDelay, ms, x, h);
		}

		function resolveDelay(x, h) {
			h.resolve(x);
		}

		/**
		 * Return a new promise that rejects after ms milliseconds unless
		 * this promise fulfills earlier, in which case the returned promise
		 * fulfills with the same value.
		 * @param {number} ms milliseconds
		 * @param {Error|*=} reason optional rejection reason to use, defaults
		 *   to a TimeoutError if not provided
		 * @returns {Promise}
		 */
		Promise.prototype.timeout = function(ms, reason) {
			var p = this._beget();
			var h = p._handler;

			var t = setTimeout(onTimeout, ms, reason, p._handler);

			this._handler.visit(h,
				function onFulfill(x) {
					timer.clear(t);
					this.resolve(x); // this = h
				},
				function onReject(x) {
					timer.clear(t);
					this.reject(x); // this = h
				},
				h.notify);

			return p;
		};

		function onTimeout(reason, h, ms) {
			var e = typeof reason === 'undefined'
				? new TimeoutError('timed out after ' + ms + 'ms')
				: reason;
			h.reject(e);
		}

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../TimeoutError":19,"../timer":31}],28:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var timer = require('../timer');

	return function unhandledRejection(Promise) {
		var logError = noop;
		var logInfo = noop;

		if(typeof console !== 'undefined') {
			logError = typeof console.error !== 'undefined'
				? function (e) { console.error(e); }
				: function (e) { console.log(e); };

			logInfo = typeof console.info !== 'undefined'
				? function (e) { console.info(e); }
				: function (e) { console.log(e); };
		}

		Promise.onPotentiallyUnhandledRejection = function(rejection) {
			enqueue(report, rejection);
		};

		Promise.onPotentiallyUnhandledRejectionHandled = function(rejection) {
			enqueue(unreport, rejection);
		};

		Promise.onFatalRejection = function(rejection) {
			enqueue(throwit, rejection.value);
		};

		var tasks = [];
		var reported = [];
		var running = false;

		function report(r) {
			if(!r.handled) {
				reported.push(r);
				logError('Potentially unhandled rejection [' + r.id + '] ' + formatError(r.value));
			}
		}

		function unreport(r) {
			var i = reported.indexOf(r);
			if(i >= 0) {
				reported.splice(i, 1);
				logInfo('Handled previous rejection [' + r.id + '] ' + formatObject(r.value));
			}
		}

		function enqueue(f, x) {
			tasks.push(f, x);
			if(!running) {
				running = true;
				running = timer.set(flush, 0);
			}
		}

		function flush() {
			running = false;
			while(tasks.length > 0) {
				tasks.shift()(tasks.shift());
			}
		}

		return Promise;
	};

	function formatError(e) {
		var s = typeof e === 'object' && e.stack ? e.stack : formatObject(e);
		return e instanceof Error ? s : s + ' (WARNING: non-Error used)';
	}

	function formatObject(o) {
		var s = String(o);
		if(s === '[object Object]' && typeof JSON !== 'undefined') {
			s = tryStringify(o, s);
		}
		return s;
	}

	function tryStringify(e, defaultValue) {
		try {
			return JSON.stringify(e);
		} catch(e) {
			// Ignore. Cannot JSON.stringify e, stick with String(e)
			return defaultValue;
		}
	}

	function throwit(e) {
		throw e;
	}

	function noop() {}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../timer":31}],29:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function addWith(Promise) {
		/**
		 * Returns a promise whose handlers will be called with `this` set to
		 * the supplied receiver.  Subsequent promises derived from the
		 * returned promise will also have their handlers called with receiver
		 * as `this`. Calling `with` with undefined or no arguments will return
		 * a promise whose handlers will again be called in the usual Promises/A+
		 * way (no `this`) thus safely undoing any previous `with` in the
		 * promise chain.
		 *
		 * WARNING: Promises returned from `with`/`withThis` are NOT Promises/A+
		 * compliant, specifically violating 2.2.5 (http://promisesaplus.com/#point-41)
		 *
		 * @param {object} receiver `this` value for all handlers attached to
		 *  the returned promise.
		 * @returns {Promise}
		 */
		Promise.prototype['with'] = Promise.prototype.withThis = function(receiver) {
			var p = this._beget();
			var child = p._handler;
			child.receiver = receiver;
			this._handler.chain(child, receiver);
			return p;
		};

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));


},{}],30:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function makePromise(environment) {

		var tasks = environment.scheduler;

		var objectCreate = Object.create ||
			function(proto) {
				function Child() {}
				Child.prototype = proto;
				return new Child();
			};

		/**
		 * Create a promise whose fate is determined by resolver
		 * @constructor
		 * @returns {Promise} promise
		 * @name Promise
		 */
		function Promise(resolver, handler) {
			this._handler = resolver === Handler ? handler : init(resolver);
		}

		/**
		 * Run the supplied resolver
		 * @param resolver
		 * @returns {Pending}
		 */
		function init(resolver) {
			var handler = new Pending();

			try {
				resolver(promiseResolve, promiseReject, promiseNotify);
			} catch (e) {
				promiseReject(e);
			}

			return handler;

			/**
			 * Transition from pre-resolution state to post-resolution state, notifying
			 * all listeners of the ultimate fulfillment or rejection
			 * @param {*} x resolution value
			 */
			function promiseResolve (x) {
				handler.resolve(x);
			}
			/**
			 * Reject this promise with reason, which will be used verbatim
			 * @param {Error|*} reason rejection reason, strongly suggested
			 *   to be an Error type
			 */
			function promiseReject (reason) {
				handler.reject(reason);
			}

			/**
			 * @deprecated
			 * Issue a progress event, notifying all progress listeners
			 * @param {*} x progress event payload to pass to all listeners
			 */
			function promiseNotify (x) {
				handler.notify(x);
			}
		}

		// Creation

		Promise.resolve = resolve;
		Promise.reject = reject;
		Promise.never = never;

		Promise._defer = defer;
		Promise._handler = getHandler;

		/**
		 * Returns a trusted promise. If x is already a trusted promise, it is
		 * returned, otherwise returns a new trusted Promise which follows x.
		 * @param  {*} x
		 * @return {Promise} promise
		 */
		function resolve(x) {
			return isPromise(x) ? x
				: new Promise(Handler, new Async(getHandler(x)));
		}

		/**
		 * Return a reject promise with x as its reason (x is used verbatim)
		 * @param {*} x
		 * @returns {Promise} rejected promise
		 */
		function reject(x) {
			return new Promise(Handler, new Async(new Rejected(x)));
		}

		/**
		 * Return a promise that remains pending forever
		 * @returns {Promise} forever-pending promise.
		 */
		function never() {
			return foreverPendingPromise; // Should be frozen
		}

		/**
		 * Creates an internal {promise, resolver} pair
		 * @private
		 * @returns {Promise}
		 */
		function defer() {
			return new Promise(Handler, new Pending());
		}

		// Transformation and flow control

		/**
		 * Transform this promise's fulfillment value, returning a new Promise
		 * for the transformed result.  If the promise cannot be fulfilled, onRejected
		 * is called with the reason.  onProgress *may* be called with updates toward
		 * this promise's fulfillment.
		 * @param {function=} onFulfilled fulfillment handler
		 * @param {function=} onRejected rejection handler
		 * @deprecated @param {function=} onProgress progress handler
		 * @return {Promise} new promise
		 */
		Promise.prototype.then = function(onFulfilled, onRejected) {
			var parent = this._handler;
			var state = parent.join().state();

			if ((typeof onFulfilled !== 'function' && state > 0) ||
				(typeof onRejected !== 'function' && state < 0)) {
				// Short circuit: value will not change, simply share handler
				return new this.constructor(Handler, parent);
			}

			var p = this._beget();
			var child = p._handler;

			parent.chain(child, parent.receiver, onFulfilled, onRejected,
					arguments.length > 2 ? arguments[2] : void 0);

			return p;
		};

		/**
		 * If this promise cannot be fulfilled due to an error, call onRejected to
		 * handle the error. Shortcut for .then(undefined, onRejected)
		 * @param {function?} onRejected
		 * @return {Promise}
		 */
		Promise.prototype['catch'] = function(onRejected) {
			return this.then(void 0, onRejected);
		};

		/**
		 * Creates a new, pending promise of the same type as this promise
		 * @private
		 * @returns {Promise}
		 */
		Promise.prototype._beget = function() {
			var parent = this._handler;
			var child = new Pending(parent.receiver, parent.join().context);
			return new this.constructor(Handler, child);
		};

		// Array combinators

		Promise.all = all;
		Promise.race = race;

		/**
		 * Return a promise that will fulfill when all promises in the
		 * input array have fulfilled, or will reject when one of the
		 * promises rejects.
		 * @param {array} promises array of promises
		 * @returns {Promise} promise for array of fulfillment values
		 */
		function all(promises) {
			/*jshint maxcomplexity:8*/
			var resolver = new Pending();
			var pending = promises.length >>> 0;
			var results = new Array(pending);

			var i, h, x, s;
			for (i = 0; i < promises.length; ++i) {
				x = promises[i];

				if (x === void 0 && !(i in promises)) {
					--pending;
					continue;
				}

				if (maybeThenable(x)) {
					h = getHandlerMaybeThenable(x);

					s = h.state();
					if (s === 0) {
						h.fold(settleAt, i, results, resolver);
					} else if (s > 0) {
						results[i] = h.value;
						--pending;
					} else {
						resolveAndObserveRemaining(promises, i+1, h, resolver);
						break;
					}

				} else {
					results[i] = x;
					--pending;
				}
			}

			if(pending === 0) {
				resolver.become(new Fulfilled(results));
			}

			return new Promise(Handler, resolver);

			function settleAt(i, x, resolver) {
				/*jshint validthis:true*/
				this[i] = x;
				if(--pending === 0) {
					resolver.become(new Fulfilled(this));
				}
			}
		}

		function resolveAndObserveRemaining(promises, start, handler, resolver) {
			resolver.become(handler);

			var i, h, x;
			for(i=start; i<promises.length; ++i) {
				x = promises[i];
				if(maybeThenable(x)) {
					h = getHandlerMaybeThenable(x);
					if(h !== handler) {
						h.visit(h, void 0, h._unreport);
					}
				}
			}
		}

		/**
		 * Fulfill-reject competitive race. Return a promise that will settle
		 * to the same state as the earliest input promise to settle.
		 *
		 * WARNING: The ES6 Promise spec requires that race()ing an empty array
		 * must return a promise that is pending forever.  This implementation
		 * returns a singleton forever-pending promise, the same singleton that is
		 * returned by Promise.never(), thus can be checked with ===
		 *
		 * @param {array} promises array of promises to race
		 * @returns {Promise} if input is non-empty, a promise that will settle
		 * to the same outcome as the earliest input promise to settle. if empty
		 * is empty, returns a promise that will never settle.
		 */
		function race(promises) {
			// Sigh, race([]) is untestable unless we return *something*
			// that is recognizable without calling .then() on it.
			if(Object(promises) === promises && promises.length === 0) {
				return never();
			}

			var resolver = new Pending();
			var i, x, h;
			for(i=0; i<promises.length; ++i) {
				x = promises[i];
				if (x === void 0 && !(i in promises)) {
					continue;
				}

				h = getHandler(x);
				if(h.state() !== 0) {
					resolveAndObserveRemaining(promises, i+1, h, resolver);
					break;
				}

				h.visit(resolver, resolver.resolve, resolver.reject);
			}
			return new Promise(Handler, resolver);
		}

		// Promise internals
		// Below this, everything is @private

		/**
		 * Get an appropriate handler for x, without checking for cycles
		 * @param {*} x
		 * @returns {object} handler
		 */
		function getHandler(x) {
			if(isPromise(x)) {
				return x._handler.join();
			}
			return maybeThenable(x) ? getHandlerUntrusted(x) : new Fulfilled(x);
		}

		/**
		 * Get a handler for thenable x.
		 * NOTE: You must only call this if maybeThenable(x) == true
		 * @param {object|function|Promise} x
		 * @returns {object} handler
		 */
		function getHandlerMaybeThenable(x) {
			return isPromise(x) ? x._handler.join() : getHandlerUntrusted(x);
		}

		/**
		 * Get a handler for potentially untrusted thenable x
		 * @param {*} x
		 * @returns {object} handler
		 */
		function getHandlerUntrusted(x) {
			try {
				var untrustedThen = x.then;
				return typeof untrustedThen === 'function'
					? new Thenable(untrustedThen, x)
					: new Fulfilled(x);
			} catch(e) {
				return new Rejected(e);
			}
		}

		/**
		 * Handler for a promise that is pending forever
		 * @constructor
		 */
		function Handler() {}

		Handler.prototype.when
			= Handler.prototype.become
			= Handler.prototype.notify // deprecated
			= Handler.prototype.fail
			= Handler.prototype._unreport
			= Handler.prototype._report
			= noop;

		Handler.prototype._state = 0;

		Handler.prototype.state = function() {
			return this._state;
		};

		/**
		 * Recursively collapse handler chain to find the handler
		 * nearest to the fully resolved value.
		 * @returns {object} handler nearest the fully resolved value
		 */
		Handler.prototype.join = function() {
			var h = this;
			while(h.handler !== void 0) {
				h = h.handler;
			}
			return h;
		};

		Handler.prototype.chain = function(to, receiver, fulfilled, rejected, progress) {
			this.when({
				resolver: to,
				receiver: receiver,
				fulfilled: fulfilled,
				rejected: rejected,
				progress: progress
			});
		};

		Handler.prototype.visit = function(receiver, fulfilled, rejected, progress) {
			this.chain(failIfRejected, receiver, fulfilled, rejected, progress);
		};

		Handler.prototype.fold = function(f, z, c, to) {
			this.visit(to, function(x) {
				f.call(c, z, x, this);
			}, to.reject, to.notify);
		};

		/**
		 * Handler that invokes fail() on any handler it becomes
		 * @constructor
		 */
		function FailIfRejected() {}

		inherit(Handler, FailIfRejected);

		FailIfRejected.prototype.become = function(h) {
			h.fail();
		};

		var failIfRejected = new FailIfRejected();

		/**
		 * Handler that manages a queue of consumers waiting on a pending promise
		 * @constructor
		 */
		function Pending(receiver, inheritedContext) {
			Promise.createContext(this, inheritedContext);

			this.consumers = void 0;
			this.receiver = receiver;
			this.handler = void 0;
			this.resolved = false;
		}

		inherit(Handler, Pending);

		Pending.prototype._state = 0;

		Pending.prototype.resolve = function(x) {
			this.become(getHandler(x));
		};

		Pending.prototype.reject = function(x) {
			if(this.resolved) {
				return;
			}

			this.become(new Rejected(x));
		};

		Pending.prototype.join = function() {
			if (!this.resolved) {
				return this;
			}

			var h = this;

			while (h.handler !== void 0) {
				h = h.handler;
				if (h === this) {
					return this.handler = cycle();
				}
			}

			return h;
		};

		Pending.prototype.run = function() {
			var q = this.consumers;
			var handler = this.join();
			this.consumers = void 0;

			for (var i = 0; i < q.length; ++i) {
				handler.when(q[i]);
			}
		};

		Pending.prototype.become = function(handler) {
			if(this.resolved) {
				return;
			}

			this.resolved = true;
			this.handler = handler;
			if(this.consumers !== void 0) {
				tasks.enqueue(this);
			}

			if(this.context !== void 0) {
				handler._report(this.context);
			}
		};

		Pending.prototype.when = function(continuation) {
			if(this.resolved) {
				tasks.enqueue(new ContinuationTask(continuation, this.handler));
			} else {
				if(this.consumers === void 0) {
					this.consumers = [continuation];
				} else {
					this.consumers.push(continuation);
				}
			}
		};

		/**
		 * @deprecated
		 */
		Pending.prototype.notify = function(x) {
			if(!this.resolved) {
				tasks.enqueue(new ProgressTask(x, this));
			}
		};

		Pending.prototype.fail = function(context) {
			var c = typeof context === 'undefined' ? this.context : context;
			this.resolved && this.handler.join().fail(c);
		};

		Pending.prototype._report = function(context) {
			this.resolved && this.handler.join()._report(context);
		};

		Pending.prototype._unreport = function() {
			this.resolved && this.handler.join()._unreport();
		};

		/**
		 * Wrap another handler and force it into a future stack
		 * @param {object} handler
		 * @constructor
		 */
		function Async(handler) {
			this.handler = handler;
		}

		inherit(Handler, Async);

		Async.prototype.when = function(continuation) {
			tasks.enqueue(new ContinuationTask(continuation, this));
		};

		Async.prototype._report = function(context) {
			this.join()._report(context);
		};

		Async.prototype._unreport = function() {
			this.join()._unreport();
		};

		/**
		 * Handler that wraps an untrusted thenable and assimilates it in a future stack
		 * @param {function} then
		 * @param {{then: function}} thenable
		 * @constructor
		 */
		function Thenable(then, thenable) {
			Pending.call(this);
			tasks.enqueue(new AssimilateTask(then, thenable, this));
		}

		inherit(Pending, Thenable);

		/**
		 * Handler for a fulfilled promise
		 * @param {*} x fulfillment value
		 * @constructor
		 */
		function Fulfilled(x) {
			Promise.createContext(this);
			this.value = x;
		}

		inherit(Handler, Fulfilled);

		Fulfilled.prototype._state = 1;

		Fulfilled.prototype.fold = function(f, z, c, to) {
			runContinuation3(f, z, this, c, to);
		};

		Fulfilled.prototype.when = function(cont) {
			runContinuation1(cont.fulfilled, this, cont.receiver, cont.resolver);
		};

		var errorId = 0;

		/**
		 * Handler for a rejected promise
		 * @param {*} x rejection reason
		 * @constructor
		 */
		function Rejected(x) {
			Promise.createContext(this);

			this.id = ++errorId;
			this.value = x;
			this.handled = false;
			this.reported = false;

			this._report();
		}

		inherit(Handler, Rejected);

		Rejected.prototype._state = -1;

		Rejected.prototype.fold = function(f, z, c, to) {
			to.become(this);
		};

		Rejected.prototype.when = function(cont) {
			if(typeof cont.rejected === 'function') {
				this._unreport();
			}
			runContinuation1(cont.rejected, this, cont.receiver, cont.resolver);
		};

		Rejected.prototype._report = function(context) {
			tasks.afterQueue(new ReportTask(this, context));
		};

		Rejected.prototype._unreport = function() {
			this.handled = true;
			tasks.afterQueue(new UnreportTask(this));
		};

		Rejected.prototype.fail = function(context) {
			Promise.onFatalRejection(this, context === void 0 ? this.context : context);
		};

		function ReportTask(rejection, context) {
			this.rejection = rejection;
			this.context = context;
		}

		ReportTask.prototype.run = function() {
			if(!this.rejection.handled) {
				this.rejection.reported = true;
				Promise.onPotentiallyUnhandledRejection(this.rejection, this.context);
			}
		};

		function UnreportTask(rejection) {
			this.rejection = rejection;
		}

		UnreportTask.prototype.run = function() {
			if(this.rejection.reported) {
				Promise.onPotentiallyUnhandledRejectionHandled(this.rejection);
			}
		};

		// Unhandled rejection hooks
		// By default, everything is a noop

		// TODO: Better names: "annotate"?
		Promise.createContext
			= Promise.enterContext
			= Promise.exitContext
			= Promise.onPotentiallyUnhandledRejection
			= Promise.onPotentiallyUnhandledRejectionHandled
			= Promise.onFatalRejection
			= noop;

		// Errors and singletons

		var foreverPendingHandler = new Handler();
		var foreverPendingPromise = new Promise(Handler, foreverPendingHandler);

		function cycle() {
			return new Rejected(new TypeError('Promise cycle'));
		}

		// Task runners

		/**
		 * Run a single consumer
		 * @constructor
		 */
		function ContinuationTask(continuation, handler) {
			this.continuation = continuation;
			this.handler = handler;
		}

		ContinuationTask.prototype.run = function() {
			this.handler.join().when(this.continuation);
		};

		/**
		 * Run a queue of progress handlers
		 * @constructor
		 */
		function ProgressTask(value, handler) {
			this.handler = handler;
			this.value = value;
		}

		ProgressTask.prototype.run = function() {
			var q = this.handler.consumers;
			if(q === void 0) {
				return;
			}

			for (var c, i = 0; i < q.length; ++i) {
				c = q[i];
				runNotify(c.progress, this.value, this.handler, c.receiver, c.resolver);
			}
		};

		/**
		 * Assimilate a thenable, sending it's value to resolver
		 * @param {function} then
		 * @param {object|function} thenable
		 * @param {object} resolver
		 * @constructor
		 */
		function AssimilateTask(then, thenable, resolver) {
			this._then = then;
			this.thenable = thenable;
			this.resolver = resolver;
		}

		AssimilateTask.prototype.run = function() {
			var h = this.resolver;
			tryAssimilate(this._then, this.thenable, _resolve, _reject, _notify);

			function _resolve(x) { h.resolve(x); }
			function _reject(x)  { h.reject(x); }
			function _notify(x)  { h.notify(x); }
		};

		function tryAssimilate(then, thenable, resolve, reject, notify) {
			try {
				then.call(thenable, resolve, reject, notify);
			} catch (e) {
				reject(e);
			}
		}

		// Other helpers

		/**
		 * @param {*} x
		 * @returns {boolean} true iff x is a trusted Promise
		 */
		function isPromise(x) {
			return x instanceof Promise;
		}

		/**
		 * Test just enough to rule out primitives, in order to take faster
		 * paths in some code
		 * @param {*} x
		 * @returns {boolean} false iff x is guaranteed *not* to be a thenable
		 */
		function maybeThenable(x) {
			return (typeof x === 'object' || typeof x === 'function') && x !== null;
		}

		function runContinuation1(f, h, receiver, next) {
			if(typeof f !== 'function') {
				return next.become(h);
			}

			Promise.enterContext(h);
			tryCatchReject(f, h.value, receiver, next);
			Promise.exitContext();
		}

		function runContinuation3(f, x, h, receiver, next) {
			if(typeof f !== 'function') {
				return next.become(h);
			}

			Promise.enterContext(h);
			tryCatchReject3(f, x, h.value, receiver, next);
			Promise.exitContext();
		}

		/**
		 * @deprecated
		 */
		function runNotify(f, x, h, receiver, next) {
			if(typeof f !== 'function') {
				return next.notify(x);
			}

			Promise.enterContext(h);
			tryCatchReturn(f, x, receiver, next);
			Promise.exitContext();
		}

		/**
		 * Return f.call(thisArg, x), or if it throws return a rejected promise for
		 * the thrown exception
		 */
		function tryCatchReject(f, x, thisArg, next) {
			try {
				next.become(getHandler(f.call(thisArg, x)));
			} catch(e) {
				next.become(new Rejected(e));
			}
		}

		/**
		 * Same as above, but includes the extra argument parameter.
		 */
		function tryCatchReject3(f, x, y, thisArg, next) {
			try {
				f.call(thisArg, x, y, next);
			} catch(e) {
				next.become(new Rejected(e));
			}
		}

		/**
		 * @deprecated
		 * Return f.call(thisArg, x), or if it throws, *return* the exception
		 */
		function tryCatchReturn(f, x, thisArg, next) {
			try {
				next.notify(f.call(thisArg, x));
			} catch(e) {
				next.notify(e);
			}
		}

		function inherit(Parent, Child) {
			Child.prototype = objectCreate(Parent.prototype);
			Child.prototype.constructor = Child;
		}

		function noop() {}

		return Promise;
	};
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],31:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {
	/*global setTimeout,clearTimeout*/
	var cjsRequire, vertx, setTimer, clearTimer;

	// Check for vertx environment by attempting to load vertx module.
	// Doing the check in two steps ensures compatibility with RaveJS,
	// which will return an empty module when browser: { vertx: false }
	// is set in package.json
	cjsRequire = require;

	try {
		vertx = cjsRequire('vertx');
	} catch (ignored) {}

	// If vertx loaded and has the timer features we expect, try to support it
	if (vertx && typeof vertx.setTimer === 'function') {
		setTimer = function (f, ms) { return vertx.setTimer(ms, f); };
		clearTimer = vertx.cancelTimer;
	} else {
		// NOTE: Truncate decimals to workaround node 0.10.30 bug:
		// https://github.com/joyent/node/issues/8167
		setTimer = function(f, ms) { return setTimeout(f, ms|0); };
		clearTimer = function(t) { return clearTimeout(t); };
	}

	return {
		set: setTimer,
		clear: clearTimer
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{}],"when":[function(require,module,exports){
module.exports=require('My0/Wt');
},{}],"My0/Wt":[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */

/**
 * Promises/A+ and when() implementation
 * when is part of the cujoJS family of libraries (http://cujojs.com/)
 * @author Brian Cavalier
 * @author John Hann
 * @version 3.5.0
 */
(function(define) { 'use strict';
define(function (require) {

	var timed = require('./lib/decorators/timed');
	var array = require('./lib/decorators/array');
	var flow = require('./lib/decorators/flow');
	var fold = require('./lib/decorators/fold');
	var inspect = require('./lib/decorators/inspect');
	var generate = require('./lib/decorators/iterate');
	var progress = require('./lib/decorators/progress');
	var withThis = require('./lib/decorators/with');
	var unhandledRejection = require('./lib/decorators/unhandledRejection');
	var TimeoutError = require('./lib/TimeoutError');

	var Promise = [array, flow, fold, generate, progress,
		inspect, withThis, timed, unhandledRejection]
		.reduce(function(Promise, feature) {
			return feature(Promise);
		}, require('./lib/Promise'));

	var slice = Array.prototype.slice;

	// Public API

	when.promise     = promise;              // Create a pending promise
	when.resolve     = Promise.resolve;      // Create a resolved promise
	when.reject      = Promise.reject;       // Create a rejected promise

	when.lift        = lift;                 // lift a function to return promises
	when['try']      = attempt;              // call a function and return a promise
	when.attempt     = attempt;              // alias for when.try

	when.iterate     = Promise.iterate;      // DEPRECATED (use cujojs/most streams) Generate a stream of promises
	when.unfold      = Promise.unfold;       // DEPRECATED (use cujojs/most streams) Generate a stream of promises

	when.join        = join;                 // Join 2 or more promises

	when.all         = all;                  // Resolve a list of promises
	when.settle      = settle;               // Settle a list of promises

	when.any         = lift(Promise.any);    // One-winner race
	when.some        = lift(Promise.some);   // Multi-winner race
	when.race        = lift(Promise.race);   // First-to-settle race

	when.map         = map;                  // Array.map() for promises
	when.filter      = filter;               // Array.filter() for promises
	when.reduce      = reduce;               // Array.reduce() for promises
	when.reduceRight = reduceRight;          // Array.reduceRight() for promises

	when.isPromiseLike = isPromiseLike;      // Is something promise-like, aka thenable

	when.Promise     = Promise;              // Promise constructor
	when.defer       = defer;                // Create a {promise, resolve, reject} tuple

	// Error types

	when.TimeoutError = TimeoutError;

	/**
	 * Get a trusted promise for x, or by transforming x with onFulfilled
	 *
	 * @param {*} x
	 * @param {function?} onFulfilled callback to be called when x is
	 *   successfully fulfilled.  If promiseOrValue is an immediate value, callback
	 *   will be invoked immediately.
	 * @param {function?} onRejected callback to be called when x is
	 *   rejected.
	 * @param {function?} onProgress callback to be called when progress updates
	 *   are issued for x. @deprecated
	 * @returns {Promise} a new promise that will fulfill with the return
	 *   value of callback or errback or the completion value of promiseOrValue if
	 *   callback and/or errback is not supplied.
	 */
	function when(x, onFulfilled, onRejected) {
		var p = Promise.resolve(x);
		if(arguments.length < 2) {
			return p;
		}

		return arguments.length > 3
			? p.then(onFulfilled, onRejected, arguments[3])
			: p.then(onFulfilled, onRejected);
	}

	/**
	 * Creates a new promise whose fate is determined by resolver.
	 * @param {function} resolver function(resolve, reject, notify)
	 * @returns {Promise} promise whose fate is determine by resolver
	 */
	function promise(resolver) {
		return new Promise(resolver);
	}

	/**
	 * Lift the supplied function, creating a version of f that returns
	 * promises, and accepts promises as arguments.
	 * @param {function} f
	 * @returns {Function} version of f that returns promises
	 */
	function lift(f) {
		return function() {
			return _apply(f, this, slice.call(arguments));
		};
	}

	/**
	 * Call f in a future turn, with the supplied args, and return a promise
	 * for the result.
	 * @param {function} f
	 * @returns {Promise}
	 */
	function attempt(f /*, args... */) {
		/*jshint validthis:true */
		return _apply(f, this, slice.call(arguments, 1));
	}

	/**
	 * try/lift helper that allows specifying thisArg
	 * @private
	 */
	function _apply(f, thisArg, args) {
		return Promise.all(args).then(function(args) {
			return f.apply(thisArg, args);
		});
	}

	/**
	 * Creates a {promise, resolver} pair, either or both of which
	 * may be given out safely to consumers.
	 * @return {{promise: Promise, resolve: function, reject: function, notify: function}}
	 */
	function defer() {
		return new Deferred();
	}

	function Deferred() {
		var p = Promise._defer();

		function resolve(x) { p._handler.resolve(x); }
		function reject(x) { p._handler.reject(x); }
		function notify(x) { p._handler.notify(x); }

		this.promise = p;
		this.resolve = resolve;
		this.reject = reject;
		this.notify = notify;
		this.resolver = { resolve: resolve, reject: reject, notify: notify };
	}

	/**
	 * Determines if x is promise-like, i.e. a thenable object
	 * NOTE: Will return true for *any thenable object*, and isn't truly
	 * safe, since it may attempt to access the `then` property of x (i.e.
	 *  clever/malicious getters may do weird things)
	 * @param {*} x anything
	 * @returns {boolean} true if x is promise-like
	 */
	function isPromiseLike(x) {
		return x && typeof x.then === 'function';
	}

	/**
	 * Return a promise that will resolve only once all the supplied arguments
	 * have resolved. The resolution value of the returned promise will be an array
	 * containing the resolution values of each of the arguments.
	 * @param {...*} arguments may be a mix of promises and values
	 * @returns {Promise}
	 */
	function join(/* ...promises */) {
		return Promise.all(arguments);
	}

	/**
	 * Return a promise that will fulfill once all input promises have
	 * fulfilled, or reject when any one input promise rejects.
	 * @param {array|Promise} promises array (or promise for an array) of promises
	 * @returns {Promise}
	 */
	function all(promises) {
		return when(promises, Promise.all);
	}

	/**
	 * Return a promise that will always fulfill with an array containing
	 * the outcome states of all input promises.  The returned promise
	 * will only reject if `promises` itself is a rejected promise.
	 * @param {array|Promise} promises array (or promise for an array) of promises
	 * @returns {Promise} promise for array of settled state descriptors
	 */
	function settle(promises) {
		return when(promises, Promise.settle);
	}

	/**
	 * Promise-aware array map function, similar to `Array.prototype.map()`,
	 * but input array may contain promises or values.
	 * @param {Array|Promise} promises array of anything, may contain promises and values
	 * @param {function(x:*, index:Number):*} mapFunc map function which may
	 *  return a promise or value
	 * @returns {Promise} promise that will fulfill with an array of mapped values
	 *  or reject if any input promise rejects.
	 */
	function map(promises, mapFunc) {
		return when(promises, function(promises) {
			return Promise.map(promises, mapFunc);
		});
	}

	/**
	 * Filter the provided array of promises using the provided predicate.  Input may
	 * contain promises and values
	 * @param {Array|Promise} promises array of promises and values
	 * @param {function(x:*, index:Number):boolean} predicate filtering predicate.
	 *  Must return truthy (or promise for truthy) for items to retain.
	 * @returns {Promise} promise that will fulfill with an array containing all items
	 *  for which predicate returned truthy.
	 */
	function filter(promises, predicate) {
		return when(promises, function(promises) {
			return Promise.filter(promises, predicate);
		});
	}

	/**
	 * Traditional reduce function, similar to `Array.prototype.reduce()`, but
	 * input may contain promises and/or values, and reduceFunc
	 * may return either a value or a promise, *and* initialValue may
	 * be a promise for the starting value.
	 * @param {Array|Promise} promises array or promise for an array of anything,
	 *      may contain a mix of promises and values.
	 * @param {function(accumulated:*, x:*, index:Number):*} f reduce function
	 * @returns {Promise} that will resolve to the final reduced value
	 */
	function reduce(promises, f /*, initialValue */) {
		/*jshint unused:false*/
		var args = slice.call(arguments, 1);
		return when(promises, function(array) {
			args.unshift(array);
			return Promise.reduce.apply(Promise, args);
		});
	}

	/**
	 * Traditional reduce function, similar to `Array.prototype.reduceRight()`, but
	 * input may contain promises and/or values, and reduceFunc
	 * may return either a value or a promise, *and* initialValue may
	 * be a promise for the starting value.
	 * @param {Array|Promise} promises array or promise for an array of anything,
	 *      may contain a mix of promises and values.
	 * @param {function(accumulated:*, x:*, index:Number):*} f reduce function
	 * @returns {Promise} that will resolve to the final reduced value
	 */
	function reduceRight(promises, f /*, initialValue */) {
		/*jshint unused:false*/
		var args = slice.call(arguments, 1);
		return when(promises, function(array) {
			args.unshift(array);
			return Promise.reduceRight.apply(Promise, args);
		});
	}

	return when;
});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); });

},{"./lib/Promise":16,"./lib/TimeoutError":19,"./lib/decorators/array":21,"./lib/decorators/flow":22,"./lib/decorators/fold":23,"./lib/decorators/inspect":24,"./lib/decorators/iterate":25,"./lib/decorators/progress":26,"./lib/decorators/timed":27,"./lib/decorators/unhandledRejection":28,"./lib/decorators/with":29}]},{},[2,1]);