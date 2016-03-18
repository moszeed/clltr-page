(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.libary = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function() {

	"use strict";

    var embedlyUrl = "https://api.embed.ly/1/extract?key=35550e76c44048aa92ca559f77d2fd1e&format=json&url=";

    var request  = require("xhr");
    var _        = require("underscore");

    var Helper   = require('helper');
    var Backbone = require("drbx-js-backbone");


    var PromiseCache = {};

    var activateCache = true;
    var saveContent   = true;

	var Items = module.exports;

        Items.Model = Backbone.Model.extend({

            defaults: {

                name       : null,
                description: null,
                provider   : null,
                providerUrl: null,
                type       : 'link',
                created    : null,
                listId     : [],
                tags       : [],
                height     : null,


                url     : null,
                urlCache: null,

                faviconUrl     : null,
                faviconUrlCache: null,

                previewImageUrl     : null,
                previewImageUrlCache: null
            },

            initialize: function() {

                _.bindAll(this,
                    "addListById", "formatEmbedlyData",
                    "refreshData", "getUrlData", "setFaviconToCache",
                    "setPreviewImageToCache", "setImageToCache"
                );
            },

            /**
             * [getUrlData description]
             * @param  {[type]} url [description]
             * @return {[type]}     [description]
             */
            getUrlData: function(url) {

                return new Promise(function(resolve, reject) {

                    if (!url || url === null) {
                        throw new Error('no url given');
                    }

                    // call embedly, to get url data
                    request({ uri: embedlyUrl + url, json: true},
                        function requestResponse(err, response, body) {
                            if (err) reject(err);
                            else { resolve(body); }
                        });
                });
            },

            /**
             * [setFileToUrl description]
             * @param {[type]} url  [description]
             * @param {[type]} path [description]
             */
            setFileToUrl: function(url, path) {

                if (!url) throw new Error('no url given');
                if (!path) throw new Error('no path given');

                if (PromiseCache['setFileToUrl' + path]) {
                    return Promise.resolve();
                }

                PromiseCache['setFileToUrl' + path] = new Promise(
                    function(resolve, reject) {

                        var saveUrlError = function(err) {
                            console.log(err);
                            reject(err);
                        };

                        var saveUrl = function() {
                            return Backbone.DrbxJs.saveUrl(url, path)
                                .then(resolve)
                                .catch(saveUrlError);
                        };

                        // look if file is already available
                        PromiseCache['setFileToUrl' + path] = Backbone.DrbxJs.metadata(path)
                            .then(function getResponseMeta(responseMeta) {
                                if (responseMeta.isRemoved) {
                                    saveUrl();
                                } else {
                                    resolve();
                                }
                            })
                            .catch(saveUrl);
                    }
                );

                return PromiseCache['setFileToUrl' + path];
            },


            /**
             * CACHE FUNCTIONS
             */

            /**
             * [setFaviconToCache description]
             * @param {[type]} params [description]
             */
            setFaviconToCache: function(params) {

                // exist url to favicon
                // and a site provider for identification
                if (!params.faviconUrl ||
                    !params.provider) {
                    return Promise.resolve(params);
                }

                // set to params
                params.faviconUrlCache = '/cache/' + params.provider + '.ico';

                // cache it
                return this.setFileToUrl(params.faviconUrl, params.faviconUrlCache)
                    .then(function() {
                        return params;
                    });
            },

            /**
             * [setImageToCache description]
             * @param {[type]} params [description]
             */
            setImageToCache: function(params) {

                var that = this;
                if (params.type !== 'image' &&
                    params.type !== 'video') {
                    return Promise.resolve(params);
                }

                var imageFilename = Helper.getFilenameFromUrl(that.get('url'));
                params.urlCache = '/cache/images/' + params.provider + '/' + Date.now() + '_' + imageFilename;

                return this.setFileToUrl(that.get('url'), params.urlCache)
                    .then(function() {
                        return params;
                    });
            },

            /**
             * [setPreviewImageToCache description]
             * @param {[type]} params [description]
             */
            setPreviewImageToCache: function(params) {

                //add preview image to cache
                if (params.type !== 'video' ||
                    !params.previewImageUrl) {
                    return Promise.resolve(params);
                }

                params.previewImageUrlCache = '/cache/images/' + params.provider + '/' + Date.now() + '_' + params.name;

                return this.setFileToUrl(params.previewImageUrl, params.previewImageUrlCache)
                    .then(function() {
                        return params;
                    });
            },


            formatEmbedlyData: function(pageData) {

                pageData = pageData || {};

                //set default pageData
                var params = {
                    name       : pageData.title || this.get('url'),
                    type       : pageData.type || 'link',
                    description: pageData.description || '',
                    provider   : pageData.provider_name,
                    providerUrl: pageData.provider_url,
                    faviconUrl : pageData.favicon_url || null,
                    created    : Date.now()
                };

                if (pageData.type === 'html') {
                    params.type = 'link';
                }

                if (pageData.type === 'error') {
                    params.type = 'link';
                }

                //sort other media types
                if (pageData.media && pageData.type === 'html') {

                    if (pageData.media.type === 'video') {

                        params.name = Helper.getFilenameFromUrl(this.get('url'));
                        params.type = 'video';

                        if (params.provider === 'YouTube') {
                            params.name = params.name.substring(params.name.lastIndexOf('=') + 1);
                        }

                        //get preview url
                        if (pageData.images.length !== 0) {
                            params.previewImageUrl = pageData.images[0].url;
                        }

                    }

                    if (pageData.media.type === 'photo') {
                        params.type     = 'image';
                        params.height   = pageData.media.height || null;
                    }

                    if (pageData.media.type === 'rich') {
                        if (this.get('url').indexOf('soundcloud') !== -1) {
                            params.type = 'audio';
                        }
                    }
                }

                if (pageData.type === 'image') {

                    if (pageData.media.type === 'photo') {
                        params.type     = 'image';
                        params.height   = pageData.media.height || null;
                    }
                }

                return params;
            },

            refreshData: function(opts) {

                opts = opts || {};

                if (!opts.activateCache) opts.activateCache = activateCache;
                if (!opts.saveContent) opts.saveContent = saveContent;

                var that = this;
                return this.getUrlData(this.get('url'))
                    .then(function(data) {

                        var formattedData = that.formatEmbedlyData(data);

                        //first data
                        that.set(formattedData);

                        var promises = [];

                        if (opts.activateCache) {
                            promises.push(that.setFaviconToCache(formattedData));
                            promises.push(that.setPreviewImageToCache(formattedData));
                        }

                        if (opts.saveContent) {
                            promises.push(that.setImageToCache(formattedData));
                        }

                        return Promise.all(promises)
                            .then(function(responseData) {
                                var setData = _.extend(
                                    responseData[0], responseData[1], responseData[2]
                                );

                                //update data
                                that.set(setData);
                            })
                            .then(function() {
                                return that;
                            })
                            .catch(function(err) {
                                console.log('cache fail');
                                console.log(err);
                            });
                    });
            },

            addListById: function(listId) {

                if (!listId && listId.length === 0) {
                    throw new Error('no listId');
                }

                var listIds = this.get('listId');
                if (_.indexOf(listIds, listId) === -1) {
                    listIds.push(listId);
                    this.set({ 'listId': listIds });
                }
            }
        });

        Items.Collection = Backbone.Collection.extend({

            url  : 'items',
            model: Items.Model,

            revision: null,

            initialize: function() {

                _.bindAll(this, 'save', 'cachedFetch');

                this.listenTo(this, 'sync', function() {
                    this.saveToStorage();
                }.bind(this));
            },

            addAndGetData: function(params, opts) {

                params = params || {};
                opts   = opts || {};

                var model = this.add(params);

                return model.refreshData(opts);
            },

            search: function(inputString) {

                return _.compact(this.map(
                    function(listItem) {
                        if (listItem.get('url').indexOf(inputString) !== -1 ||
                            listItem.get('name').indexOf(inputString) !== -1 ||
                            listItem.get('description').indexOf(inputString) !== -1) {
                            return listItem;
                        }
                    }
                ));
            },

            cachedFetch: function(opts) {

                // get the dropbox user id
                var uid = Backbone.DrbxJs.Client._credentials.uid;

                // get storage data
                var storageData = this.getFromStorage();
                if (storageData && storageData.user === uid &&
                    storageData.revision === this.revision) {
                    this.add(storageData.data, opts);
                    return Promise.resolve();
                }

                return this.fetch(opts)
                    .catch(function(err) {
                        new Error(err);
                    });
            },

            getFromStorage: function() {

                var clltrStorageItems = localStorage.getItem('clltr_storage_items');
                if (clltrStorageItems) {
                    clltrStorageItems = JSON.parse(clltrStorageItems);
                }

                return clltrStorageItems;
            },

            saveToStorage: function() {

                var uid = Backbone.DrbxJs.Client._credentials.uid;

                // save to storage
                localStorage.setItem('clltr_storage_items', JSON.stringify({
                    user    : uid,
                    revision: this.revision,
                    data    : _.map(this.models, function(model) { return model.toJSON(); })
                }));
            },

            save: function() {

                if (this.models.length === 0) {
                    return Promise.resolve();
                }

                var responsePromise = null;
                this.each(function(model) {
                    responsePromise = model.save();
                });

                return responsePromise;
            }
        });


})();

},{"drbx-js-backbone":"drbx-js-backbone","helper":"helper","underscore":"underscore","xhr":"xhr"}],2:[function(require,module,exports){
(function() {

	"use strict";

    var _        = require("underscore");
    var Backbone = require("drbx-js-backbone");

    var Lists = module.exports;

        Lists.Model = Backbone.Model.extend({

            defaults: {
                id         : null,
                name       : null,
                description: null,
                position   : null,
                totalCount : 0
            },

            initialize: function() {
                _.bindAll(this, 'refreshTotalCount');
            },

            refreshTotalCount: function(collection) {

                if (!collection) {
                    throw new Error('no collection');
                }

                var filterResult = collection.filter(
                    function filterModelsWithListId(itemModel) {
                        return _.indexOf(itemModel.get('listId'), this.get('id')) !== -1;
                    }.bind(this));

                this.set({ 'totalCount': filterResult.length });
            }
        });

        Lists.Collection = Backbone.Collection.extend({

            url  : 'lists',
            model: Lists.Model,

            revision: null,

            comparator: function(model) {
                return -model.get("position");
            },

            initialize: function() {

                _.bindAll(this, 'save', 'cachedFetch');

                this.listenTo(this, 'sync', function() {
                    this.saveToStorage();
                }.bind(this));
            },

            cachedFetch: function(opts) {

                // get the dropbox user id
                var uid = Backbone.DrbxJs.Client._credentials.uid;

                // get storage data
                var storageData = this.getFromStorage();
                if (storageData && storageData.user === uid &&
                    storageData.revision === this.revision) {
                    this.add(storageData.data, opts);
                    return Promise.resolve();
                }

                return this.fetch(opts)
                    .catch(function(err) {
                        new Error(err);
                    });
            },

            getFromStorage: function() {

                var clltrStorageLists = localStorage.getItem('clltr_storage_lists');
                if (clltrStorageLists) {
                    clltrStorageLists = JSON.parse(clltrStorageLists);
                }

                return clltrStorageLists;
            },

            saveToStorage: function() {

                var uid = Backbone.DrbxJs.Client._credentials.uid;

                // save to storage
                localStorage.setItem('clltr_storage_lists', JSON.stringify({
                    user    : uid,
                    revision: this.revision,
                    data    : _.map(this.models, function(model) { return model.toJSON(); })
                }));
            },

            save: function() {

                if (this.models.length === 0) {
                    return Promise.resolve();
                }

                var responsePromise = null;
                this.each(function(model) {
                    responsePromise = model.save();
                });

                return responsePromise;
            }
        });

})();

},{"drbx-js-backbone":"drbx-js-backbone","underscore":"underscore"}],3:[function(require,module,exports){
(function() {

    "use strict";

    var Helper = require('helper');

    var Backbone = require('drbx-js-backbone');
        Backbone.init({
            client: { key: "38sn4xw32xtxi32" },
            auth  : new Backbone.DrbxJs.Dropbox.AuthDriver.Popup({
                receiverUrl : Helper.getCurrentUrl(),
                rememberUser: true
            })
        });

    var User = {};
        User.Model = Backbone.Model.extend({

            login: function(params) {

                params = params || {};

                if (params.token) {
                    return Backbone.init({
                        client: {
                            token: params.token
                        }
                    });
                }

                return Backbone.login()
                    .then(function() {
                        localStorage.setItem("alreadyAuthenticated", "true");
                    });
            },

            logout: function() {
                localStorage.clear();
            },

            isLoggedIn: function() {

                var isAuthenticated = Backbone.DrbxJs.Client.isAuthenticated();
                if (!isAuthenticated) {
                    if (localStorage.getItem('alreadyAuthenticated')) {
                        this.login();
                        isAuthenticated = true;
                    }
                }

                return isAuthenticated;
            }
        });

        module.exports = new User.Model();
})();

},{"drbx-js-backbone":"drbx-js-backbone","helper":"helper"}],4:[function(require,module,exports){
(function() {

    "use strict";

    var $        = require('jquery');
    var _        = require('underscore');
    var Backbone = require('drbx-js-backbone');
    var Helper   = require('helper');

    // get needed modules
    var User   = require('../modules/user.module.js');
    var Lists  = require('../modules/lists.module.js');
    var Items  = require('../modules/items.module.js');

    // load collections
    var cItems = new Items.Collection();
    var cLists = new Lists.Collection();

    // preload templates
    Backbone.View.preLoadTemplates([
        './templates/pages/libary/libary.list.html'
    ])

    // API Urls
    var ApiGetFileUrl   = Backbone.DrbxJs.Client._urls.getFile + "/";
    var ApiGetThumbnail = Backbone.DrbxJs.Client._urls.thumbnails + "/";

    // check if allowed to view this page
    if (!User.isLoggedIn()) {
        throw new Error('not logged in');
    }


    /**
     * [getDeltaData description]
     * @return {[type]} [description]
     */
    function getDeltaData() {

        return Backbone.DrbxJs.delta();
    }

    /**
     * [getVideoUrl description]
     * @param  {[type]} model     [description]
     * @param  {[type]} thumbnail [description]
     * @return {[type]}           [description]
     */
    function getDropboxFileApiUrl(filename, thumbnail) {

        var drbxFilePath       = ApiGetFileUrl;
        var drbxFilePathParams = '?access_token=' + Backbone.DrbxJs.Client._oauth._token;

        return drbxFilePath + filename + drbxFilePathParams;
    }

    /**
     * [getFaviconUrl description]
     * @param  {[type]} model [description]
     * @return {[type]}       [description]
     */
    function getFaviconUrl(model) {

        var drbxFilePath       = ApiGetFileUrl;
        var drbxFilePathParams = '?access_token=' + Backbone.DrbxJs.Client._oauth._token;

        if (model.get('faviconUrlCache')) {
            return  drbxFilePath +
                    Backbone.DrbxJs.Client._urlEncodePath(model.get('faviconUrlCache')) +
                    drbxFilePathParams;
        }

        return model.get('faviconUrl') || './images/favicon.ico';
    }

    /**
     * [getFaviconUrl description]
     * @param  {[type]} model [description]
     * @return {[type]}       [description]
     */
    function getImageUrl(model, thumbnail) {

        var drbxFilePath       = ApiGetFileUrl;
        var drbxFilePathParams = '?access_token=' + Backbone.DrbxJs.Client._oauth._token;

        var fileName = model.get('url');

        // handle images
        if (model.get('type') === 'image') {
            if (model.get('urlCache')) {
                fileName = model.get('urlCache');
            }
        }

        // handle videos
        if (model.get('type') === 'video') {

            if (model.get('urlCache')) {
                fileName = model.get('urlCache');
            }

            if (model.get('previewImageUrl')) {
                 fileName = model.get('previewImageUrl');
            }

            if (model.get('previewImageUrlCache')) {
                fileName = model.get('previewImageUrlCache')
            }
        }

        // currently partly disabled, dropbox has problems with files without .file-type
        if (thumbnail) {
            if (Helper.getFileTypeFromPath(fileName)) {
                drbxFilePath       = ApiGetThumbnail;
                drbxFilePathParams += '&size=l';
            }
        }

        return  drbxFilePath + fileName + drbxFilePathParams;
    }

    /**
     * [isElementInViewport description]
     * @param  {[type]}  el [description]
     * @return {Boolean}    [description]
     */
    function isElementInViewport(el) {

        //special bonus for those using jQuery
        if (typeof jQuery === "function" && el instanceof jQuery) {
            el = el[0];
        }

        var r, html;
        if ( !el || 1 !== el.nodeType ) { return false; }
        html = document.documentElement;
        r = el.getBoundingClientRect();

        return ( !!r
          && r.bottom >= 200
          && r.right >= 100
          && r.top <= html.clientHeight + 200
          && r.left <= html.clientWidth
        );
    }

    /**
     * [doBounce description]
     * @param  {[type]} element  [description]
     * @param  {[type]} times    [description]
     * @param  {[type]} distance [description]
     * @param  {[type]} speed    [description]
     * @return {[type]}          [description]
     */
    function doBounce(element, times, distance, speed) {

        for(var i = 0; i < times; i++) {
            element.animate({marginTop: '-='+distance}, speed)
                .animate({marginTop: '+='+distance}, speed);
        }
    }

    /**
     * [saveUrl description]
     * @param  {[type]} url         [description]
     * @param  {[type]} listId      [description]
     * @param  {[type]} saveContent [description]
     * @return {[type]}             [description]
     */
    function saveUrl(url, listId, saveContent) {

        if (!url) throw new Error('no url given');
        if (!listId) throw new Error('no listId given');

        var itemParams = {
            url   : url,
            listId: [listId]
        };

        var itemOpts = {
            saveContent: saveContent || true
        };

        return cItems.addAndGetData(itemParams, itemOpts)
            .then(function(model) {
                return model.save();
            })
            .catch(function(err) {
                console.log(err);
            });
    }

    //
    // Item Editor/Detail
    //

    var ItemEditor = {};
        ItemEditor.current = null;

        ItemEditor.View = Backbone.View.extend({

            className: 'item_editor hidden',

            events: {

                'click a': function(el) {
                    el.preventDefault();
                },

                'click .edit_icon'            : 'activateEditMode',
                'click label[for="edit_icon"]': 'activateEditMode',

                'click a.remove': function() {
                    cItems.get(this.itemId).destroy();
                },

                'keyup :input': _.debounce(function(el) {

                    var $target = $(el.target);
                    var $parent = $target.parent();

                    var model = cItems.get(this.itemId);
                    var key   = $parent.attr('class').split(' ')[1];

                    model.set(key, $target.val().trim());
                    model.save();

                }, 300)
            },

            activateEditMode: function() {


                var $a = this.$el.find('a');
                var $readonlyItems = this.$el.find('[readonly]');
                if ($readonlyItems.length === 0) {
                    this.$el.find(':input').attr('readonly', true);
                    $a.css('display', 'none');
                    return;
                }

                $a.css('display', 'block');
                $readonlyItems.removeAttr('readonly');
            },

            getIFrameUrl: function(model) {

                if (model.get('provider') === 'YouTube') {

                    var videoKey = model.get('url').split('&');
                        videoKey = _.find(videoKey, function(videoKeyItem) {
                            return videoKeyItem.indexOf('v=') !== -1;
                        });

                        videoKey = videoKey.split('v=')[1];

                    return 'https://www.youtube.com/embed/' + videoKey;
                }

                if (model.get('provider') === 'Vimeo') {

                    var videoKey = model.get('url').split('&');
                        videoKey = _.find(videoKey, function(videoKeyItem) {
                            return videoKeyItem.indexOf('vimeo.com/') !== -1;
                        });

                        videoKey = videoKey.split('vimeo.com/')[1];

                    return '//player.vimeo.com/video/' + videoKey;
                }

            },


            initialize: function() {

            },

            prepare: function(listId) {
                this.listId = listId;
                var $list = Libary.current.$el.find('.list.' + this.listId);
                this.$el.insertAfter($list);
            },

            render: function(model) {

                var modelParams = _.extend({}, model.attributes);

                if (model.get('type') === 'video') {
                    modelParams.urlIframe = this.getIFrameUrl(model);
                }

                if (modelParams.urlCache) {
                    modelParams.urlCache = getDropboxFileApiUrl(modelParams.urlCache);
                }

                this.itemId = model.id;
                this.template({
                    path   : './templates/pages/libary/libary.itemEditor.html',
                    params : modelParams,
                    success: function() {
                        this.$el.removeClass('hidden');
                    }.bind(this)
                });
            }
        });

        ItemEditor.openEditorByItemModel = function(model) {

            var listId = model.get('listId')[0];

            if (ItemEditor.current) {
                if (ItemEditor.current.listId !== listId) {
                    ItemEditor.current.remove();
                    ItemEditor.current = null;
                }
            }

            if (!ItemEditor.current) {
                ItemEditor.current = new ItemEditor.View();
                ItemEditor.current.prepare(listId);
            }

            Libary.current.$el.find('.listItem').removeClass('active');

            var $list = Libary.current.$el.find('.list.' + listId);
            var $item = $list.find('.listItem.' + model.id);
            if ($item.length !== 0) {
                $item.addClass('active');
            }

            var $itemEditor = ItemEditor.current;
                $itemEditor.render(model);
        };

    //
    // Item Search
    //

    var Search = {};

        Search.View = Backbone.View.extend({

            el     : '#head #search_results',
            itemTpl: _.template(
                '<div id="<%= id%>" class="searchItem">' +
                    '<span class="url"><%= url%></span>' +
                    '<span class="description"><%= description %></span>' +
                '</div>'
            ),

            events: {

                'click .searchItem': function(el) {
                    Libary.Events.trigger('itemSelected', $(el.currentTarget).attr('id'));
                    this.hide();
                },

                'click button': function() {

                    var $addNewItem = this.$el.find('.add_new_item');

                    var urlToAdd    = $('#actions .search').val();
                    var listId      = $addNewItem.find('.list select').val();
                    var contentSave = $addNewItem.find('.content_save input').val();

                    saveUrl(urlToAdd, listId, contentSave);

                    this.hide();
                }
            },

            hide: function() {
                this.$el.css('display', 'none');
            },

            refresh: function(searchString) {

                var $addItem = this.$el.find('.add_new_item');
                    $addItem.css('display', 'none');

                var searchResults = cItems.search(searchString);
                if (searchResults.length === 0) {
                    $addItem.css('display', 'block');
                }

                var resultFields  = _.map(searchResults,
                    function(searchItem) {
                        return this.itemTpl({
                            id         : searchItem.get('id'),
                            url        : searchItem.get('url'),
                            description: searchItem.get('description')
                        });
                    }.bind(this)
                );

                this.$el.find('.results').html(resultFields.join(''));
                this.$el.css('display', 'block');
            },

            render: function() {
                this.template({
                    path   : './templates/pages/libary/libary.search.html',
                    params : {
                        'lists': cLists.toJSON()
                    }
                });
            }
        });

    //
    // Head
    //

    var Head = {};

        Head.View = Backbone.View.extend({

            el    : '#head',
            events: {

                'keyup #actions .search': function(el) {

                    var searchString = $(el.target).val();
                    if (searchString.length >= 1) {
                        Search.current.refresh(searchString);
                    } else {
                        Search.current.hide();
                    }
                }
            }
        });


    //
    // Sidebar
    //

    var Sidebar = {};

        Sidebar.View = Backbone.View.extend({

            el: '#sidebar',

            events: {

                'click #lists .listItem': function(el) {

                    var $target = $(el.target);

                    var value = $target.attr('id');
                    if (!value) {
                        value = $target.parent().attr('id');
                    }

                    this.scrollToList(value);
                },

                'click #add_list': function() {

                    cLists.add({
                        name       : 'New List',
                        description: null,
                        position   : cLists.length + 1
                    });
                }
            },

            scrollToList: function(listId) {

                var $lists = $('#libary #lists');
                var $list = $lists.children('.list.' + listId);

                if (!isElementInViewport($list[0])) {
                    $lists.animate({
                        scrollLeft: $list.position().left
                    }, 500);
                }

                doBounce($list.find('.head'), 2, '10px', 200);
            },

            initialize: function() {
                this.listenTo(cLists, 'sync', this.render);
            },

            render: function() {

                var $empty_lists = this.$el.find('#empty_lists div');
                    $empty_lists.html('');

                var $list = this.$el.find('#lists');
                    $list.html('');

                cLists.each(function(listItem) {
                    if (listItem.get('totalCount') !== 0) {
                        $list.append(
                            '<div id="' + listItem.get('id') + '" class="listItem">' +
                                '<div class="listIcon"></div>' +
                                '<span>' + listItem.get('name') + '</span>' +
                            '</div>'
                        );
                    }
                });
            }
        });


    //
    // Libary
    //

    var Libary = {};

        Libary.vItem = Backbone.View.extend({

            events: {

                'click .url': function(el) {

                    el.preventDefault();
                    var win = window.open(this.model.get('url'), '_blank');
                        win.focus();
                    return false;
                },

                'click': function() {

                    if (ItemEditor.current) {
                        if (ItemEditor.current.itemId === this.model.id) {
                            ItemEditor.current.remove();
                            ItemEditor.current = null;
                            this.$el.removeClass('active');
                            return true;
                        }
                    }

                    ItemEditor.openEditorByItemModel(this.model);
                }
            },

            className: function() {
                return 'listItem ' + this.model.get('type') + ' ' + this.model.get('id');
            },

            loadSrcByUserViewPort: function() {

                var $img = this.$el.find('.loader');
                if ($img.length !== 0) {
                    if (isElementInViewport(this.$el[0])) {

                        var $nImg = $(document.createElement('img'));
                            $nImg.addClass('media_content');
                            $nImg.one('load', function() {
                                $img.replaceWith($nImg);
                            });

                            $nImg.attr('src', getImageUrl(this.model, true));
                    }
                }
            },

            initialize: function() {

                _.bindAll(this, 'loadSrcByUserViewPort');

                // refresh item on change
                this.listenTo(this.model, 'sync', function() {
                    this.render();
                    this.loadSrcByUserViewPort();
                }.bind(this));
            },

            render: function() {

                var type = this.model.get('type');
                if (type === null) {
                    type = 'link';
                }

                var typeName = type + 'Item';
                var fullPath = './templates/pages/libary/libary.' + typeName + '.html';

                this.$el.removeClass('locked');
                if (!this.model.get('id')) {
                    this.$el.addClass('locked');
                }

                var params   = _.extend({}, this.model.toJSON(), {
                    'faviconUrl'    : getFaviconUrl(this.model),
                    'dateFormated'  : Helper.timeConverter(this.model.get('created')),
                    'name_truncated': Helper.truncate(this.model.get('name'), 100),
                    'urlCache'      : getDropboxFileApiUrl(this.model.get('urlCache'))
                });

                return new Promise(function(resolve, reject) {
                    this.template({
                        path   : fullPath,
                        params : params,
                        success: function() {
                            resolve();
                        }
                    });
                }.bind(this));
            }
        });

        Libary.vList = Backbone.View.extend({

            items: [],

            className: function() {
                return 'list ' + this.model.get('id');
            },

            events: {

                'click .optionsItem.position .arrow_right' : function() {

                    var currentPosition = this.model.get('position');
                    if (currentPosition !== 1) {

                        var previousPosition = currentPosition - 1;
                        var previousModel = cLists.findWhere({
                            'position': previousPosition
                        })

                        previousModel.set('position', currentPosition);
                        this.model.set('position', previousPosition);
                        cLists.trigger('refresh');

                        this.model.save();
                    }
                },

                'click .optionsItem.position .arrow_left': function() {

                    var currentPosition = this.model.get('position');
                    if (currentPosition !== parseInt(cLists.length, 10)) {

                        var nextPosition = currentPosition + 1;
                        var previousModel = cLists.findWhere({
                            'position': nextPosition
                        })

                        previousModel.set('position', currentPosition);

                        this.model.set('position', nextPosition);
                        this.model.save().then(function() {
                            cLists.trigger('refresh');
                        })
                    }
                },

                'click .listOptions.options_icon': function() {
                    $(this.$el.find('.options')).slideToggle(300);
                },

                'click .options a': function(el) {
                    el.preventDefault();
                },

                'click .options a.remove': function() {

                    var listId = this.model.get('id');
                    var items  = cItems.models.filter(function(model) {
                        return _.indexOf(model.get('listId'), listId) !== -1;
                    });

                    if (items.length !== 0) {
                        alert('list not empty');
                        return true;
                    }

                    this.model.destroy();
                },

                'keyup .options :input': _.debounce(
                    function(el) {

                        var $parent = $(el.target).parent();

                        var target  = $parent.attr('class').split(' ')[1];
                        var value   = $(el.target).val();

                        this.model.set(target, value);
                        this.model.save();
                    }, 300
                )
            },

            initialize: function() {

                this.listenTo(this.model, 'change:name', this.refreshHead);
                this.listenTo(this.model, 'change:description', this.refreshHead);

                this.render();
            },

            checkItems: function() {
                _.each(this.items, function($item) {
                    $item.loadSrcByUserViewPort();
                }.bind(this));
            },

            addItem: function(model) {

                var $item = new Libary.vItem({ model: model });
                    $item.$el.prependTo(this.$el.find('.content'));

                this.items.push($item);

                return $item.render();
            },

            loadItems: function() {

                var $content = this.$el.find('.content');
                    $content.css('display', 'none');

                var promiseContainer = [];

                this.items = [];

                // append items to list
                _.each(cItems.models, function(mItem) {

                    if (!_.contains(mItem.get('listId'), this.model.get('id'))) {
                        return true;
                    }

                    promiseContainer.push(this.addItem(mItem));

                }.bind(this));

                // wait until all has loaded
                // then check if in viewport to load content
                // to avoid unnecessary loading of images
                Promise.all(promiseContainer)
                    .then(function() {
                        this.checkItems();
                    }.bind(this))


                $content.css('display', 'block');
            },

            refreshHead: function() {

                var $head = this.$el.find('.head');
                    $head.find('.listName').html(this.model.get('name'));
                    $head.find('.listDescription').html(this.model.get('description'));
            },

            render: function() {

                this.template({
                    path   : './templates/pages/libary/libary.list.html',
                    params : _.extend({}, this.model.toJSON(), {
                        'position_reversed': (this.model.collection.length + 1) -this.model.get('position')
                    }),
                    success: function() {

                        this.loadItems();

                        // activate scrolling check
                        this.$el.find('.content').off()
                            .on('scroll', _.debounce(function() {
                                this.checkItems();
                            }.bind(this), 100));

                    }.bind(this)
                });
            }
        });

        Libary.vLists = Backbone.View.extend({

            el: '#libary #lists',

            lists: {},

            initialize: function() {

                _.bindAll(this, 'checkLists', 'addList', 'removeList');

                this.listenTo(cLists, 'update', this.render);
                this.listenTo(cLists, 'refresh', function() {
                    this.render(true);
                }.bind(this));


                this.listenTo(cItems, 'add', function(model) {

                    var addedTolists = model.get('listId');
                    _.each(addedTolists, function(listId) {
                        this.lists[listId].addItem(model);
                    }.bind(this));
                }.bind(this));

                this.listenTo(cItems, 'remove', function(model) {

                    var removeFromLists = model.get('listId');
                    _.each(removeFromLists, function(listId) {

                        var foundItem = _.find(this.lists[listId].items, function(itemView) {
                            return itemView.model.get('id') === model.get('id');
                        });

                        foundItem.remove();

                    }.bind(this));

                    ItemEditor.current.remove();
                    ItemEditor.current = null;
                });

                this.$el.off().on('scroll', this.checkLists);
            },

            checkLists: _.debounce(function() {

                _.each(this.lists, function(list) {
                    list.checkItems();
                });
            }, 500),


            addList: function(mList) {

                if (!this.lists[mList.get('id')]) {

                    if (!mList.get('position')) {
                        var keyPos = mList.collection.models.indexOf(mList);
                        mList.set('position', parseInt(keyPos, 10) + 1);
                        mList.save();
                    }

                    var vList = new Libary.vList({ model: mList });
                        vList.$el.appendTo(this.$el);

                    this.lists[mList.get('id')] = vList;
                }
            },

            removeList: function(mList) {

                if (this.lists[mList.get('id')]) {
                    var $list = this.lists[mList.get('id')];
                        $list.remove();

                    delete this.lists[mList.get('id')];
                }
            },

            render: function(cleanReset) {

                if (cleanReset) {
                    this.lists = {};
                    cLists.sort();
                    this.$el.html('');
                }

                cLists.each(function(mList) {
                    this.addList(mList);
                }.bind(this));
            }
        });

        // initialize views
        Head.current    = new Head.View();
        Search.current  = new Search.View();
        Sidebar.current = new Sidebar.View();
        Libary.current  = new Libary.vLists();

        // get delta data for revision numbers
        getDeltaData()

            // refresh revision numbers
            .then(function(deltaData) {

                var itemsChanges = _.filter(deltaData.changes, { path: '/items' });
                if (itemsChanges.length === 1) {
                    cItems.revision = itemsChanges[0].stat._json.revision;
                }

                var listsChanges = _.filter(deltaData.changes, { path: '/lists' });
                if (listsChanges.length === 1) {
                    cLists.revision = listsChanges[0].stat._json.revision;
                }
            })
            // load content
            .then(function() {

                // get content from cache or fetch it
                var loadClist  = cLists.cachedFetch({ silent: true });
                var loadCItems = cItems.cachedFetch({ silent: true });

                // first list fetch silent to know when to start
                // fetching items
                return Promise.all([loadClist, loadCItems])
                    .then(function() {

                        Search.current.render();
                        Libary.current.render();
                        Sidebar.current.render();
                    });
            })
            .catch(function(err) {
                throw new Error(err);
            });

})();

},{"../modules/items.module.js":1,"../modules/lists.module.js":2,"../modules/user.module.js":3,"drbx-js-backbone":"drbx-js-backbone","helper":"helper","jquery":"jquery","underscore":"underscore"}]},{},[4])(4)
});