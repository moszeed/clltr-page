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
                if (params.type !== 'image') {
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
                if (params.type !== 'video' &&
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

            initialize: function() {
                _.bindAll(this, 'save');
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

            comparator: function(model) {
                return model.get('name');
            },

            initialize: function() {
                _.bindAll(this, 'save');
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

    // API Urls
    var ApiGetFileUrl = Backbone.DrbxJs.Client._urls.getFile + "/";

    // check if allowed to view this page
    if (!User.isLoggedIn()) {
        throw new Error('not logged in');
    }


    /**
     * [getFaviconUrl description]
     * @param  {[type]} model [description]
     * @return {[type]}       [description]
     */
    function getFaviconUrl(model) {

        if (model.get('faviconUrlCache')) {
            return ApiGetFileUrl + Backbone.DrbxJs.Client._urlEncodePath(model.get('faviconUrlCache')) +
                '?access_token=' + Backbone.DrbxJs.Client._oauth._token;
        }

        return model.get('faviconUrl') || './images/favicon.ico';
    }

    /**
     * [getFaviconUrl description]
     * @param  {[type]} model [description]
     * @return {[type]}       [description]
     */
    function getImageUrl(model) {

        if (model.get('type') === 'image') {
            if (model.get('urlCache')) {
                return ApiGetFileUrl + Backbone.DrbxJs.Client._urlEncodePath(model.get('urlCache')) +
                    '?access_token=' + Backbone.DrbxJs.Client._oauth._token;
            }

            return model.get('url');
        }

        if (model.get('type') === 'video') {

            if (model.get('previewImageUrlCache')) {
                return ApiGetFileUrl + Backbone.DrbxJs.Client._urlEncodePath(model.get('previewImageUrlCache')) +
                    '?access_token=' + Backbone.DrbxJs.Client._oauth._token;
            }

            return model.get('previewImageUrl');
        }
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

        var rect = el.getBoundingClientRect();

        return (
            rect.top >= -500 &&
            rect.left >= -700 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) + 500 &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth) + 700
        );
    }



    var Libary = {};
        Libary.Events = _.extend({}, Backbone.Events);

        /**
         *  Widgets

        Libary.EditLists = Widget.View.extend({

            events: {

                'change .listItem :input': function(el) {

                    var $el = $(el.target);
                    var $parent = $el.parent();

                    var keyName = $el.attr('class');
                    var listId = $parent.attr('class').split(' ')[1];

                    var listModel = cLists.get(listId);
                        listModel.set(keyName, $el.val());
                        listModel.save();
                },

                'click .close': function() {
                    this.remove();
                },

                'click #addListItem .addItem': function() {

                    var $addListItem = this.$el.find('#addListItem');
                    if ($addListItem.find('input').val() !== '') {

                        cLists.add({
                            name       : $addListItem.find('input').val(),
                            description: $addListItem.find('textarea').val()
                        });

                        $addListItem.find(':input').val('');
                        this.showLists();
                    }

                    cLists.save()
                        .then(function() {
                            this.showLists();
                        }.bind(this));
                },

                'click .listItem .removeItem': function(el) {

                    var $el = $(el.target);
                    var $parent = $el.parent();

                    var listId = $parent.attr('class').split(' ')[1];

                    var mList = cLists.get(listId);
                    if (mList.get('totalCount') !== 0) {
                        alert('list not empty');
                        return;
                    }

                    cLists.remove(listId);
                    this.showLists();
                }
            },

            showLists: function() {

                var tpl = _.template("<div class='listItem <%= id%>'>" +
                    "<input class='name' value='<%= name %>'>" +
                    "<textarea class='description'><%= description%></textarea>" +
                    "<button class='removeItem'>remove</button>" +
                "</div>");

                var listItems = [];
                cLists.each(function(listModel) {
                    listItems.push(tpl(listModel.pick('id', 'name', 'description')));
                });

                this.$el.find('#availableLists').html(listItems.join(''));
            },

            initialize: function() {

                _.bindAll(this, 'showLists');

                this.render('editlists')
                    .then(this.showLists);
            }
        });

        Libary.EditItem = Widget.View.extend({

            events: {

                'click .close': function() {
                    this.remove();
                },

                'click .delete': function() {
                    this.remove();
                },

                'change .list_data select': function(el) {

                    var $option = $(el.target).find(':selected');
                    var listId = $option.attr('id');
                    if (!listId) {
                        throw new Error('no listId');
                    }

                    this.model.save({
                        'listId': [listId]
                    });
                }
            },

            loadUrl: function(url, saveContent) {

                cItems.addAndGetData({ url: url }, {
                        saveContent: saveContent || true
                    })
                    .then(function(model) {
                        this.model = model;
                    }.bind(this))
                    .then(this.refresh)
                    .then(cItems.save)
                    .catch(function(err) {
                        console.log(err);
                    });
            },

            refresh: function() {

                if (!this.model) {
                    throw new Error('no model given');
                }

                this.render('edititem', {
                    lists     : cLists.toJSON(),
                    attributes: _.extend(this.model.toJSON(), {
                        'faviconUrl': getFaviconUrl(this.model)
                    })
                });
            },

            initialize: function() {
                _.bindAll(this, 'loadUrl', 'refresh');
            }
        });

        Libary.DeleteItem = Widget.View.extend({

            events: {

                'click .close': function() {
                    this.remove();
                },

                'click .delete': function() {

                    var collection = this.model.collection;
                    this.model.destroy();
                    collection.save();
                    this.remove();
                }
            },

            initialize: function() {
                this.render('deleteItem');
            }
        });

        */


        Libary.EditLists = Backbone.View.extend({

            events: {

                'change .listItem :input': function(el) {

                    var $el = $(el.target);
                    var $parent = $el.parent();

                    var keyName = $el.attr('class');
                    var listId = $parent.attr('class').split(' ')[1];

                    var listModel = cLists.get(listId);
                        listModel.set(keyName, $el.val());
                        listModel.save();
                },

                'click .close': function() {
                    $('#widget').remove();
                },

                'click #addListItem .addItem': function() {

                    var $addListItem = this.$el.find('#addListItem');
                    if ($addListItem.find('input').val() !== '') {

                        cLists.add({
                            name       : $addListItem.find('input').val(),
                            description: $addListItem.find('textarea').val()
                        });

                        $addListItem.find(':input').val('');
                        this.showLists();
                    }

                    cLists.save()
                        .then(function() {
                            this.showLists();
                        }.bind(this));
                },

                'click .listItem .removeItem': function(el) {

                    var $el = $(el.target);
                    var $parent = $el.parent();

                    var listId = $parent.attr('class').split(' ')[1];

                    var mList = cLists.get(listId);
                    if (mList.get('totalCount') !== 0) {
                        alert('list not empty');
                        return;
                    }

                    cLists.remove(listId);
                    this.showLists();
                }
            },


            buildWidget: function() {

                // remove widget if already available
                var $widget = $('#widget');
                if ($widget.length === 1) {
                    $widget.remove();
                }

                // create widget
                $widget = $('<div id="widget"></div>');
                $widget.css('display', 'block');
                $widget.appendTo('body');

                // create widget parts
                var $widgetOverlay = $('<div id="widgetOverlay"></div>');
                    $widgetOverlay.appendTo($widget);

                var $widgetContent = $('<div id="widgetContent" class="editLists"></div>');
                    $widgetContent.appendTo($widget);
            },

            initialize: function() {
                this.buildWidget();
                this.render();
            },

            showLists: function() {

                var tpl = _.template("<div class='listItem <%= id%>'>" +
                    "<input class='name' value='<%= name %>'>" +
                    "<textarea class='description'><%= description%></textarea>" +
                    "<button class='removeItem'>remove</button>" +
                "</div>");

                var listItems = [];
                cLists.each(function(listModel) {
                    listItems.push(tpl(listModel.pick('id', 'name', 'description')));
                });

                this.$el.find('#availableLists').html(listItems.join(''));
            },

            render: function() {
                this.template({
                    path   : './templates/widgets/editlists.widget.html',
                    success: function() {
                        $('#widgetContent').html(this.$el)
                        this.showLists();
                    }.bind(this)
                });
            }

        });

        Libary.EditItem = Backbone.View.extend({

            events: {

                'click .close': function() {
                    $('#widget').remove();
                },

                'click .delete': function() {
                    console.log('implement me');
                },

                'change input, textarea': function(el) {

                    var name  = $(el.target).attr('class');
                    var value = $(el.target).val();

                    this.model.set(name, value);
                    this.model.save();
                },

                'change .list_data select': function(el) {

                    var $option = $(el.target).find(':selected');
                    var listId = $option.attr('id');
                    if (!listId) {
                        throw new Error('no listId');
                    }

                    this.model.save({
                        'listId': [listId]
                    });
                }
            },

            loadUrl: function(url, saveContent) {

                cItems.addAndGetData({ url: url }, { saveContent: saveContent || true })
                    .then(function(model) {
                        this.model = model;
                    }.bind(this))
                    .then(this.refresh)
                    .then(cItems.save)
                    .catch(function(err) {
                        console.log(err);
                    });
            },

            refresh: function() {

                if (!this.model) {
                    throw new Error('no model given');
                }

                this.buildWidget();
                this.render();
            },

            initialize: function() {
                _.bindAll(this, 'loadUrl', 'refresh', 'buildWidget', 'render');
            },

            buildWidget: function() {

                // remove widget if already available
                var $widget = $('#widget');
                if ($widget.length === 1) {
                    $widget.remove();
                }

                // create widget
                $widget = $('<div id="widget"></div>');
                $widget.css('display', 'block');
                $widget.appendTo('body');

                // create widget parts
                var $widgetOverlay = $('<div id="widgetOverlay"></div>');
                    $widgetOverlay.appendTo($widget);

                var $widgetContent = $('<div id="widgetContent" class="editItem"></div>');
                    $widgetContent.appendTo($widget);
            },

            render: function() {

                this.template({
                    path  : './templates/widgets/edititem.widget.html',
                    params: {
                        lists     : cLists.toJSON(),
                        attributes: _.extend(this.model.toJSON(), {
                            'faviconUrl': getFaviconUrl(this.model)
                        })
                    },
                    success: function() {
                        $('#widgetContent').html(this.$el)
                    }.bind(this)
                });
            }
        });

        Libary.DeleteItem = Backbone.View.extend({

            events: {

                'click .close': function() {
                    $('#widget').remove();
                },

                'click .delete': function() {

                    var collection = this.model.collection;
                    this.model.destroy();
                    collection.save();
                    $('#widget').remove();
                }
            },

            buildWidget: function() {

                // remove widget if already available
                var $widget = $('#widget');
                if ($widget.length === 1) {
                    $widget.remove();
                }

                // create widget
                $widget = $('<div id="widget"></div>');
                $widget.css('display', 'block');
                $widget.appendTo('body');

                // create widget parts
                var $widgetOverlay = $('<div id="widgetOverlay"></div>');
                    $widgetOverlay.appendTo($widget);

                var $widgetContent = $('<div id="widgetContent" class="deleteItem"></div>');
                    $widgetContent.appendTo($widget);
            },

            initialize: function() {
                this.buildWidget();
                this.render();
            },

            render: function() {
                this.template({
                    path   : './templates/widgets/deleteitem.widget.html',
                    success: function() {
                        $('#widgetContent').html(this.$el)
                    }.bind(this)
                });
            }
        });






        /**
         * Page Items
         */

        Libary.Search = Backbone.View.extend({

            el: '#search_results',

            events: {

                'click .searchItem': function(el) {
                    Libary.Events.trigger('itemSelected', $(el.currentTarget).attr('id'));
                    this.hide();
                },

                'click button': function() {

                    var urlToAdd    = $('#actions .search').val();
                    var saveContent = this.$el.find('.addNew input').is(':checked');

                    var editItemWidget = new Libary.EditItem();
                        editItemWidget.loadUrl(urlToAdd, saveContent);

                    this.hide();
                }
            },

            hide: function() {
                this.$el.css('display', 'none');
                this.$el.html('');
            },

            render: function(inputString) {

                this.$el.css('display', 'block');

                var addTpl = '<div class="addNew">' +
                    '<button>add</button>' +
                    '<input type="checkbox" checked="true"><span>save content (image) to Dropbox</span>' +
                    '</div>';

                var searchResult = cItems.search(inputString);
                if (searchResult.length === 0) {
                    this.$el.html(addTpl);
                    return;
                }

                var searchResultElements = _.map(searchResult, function(searchItem) {
                    return '<div id="' + searchItem.get('id') + '" class="searchItem">' +
                        '<span>' + Helper.truncate(searchItem.get('url'), 40, '..') + '</span>' +
                        '<span class="description">' + Helper.truncate(searchItem.get('description'), 40, '..') +
                        '</span></div>';
                });

                this.$el.html(searchResultElements.join(''));
            }
        });


        Libary.Item = Backbone.View.extend({

            events: {

                'click .url': function() {
                    var win = window.open(this.model.get('url'), '_blank');
                        win.focus();
                    return false;
                },

                'click .name': function() {
                    var $extend = this.$el.find('.extend');
                    var displayAction = ($extend.is(':visible')) ? 'none' : 'block';
                    $extend.css('display', displayAction);
                },

                'click .extend_me': function() {
                    var $extend = this.$el.find('.extend');
                    var displayAction = ($extend.is(':visible')) ? 'none' : 'block';
                    $extend.css('display', displayAction);
                },


                'click .control .edit': function() {
                    var widget = new Libary.EditItem({ model: this.model });
                        widget.refresh();
                },

                'click .control .delete': function() {
                    var widget = new Libary.DeleteItem({ model: this.model });
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


                            $nImg.attr('src', getImageUrl(this.model));
                    }
                }
            },

            initialize: function() {

                _.bindAll(this, 'loadSrcByUserViewPort');

                // refresh item on change
                this.listenTo(this.model, 'sync', function() {
                    this.render();
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
                    'name_truncated': Helper.truncate(this.model.get('name'), 100)
                });

                this.template({
                    path   : fullPath,
                    params : params,
                    success: this.loadSrcByUserViewPort
                });
            }
        });

        Libary.List = Backbone.View.extend({

            className: function() {
                return 'list ' + this.model.get('id');
            },

            initialize: function() {

                _.bindAll(this, 'saveTotalCount', 'checkItems');

                var that = this;

                    that.itemViews  = [];

                    // on list change rerender
                    that.listenTo(that.model, 'change:id', function() {
                        that.$el.removeClass().addClass(that.className());
                    });

                    that.collection = new (Backbone.Collection.extend({
                        comparator: function(model) {
                            return model.get('url');
                        }
                    }));

                    that.listenTo(that.collection, 'add', function(model) {
                        that.addItem(model);
                        that.saveTotalCount();
                    });

                    that.listenTo(that.collection, 'remove', function() {
                        that.removeItem();
                        that.saveTotalCount();
                    });

                    that.render();
            },

            moveItem: function(model) {
                this.removeItem(model);
                this.trigger('moveItem', model);
            },

            removeItem: function(model) {

                if (!model) {
                    throw new Error('no model given');
                }

                var filterResponse = _.filter(this.itemViews,
                    function(itemView) {
                        return itemView.model.get('id') === model.get('id');
                    });

                _.each(filterResponse, function(view) {
                    view.remove();
                });
            },

            addItem: function(model) {

                if (!model) {
                    throw new Error('no model given');
                }

                var viewItem = new Libary.Item({ model: model });
                    viewItem.$el.prependTo(this.$el.find('.content'));
                    viewItem.render();

                this.listenTo(viewItem.model, 'change:listId', this.moveItem);
                this.itemViews.push(viewItem);

                $('#libary .no_content').css('display', 'none');
                this.$el.css('display', 'inline-block');
            },

            saveTotalCount: function() {
                this.model.set({ 'totalCount': this.collection.length });
                this.model.save();
            },

            checkItems: function() {
                _.each(this.itemViews, function(itemView) {
                    itemView.loadSrcByUserViewPort();
                });
            },

            render: function() {

                var that = this;
                return new Promise(
                    function(resolve) {

                        this.template({
                            path   : './templates/pages/libary/libary.list.html',
                            params : this.model.toJSON(),
                            success: function() {

                                that.$el.find('.content').off()
                                    .on('scroll', _.debounce(function() {
                                        that.checkItems();
                                    }, 100));

                                resolve();
                            }
                        });

                    }.bind(this));
            }
        });

        Libary.Lists = Backbone.View.extend({

            el: '#libary #lists',

            unsortedId: 'unsorted',

            initialize: function() {

                _.bindAll(this, 'addList', 'addListForUnsortedItems',
                    'addItemToList', 'refresh', 'render', 'checkLists'
                );

                this.listItems = [];

                this.listenTo(cLists, 'add', this.addList);
                this.listenTo(cItems, 'add', this.addItemToList);

                this.$el.off().on('scroll', this.checkLists);
            },

            checkLists: _.debounce(function() {
                _.each(this.listItems, function(listView) {
                    listView.checkItems();
                });
            }, 100),

            addList: function(model) {

                var view = new Libary.List({ model: model });
                    view.$el.appendTo(this.$el);

                this.listenTo(view, 'moveItem', this.moveListItem);

                this.listItems.push(view);
                return view.render();
            },

            moveListItem: function(model) {

                this.addItemToList(model);
            },

            addListForUnsortedItems: function() {

                // check if already added
                var hasUnsortedItem = _.filter(this.listItems, function(listItem) {
                    return listItem.model.get('unsorted');
                });

                if (hasUnsortedItem.length === 0) {
                    this.addList(new Lists.Model({
                        id         : this.unsortedId,
                        name       : 'unsorted',
                        description: 'unsorted list'
                    }));
                }
            },

            addItemToList: function(model) {

                var listId = _.first(model.get('listId'));
                if (!listId) {
                    listId = this.unsortedId;
                }

                var listViews = _.filter(this.listItems, function(listItem) {
                    return listItem.model.get('id') === listId;
                });

                _.each(listViews, function(listView) {
                    listView.collection.add(model);
                });
            },

            refresh: function() {

                this.addListForUnsortedItems();
                return cLists.fetch()
                    .catch(function(err) {
                        throw new Error(err);
                    });
            },

            render: function() {

                var promises = [];
                if (cLists.length !== 0) {
                    cLists.forEach(function(model) {
                        promises.push(this.addList(model));
                    }.bind(this));
                }

                return Promise.all(promises);
            }
        });


        /**
         * Libary
         */

        Libary.Head = Backbone.View.extend({

            el    : '#head',
            events: {

                'keyup #actions .search': function(el) {

                    var searchString = $(el.target).val();
                    if (searchString.length >= 1) {
                        this.vSearch.render(searchString);
                    } else {
                        this.vSearch.hide();
                    }
                }
            },

            initialize: function() {
                this.vSearch = new Libary.Search();
            }
        });

        Libary.Sidebar = Backbone.View.extend({

            el    : '#sidebar',
            events: {

                'click #lists .listItem': function(el) {

                    var value = $(el.target).attr('id');
                    if (!value) {
                        value = $(el.target).parent().attr('id');
                    }

                    this.trigger('listSelected', value);
                },

                'click #lists_actions .edit': function() {
                    this.editListWidget = new Libary.EditLists();
                }
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
                        $list.append('<div id="' + listItem.get('id') + '" class="listItem">' +
                        '<div class="listIcon"></div><span>' +
                        listItem.get('name') + '</span></div>');
                    }
                });
            }
        });

        Libary.View = Backbone.View.extend({


            initialize: function() {

                _.bindAll(this, 'refresh', 'render');


                function doBounce(element, times, distance, speed) {
                    for(var i = 0; i < times; i++) {
                        element.animate({marginTop: '-='+distance}, speed)
                            .animate({marginTop: '+='+distance}, speed);
                    }
                }


                this.vHead = new Libary.Head();
                this.vLists = new Libary.Lists();
                this.vSidebar = new Libary.Sidebar();


                this.listenTo(Libary.Events, 'itemSelected', function(itemId) {

                    var selectedItem = cItems.findWhere({
                        id: itemId
                    });

                    var listId = selectedItem.get('listId')[0] || null;
                    if (listId) {
                        this.vSidebar.trigger('listSelected', listId);
                    }
                });

                this.listenTo(this.vSidebar, 'listSelected', function(listId) {

                    var $lists = $('#libary #lists');
                    var $list = $lists.children('.list.' + listId);

                    $lists.animate({
                        scrollLeft: $list.position().left
                    }, 500);

                    doBounce($list, 2, '5px', 200);
                });


                this.refresh();
            },


            refreshList: function() {
                return this.vLists.refresh()
                    .catch(function(err) {
                        console.log('[err] fail to load list:' + err);
                    });
            },


            refresh: function() {

                return this.refreshList()
                    .then(function() {
                        return cItems.fetch();
                    })
                    .catch(function(err) {
                        console.log('[err] fail to refresh: ', err);
                        $('#libary .no_content').css('display', 'block');
                    });

            }
        });


        Libary.current = new Libary.View();
})();

},{"../modules/items.module.js":1,"../modules/lists.module.js":2,"../modules/user.module.js":3,"drbx-js-backbone":"drbx-js-backbone","helper":"helper","jquery":"jquery","underscore":"underscore"}]},{},[4])(4)
});