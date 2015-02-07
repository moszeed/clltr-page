require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function() {

    "use strict";

    var $               = require('jquery');
    var _               = require('underscore');
    var when            = require('when');

    var Backbone        = require('backbone');
        Backbone.$      = $;

    var Router          = require('./modules/router.module.js').init();
        Router.httpsCheck();

    var App = module.exports;

        App.View = Backbone.View.extend({

            initialize : function() {

                $('#impressumLink').on('click', function() {
                    Router.changePage('impressum');
                });
            }
        });

        $(document).ready(function() {
            new App.View();
        });
})();

},{"./modules/router.module.js":6,"backbone":"DIOwA5","jquery":"QRCzyp","underscore":"s12qeW","when":"My0/Wt"}],2:[function(require,module,exports){
(function() {

    "use strict";

    var Helper = module.exports;

        Helper.getCurrentUrl = function() {

            var parser      = document.createElement('a');
                parser.href = document.URL;

            var port = parser.port;
            if (port !== '') {
                port = ":" + port;
            }

            var pathname = parser.pathname;
            if (pathname !== '') {
                pathname = "/" + pathname;
            }

            return  parser.protocol + "//" +
                    parser.hostname + port + parser.pathname;
        };

        Helper.truncate = function(string, length) {

            if (!string) {
                return '';
            }

            if (string.length <= length) {
                return string;
            }

            return string.substring(0, length) + '..';
        };

        Helper.timeConverter = function(timestamp) {

            if (String(timestamp).length === 14) {
                timestamp = timestamp * 1000;
            }

            var a = new Date(timestamp);
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var year = a.getFullYear();

            var month = months[a.getMonth() - 1];
            var date = ('0' + a.getDate()).slice(-2);
            var hour = ('0' + a.getHours()).slice(-2);
            var min = ('0' + a.getMinutes()).slice(-2);
            var sec = ('0' + a.getSeconds()).slice(-2);

            var time = date + '.' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;

            return time;
        };

        Helper.capitaliseFirstLetter = function(string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        };

        Helper.showError = function(err) {
            console.log('ERR:', err);
            throw new Error(err);
        };

})();

},{}],3:[function(require,module,exports){
(function() {

    "use strict";

    var $               = require('jquery');
    var _               = require('underscore');
    var when            = require('when');

    var User            = require('./user.module.js');

    var Backbone        = require('backbone');
        Backbone.setClient(User.getDbClient());


    var List = module.exports;
        List.Model = Backbone.Model.extend({

            embedlyUrl  : "https://api.embed.ly/1/extract?key=35550e76c44048aa92ca559f77d2fd1e&format=json&url=",
            defaults    : {

                url             : null,
                name            : null,
                type            : null,
                tags            : [],
                height          : null,
                provider        : null,
                providerUrl     : null,
                media_id        : null,
                description     : null,
                previewImageUrl : null,
                favicon_url     : null,
                created         : null
            },

            validate    : function() {

                return !this.store;
            },

            formatData  : function(pageData) {

                pageData = pageData || {};

                var params = {
                    name            : pageData.title || this.get('url'),
                    description     : pageData.description || '',
                    type            : pageData.type || null,
                    provider        : pageData.provider_name,
                    providerUrl     : pageData.provider_url,
                    previewImageUrl : null,
                    favicon_url     : pageData.favicon_url || null,
                    created         : Date.now()
                };

                //sort other media types
                if (pageData.media && pageData.type === 'html') {

                    if (pageData.media.type === 'video') {

                        params.type = 'video';

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

                if (params.type === 'html') {
                    params.type = 'link';
                }

                return params;
            },

            setSoundcloudData : function() {

                var that = this;

                if (that.get('url').indexOf('soundcloud') === -1) {
                    return true;
                }

                return when.promise(function(resolve, reject) {
                    $.get('http://api.soundcloud.com/resolve.json?url='+
                        that.get('url') + '/tracks&client_id=c19250610bdd548e84df2c91e09156c9' , function (result) {

                            that.set({
                                media_id        : result.id             || null,
                                previewImageUrl : result.artwork_url    || null
                            });

                            resolve();
                        });
                });
            },

            refresh   : function() {

                var that = this;

                return when.promise(function(resolve, reject) {

                    $.ajax({
                        url: that.embedlyUrl + that.get('url'),
                        success : function(data) {

                            //set formatted data
                            that.set(that.formatData(data));

                            var promises = [];

                            //try to get soundcloud data
                            if (that.get('type') === 'audio') {
                                promises.push(that.setSoundcloudData());
                            }

                            when.all(promises)
                                .done(function() {
                                    resolve(data);
                                });
                        },
                        error : function(err) {
                            console.log('fail to load from: ' + that.get('url'));
                            console.log('ERR: ', err);
                            resolve();
                        }
                    });
                });
            }
        });

        List.Collection = Backbone.Collection.extend({

            model       : List.Model,

            refresh     : function(filter) {

                var that = this;

                return when.promise(function(resolve, reject) {

                    that.reset();
                    that.fetch({
                        filter  : filter,
                        update  : true,
                        success : resolve,
                        error   : reject
                    });
                });
            },

            initialize  : function(params) {

                _.bindAll(this, 'refresh');

                params = params || {};

                if (!params.store) {
                    throw new Error('no store name given');
                }

                this.store = params.store;

                var that = this;
                    that.on('add', function(model) {
                        model.store = that.store;
                    });
            },

            save : function() {

                var that = this;
                    that.each(function(model) {
                        model.store = that.store;
                        model.save();
                    });
            }
        });

})();

},{"./user.module.js":8,"backbone":"DIOwA5","jquery":"QRCzyp","underscore":"s12qeW","when":"My0/Wt"}],4:[function(require,module,exports){
(function() {

    "use strict";

    var User            = require('./user.module.js');

    var when            = require('when');
    var _               = require('underscore');
    var Backbone        = require('backbone');
        Backbone.setClient(User.getDbClient());


    var Lists = module.exports;

        Lists.Model = Backbone.Model.extend({

            store       : 'lists',
            defaults    : {
                id          : null,
                name        : null,
                description : null,
                totalCount  : 0
            }
        });

        Lists.Collection = Backbone.Collection.extend({

            model       : Lists.Model,

            store       : 'lists',
            comparator  : 'name',

            refresh : function() {

                var that = this;
                return when.promise(function(resolve, reject) {
                    that.fetch({
                        reset   : true,
                        success : resolve,
                        error   : reject
                    });
                });
            },

            save : function() {

                var that = this;
                    that.each(function(model) {
                        model.save();
                    });
            }


        });

})();

},{"./user.module.js":8,"backbone":"DIOwA5","underscore":"s12qeW","when":"My0/Wt"}],5:[function(require,module,exports){
(function() {

    "use strict";

    var $           = require('jquery');
    var _           = require('underscore');
    var Backbone    = require('backbone');
        Backbone.$  = $;

    //get template functions
    require('backbone_template');


    var Main = module.exports;

        Main.View = Backbone.View.extend({

            el          : '#main',
            render      : function(page_name) {

                var that = this;

                    if (page_name           === void 0 ||
                        page_name.length    === 0) {
                        throw new Error('no page_name given');
                    }

                    that.template({
                        path    : './templates/pages/' + page_name + '.html',
                        success : function() {

                            that.$el
                                .removeClass()
                                .addClass(page_name);

                            that.require = require('./client/scripts/pages/' + page_name.toLowerCase() + '.page.js');
                            that.page    = new that.require.View();
                        }
                    });
            }
        });

})();

},{"backbone":"DIOwA5","jquery":"QRCzyp","underscore":"s12qeW"}],6:[function(require,module,exports){
(function() {

    "use strict";


    var $           = require('jquery');
    var _           = require('underscore');
    var Backbone    = require('backbone');
        Backbone.$  = $;

    var User        = require('./user.module.js');
    var Main        = require('./main.module.js');
    var Dropbox     = require('dropbox');
    var Delicious   = require('backbone_delicious');

    var Router      = {};

        Router.Main = Backbone.Router.extend({

            routes : {
                '*path' : 'default'
            },

            httpsCheck : function() {

                var parser      = document.createElement('a');
                    parser.href = document.URL;

                if (parser.hostname === 'localhost') {
                    return;
                }

                var port = parser.port;
                if (port !== '') {
                    port = ":" + port;
                }

                var host = parser.hostname + port;
                if (host == window.location.host &&
                    window.location.protocol != "https:") {
                    window.location.protocol = "https";
                }

            },

            getCurrentPage  : function() {
                return Backbone.history.fragment;
            },

            refreshPage     : function() {
                Backbone.history.loadUrl(Backbone.history.fragment);
            },

            changePage      : function(pagename, opts) {

                opts        = opts      || { trigger : true };
                pagename    = pagename  || "whatis";

                if (pagename !== 'impressum') {
                    if (!User.isLoggedIn()) {
                        pagename = "whatis";
                    }
                }

                this.navigate(pagename, opts);
                this.vMain.render(pagename);
            },

            initialize      : function(opts) {

                opts = opts || {};

                var that = this;
                    that.vMain = new Main.View();
                    that.on('route:default', function(pagename) {

                        if (pagename !== null && pagename.indexOf('access_token') !== -1) {
                            Dropbox.AuthDriver.Popup.oauthReceiver();
                            return;
                        }

                        if (that.getCurrentPage() === pagename) {
                            this.vMain.render(pagename);
                            return;
                        }

                        that.changePage(pagename, {});
                    });
            }
        });

        module.exports.init = function(targetView) {

            window.rRouter = new Router.Main();
            Backbone.history.start();

            return window.rRouter;
        };
})();

},{"./main.module.js":5,"./user.module.js":8,"backbone":"DIOwA5","dropbox":"tBYV3e","jquery":"QRCzyp","underscore":"s12qeW"}],7:[function(require,module,exports){
(function() {

    "use strict";

    var User            = require('./user.module.js');

    var when            = require('when');
    var _               = require('underscore');
    var Backbone        = require('backbone');
        Backbone.setClient(User.getDbClient());

    var Tags = module.exports;

        Tags.Model = Backbone.Model.extend({

            store       : 'tags',
            defaults    : {
                name        : null,
                description : null
            }
        });

        Tags.Collection = Backbone.Collection.extend({

            store       : 'tags',
            model       : Tags.Model,

            comparator  : 'name',

            getAsList   : function() {
                return this.map(function(tagItem) {
                    return tagItem.attributes;
                });
            },

            refresh     : function() {

                var that = this;
                    that.reset();

                return when.promise(function(resolve, reject) {
                    that.fetch({
                        update  : true,
                        success : function() {
                            resolve();
                        }
                    });
                });
            }
        });

})();

},{"./user.module.js":8,"backbone":"DIOwA5","underscore":"s12qeW","when":"My0/Wt"}],8:[function(require,module,exports){
(function() {

    "use strict";


    var when    = require('when');
    var Helper  = require('./helper.module.js');

    var Dropbox     = require('backbone_dropbox');
        Dropbox.init({
            client  : { key : "slx7xwupbtv0chg" },
            auth    : new Dropbox._Dropbox.AuthDriver.Popup({
                receiverUrl     : Helper.getCurrentUrl(),
                rememberUser    : true
            })
        });

    var Backbone    = Dropbox.Backbone;


    var User = module.exports;

        User.getDbClient = function() {

            if (!User.isLoggedIn()) {
                throw new Error('not logged in');
            }

            return Dropbox._Client;
        };

        User.isLoggedIn = function() {

            var isAuthenticated = Dropbox._Client.isAuthenticated();
            if (!isAuthenticated) {
                if (localStorage.getItem('alreadyAuthenticated')) {
                    User.login();
                    isAuthenticated = true;
                }
            }

            return isAuthenticated;
        };

        User.logout = function() {

            localStorage.clear();
        };

        User.login = function() {

            return when.promise(function(resolve, reject) {

                Dropbox._Client.authenticate(function(error, client) {
                    if (error) reject(error);
                    else {
                        localStorage.setItem("alreadyAuthenticated", "true");
                        resolve();
                    }
                });
            });
        };
})();

},{"./helper.module.js":2,"when":"My0/Wt"}],"./client/scripts/pages/impressum.page.js":[function(require,module,exports){
module.exports=require('HZXAze');
},{}],"HZXAze":[function(require,module,exports){
(function() {

    "use strict";

    var $           = require('jquery');
    var _           = require('underscore');
    var Backbone    = require('backbone');
        Backbone.$  = $;

    var Impressum = module.exports;

        Impressum.View = Backbone.View.extend({

            el      : '#impressum',
            events  : {
                'click' : function() {
                    document.location = '#libary';
                }
            }

        });

})();

},{"backbone":"DIOwA5","jquery":"QRCzyp","underscore":"s12qeW"}],"./client/scripts/pages/libary.page.js":[function(require,module,exports){
module.exports=require('+qxF5J');
},{}],"+qxF5J":[function(require,module,exports){
(function() {

    "use strict";

    var $           = require('jquery');
    var _           = require('underscore');
    var when        = require('when');
    var Backbone    = require('backbone');
        Backbone.$  = $;

    var List    = require('../modules/list.module.js');
    var Lists   = require('../modules/lists.module.js');
    var Tags    = require('../modules/tags.module.js');
    var User    = require('../modules/user.module.js');
    var Helper  = require('../modules/helper.module.js');

    function isElementInViewport (el) {

        //special bonus for those using jQuery
        if (typeof jQuery === "function" && el instanceof jQuery) {
            el = el[0];
        }

        var rect = el.getBoundingClientRect();

        return (
            rect.top >= -100 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    var Libary = module.exports;

        Libary.lists = [];


        Libary.taggingSnippet = Backbone.View.extend({

            className : 'taggingSnippet',

            events : {

                'click a' : function() {

                    var $add_new = this.$el.find('.add_new');
                    if ($add_new.css('display') === 'none') {
                        $add_new.css('display', 'block');
                    } else {
                        $add_new.css('display', 'none');
                    }

                }
            },

            initialize: function() {

                var that = this;
                    that.cTags = new Tags.Collection();
                    that.cTags.refresh()
                        .done(function() {
                            that.render();
                        });
            },

            render : function() {

                var that = this;
                    that.template({
                        path    : './templates/snippets/tagging.snippet.html',
                        params  : {
                            'currentTags'   : that.model.get('tags'),
                            'tagList'       : that.cTags.getAsList()
                        }
                    });
            }
        });

        Libary.listingSnippet = Backbone.View.extend({

            className : 'listingSnippet',

            events : {

                'click a' : function() {

                    var $add_new = this.$el.find('.add_new');
                    if ($add_new.css('display') === 'none') {
                        $add_new.css('display', 'block');
                    } else {
                        $add_new.css('display', 'none');
                    }
                },

                'click button' : function(el) {

                    var that = this;

                    var $parent = $(el.target).parent();
                    var $input  = $parent.find('input');

                    var value   = $input.val();
                    if (value && value.length !== 0) {

                        this.cLists.create({
                            'name' : value
                        }, {
                            wait    : true,
                            success : function(listModel) {

                                that.model.set('list', listModel.get('id'));
                                if (!that.model.isNew()) {
                                    that.model.save();
                                }
                                that.render();
                            }
                        });
                    }
                },

                'change select' : function(el) {

                    var $selected = $(el.target).find(':selected');
                    var value = $selected.attr('class');
                    if (value && value !== null) {

                        if (this.model.collection) {
                            console.log('model is already part of store: ' + this.model.collection.store);
                        }
                    }
                }
            },

            initialize: function() {

                var that = this;
                    that.cLists = new Lists.Collection();
                    that.cLists.refresh()
                        .done(function() {
                            that.render();
                        });
            },

            render : function() {

                var that = this;
                    that.template({
                        path    : './templates/snippets/lists.snippet.html',
                        params  : {
                            'lists'         : that.cLists.models,
                            'currentList'   : that.model.store
                        },
                        success : function() {

                            if (that.cLists.length === 0) {
                                that.$el.find('select').prop('disabled', true);
                            }

                            that.$el.find('option.' + that.model.get('list')).prop('selected', true);
                        }
                    });
            }
        });



        Libary.editWidget = Backbone.View.extend({

            className   : 'edit',

            events      : {

                'click .close' : function() {

                    $('#widget').css('display', 'none');
                    $('#widgetContent').html('');
                },

                'change .data textarea' : function(el) {

                    var $target = $(el.target);

                    var that        = this;
                    var className   = $target.attr('class');

                    if (that.model.has(className)) {
                        that.model.save(className, $target.text());
                    }
                },

                'change .data input' : function(el) {

                    var $target = $(el.target);

                    var that        = this;
                    var className   = $target.attr('class');

                    if (that.model.has(className)) {
                        that.model.save(className, $target.val());
                    }
                },

                'change #listing select' : function(el) {

                    var $select = $(el.target);
                    var $option = $select.find(':selected');

                    var oldList = Libary.lists[this.model.store].collection;
                    var newList = Libary.lists[$option.val()].collection;

                    var clonedModel = this.model.clone();

                        this.model.destroy();

                        clonedModel.set('id', null);
                        newList.add(clonedModel);
                        newList.save();

                    var cListItemOld = that.cLists.get(oldList.store);
                        cListItemOld.set('totalCount', cListItemOld.get('totalCount') - 1);

                    var cListItemNew = that.cLists.get(newList.store);
                        cListItemNew.set('totalCount', cListItemNew.get('totalCount') + 1);

                        that.cLists.save();
                }
            },

            initialize : function() {

                _.bindAll(this, 'render');

                var that = this;
                    that.cLists = new Lists.Collection();
                    that.cTags  = new Tags.Collection();

                    //load all lists
                    when.all([that.cLists.refresh(), that.cTags.refresh()])
                        .done(that.render);
            },

            render : function() {

                var that = this;

                var $widgetContent = $('#widgetContent');
                    $widgetContent.html('loading Data for URL.');

                var $widget = $('#widget');
                    $widget.css('display', 'block');

                    that.template({
                        path    : './templates/widgets/libary.edit.html',
                        params  : that.model.attributes,
                        success : function() {

                            var taggingSnippetView = new Libary.taggingSnippet({ model : that.model });
                                taggingSnippetView.$el.appendTo(that.$el.find('#tagging'));

                            var listSnippetView = new Libary.listingSnippet({ model : that.model });
                                listSnippetView.$el.appendTo(that.$el.find('#listing'));

                            $('#widgetContent').html(that.$el);
                        }
                    });
            }
        });

        Libary.addWidget = Backbone.View.extend({

            className : 'add',

            events      : {

                'click #images img' : function(el) {

                    var $target = $(el.target);
                    var $parent = $target.parent();

                    $parent.find('img')
                        .css('border', 'none')
                        .removeClass('selected');

                    $target
                        .css('border', '2px solid #000')
                        .addClass('selected');

                    this.model.set('previewImageUrl', $target.attr('src'));
                },

                'click #buttons .save' : function() {

                    var that = this;

                    var $inputs     = this.$el.find('input');
                    var $textareas  = this.$el.find('textarea');

                        //set input data
                        $inputs.each(function() {
                            var className = $(this).attr('class');
                            if (that.model.has(className)) {
                                that.model.set(className, $(this).val());
                            }
                        });

                        //set data from textareas
                        $textareas.each(function() {
                            var className = $(this).attr('class');
                            if (that.model.has(className)) {
                                that.model.set(className, $(this).text());
                            }
                        });

                    var listId = this.$el.find('#listing select :selected').val();
                    if (listId === null || listId === 'null') {
                        alert('please select a list');
                        return;
                    }

                    var selectedList = Libary.lists[listId];
                    if (!selectedList) {
                        throw new Error('list (' + listId + ') does not exist');
                    }

                    //add to list
                    selectedList.collection.add(that.model);

                    //set new total count
                    var listItem = that.cLists.get(listId);
                        listItem.save({
                            'totalCount' : listItem.get('totalCount') + 1
                        });

                    //save model
                    that.model.save();
                },

                'click #buttons .close' : function() {
                    $('#widget').css('display', 'none');
                    $('#widgetContent').html('');
                }
            },

            initialize : function() {

                _.bindAll(this, 'render');

                var that = this;
                    that.cLists = new Lists.Collection();
                    that.cTags  = new Tags.Collection();

                    //load all lists
                    when.all([that.cLists.refresh(), that.cTags.refresh()])
                        .done(that.render);
            },

            render : function() {

                var that = this;

                var $widgetContent = $('#widgetContent');
                    $widgetContent.html('loading Data for URL.');

                var $widget = $('#widget');
                    $widget.css('display', 'block');

                    that.model.refresh()
                            .done(function(data) {

                                that.template({
                                    path    : './templates/widgets/libary.add.html',
                                    params  : _.extend({}, that.model.attributes, {
                                        images  : data.images || []
                                    }),
                                    success : function() {

                                        var taggingSnippetView = new Libary.taggingSnippet({ model : that.model });
                                            taggingSnippetView.$el.appendTo(that.$el.find('#tagging'));

                                        var listSnippetView = new Libary.listingSnippet({ model : that.model });
                                            listSnippetView.$el.appendTo(that.$el.find('#listing'));

                                        $('#widgetContent').html(that.$el);
                                    }
                                });
                            });
            }
        });

        Libary.deleteWidget = Backbone.View.extend({

            events : {

                'click .close' : function() {
                    $('#widgetContent').html('');
                    $('#widget').css('display', 'none');
                },

                'click .delete' : function() {

                    var that = this;
                    var cLists = new Lists.Collection();
                        cLists.refresh()
                            .done(function() {

                                var mLists = cLists.get(that.model.get('id'));
                                if (mLists) {

                                    var totalCount = mLists.get('totalCount');
                                    if (totalCount === 0 || totalCount === "0") {
                                        mLists.save('totalCount', parseInt(totalCount, 10) - 1);
                                    }
                                }

                                that.model.destroy();

                                $('#widgetContent').html('');
                                $('#widget').css('display', 'none');
                            });


                }
            },

            initialize : function() {

                $('#widgetContent').html('');
                $('#widget').css('display', 'block');

                this.render();
            },

            render : function() {

                var that = this;
                    that.template({
                        path    : './templates/widgets/libary.delete.html',
                        success : function() {
                            $('#widgetContent').html(that.$el);
                        }
                    });
            }
        });


        Libary.editListWidget = Backbone.View.extend({

            className   : 'editList',

            events      : {

                'click #lists ul li button' : function(el) {

                    var $target = $(el.target);
                    var $parent = $target.parent();

                    var model = this.cLists.get($parent.attr('id'));
                    if (model.get('totalCount') !== 0) {
                        alert('list is not empty');
                        return;
                    }

                    model.destroy();
                    this.render();
                },

                'click #lists #create_lists button' : function(el) {

                    var $target = $(el.target);
                    var $parent = $target.parent();

                    var $input  = $parent.find('input');

                    if ($input.val().length !== 0) {

                        var modelWithMaxId = this.cLists.max(function(listItem) {
                            return parseInt(listItem.get('id'), 10);
                        });

                        var model = new Lists.Model({
                            name : $input.val()
                        });

                        model.store = this.cLists.store;
                        this.cLists.add(model);
                        model.save();

                        this.render();
                    }
                },

                'change #lists #available_lists ul li input' : function(el) {

                    var $target = $(el.target);
                    var $parent = $target.parent();

                    var model = this.cLists.get($parent.attr('id'));
                        model.set('name', $target.val());
                        model.save();
                },

                'click .close' : function() {
                    $('#widget').css('display', 'none');
                    $('#widgetContent').html('');
                }
            },

            initialize  : function() {

                var that = this;
                    that.cLists = new Lists.Collection();

                    that.cLists.refresh()
                        .done(function() {
                            that.render();
                        });

                $('#widgetContent').html(that.$el);
            },

            render      : function() {

                var that = this;
                    that.template({
                        path    : './templates/widgets/libary.edit.list.html',
                        params  : {
                            'lists' : that.cLists.models
                        },
                        success : function() {
                            $('#widget').css('display', 'block');
                        }
                    });
            }
        });




        Libary.Head = Backbone.View.extend({

            el      : '#main.libary #head',
            events  : {

                'click #logout' : function() {
                    User.logout();
                    window.rRouter.changePage('whatis');
                },

                'change input' : function(el) {

                    var $element = $(el.target);
                    var value    = $element.val();
                    if (value.length !== 0) {

                        var model = new List.Model();
                            model.set('url', value);

                        new Libary.addWidget({ model : model });
                    }

                }
            }
        });

        Libary.Sidebar = Backbone.View.extend({

            el : '#sidebar',

            events : {
                'click #manage_lists' : function() {
                    new Libary.editListWidget();
                }
            },

            initialize : function() {

                var that = this;

                    that.listenTo(that.collection, 'sync', function() {
                        that.render();
                    });
            },

            render : function() {

                var $empty_lists = this.$el.find('#empty_lists div');
                    $empty_lists.html('');

                var $list = this.$el.find('#lists');
                    $list.html('');

                var that = this;
                    that.collection.each(function(listItem) {
                        if (listItem.get('totalCount') !== 0) {
                            $list.append('<div id="' + listItem.get('id') +'" class="listItem">' +
                            '<div class="listIcon"></div><span>' +
                            listItem.get('name') + '</span></div>');
                        }
                    });
            }
        });


        Libary.ListItem = Backbone.View.extend({

            events      : {

                'click .name' : function() {
                    var win = window.open(this.model.get('url'), '_blank');
                        win.focus();
                },

                'click .extend_me' : function() {
                    var $extend = this.$el.find('.extend');
                    if ($extend.is(':visible')) {
                        $extend.css('display', 'none');
                    } else {
                        $extend.css('display', 'block');
                    }
                },

                'click .addTag' : function() {
                    new Libary.TagWidget({
                        model   : this.model
                    });
                    return false;
                },

                'click .tags .delete' : function(events) {

                    var tags    = this.model.get('tags');
                        tags.splice($(events.target).parent().attr('class').split(' ')[0], 1);

                    this.model.save('tags', tags);
                    return false;
                },


                'click .control .delete' : function() {
                    new Libary.deleteWidget({
                        model : this.model
                    });
                    return false;
                },

                'click .control .edit' : function() {
                    new Libary.editWidget({
                        model : this.model
                    });
                    return false;
                }
            },

            loadSrcByUserViewPort : function() {

                var that = this;
                var $img = this.$el.find('.loader');
                if ($img.length !== 0) {
                    if (isElementInViewport(this.$el[0])) {

                        var $nImg = $(document.createElement('img'));
                            $nImg.addClass('media_content');
                            $nImg.one('load', function() {
                                $img.replaceWith($nImg);
                            });

                            $nImg.attr('src', $img.find('img').data('src'));
                    }
                }
            },

            className   : function() {

                return 'listItem ' + this.model.get('type');
            },

            render      : function() {

                var type = this.model.get('type');
                if (type === null) {
                    type = 'link';
                }

                var typeName = type + 'Item';

                var params = _.extend({}, this.model.attributes, {
                    'dateFormated' : Helper.timeConverter(this.model.get('created')),
                    'name_truncated' : Helper.truncate(this.model.get('name'), 100)
                });

                var that = this;
                    that.template({
                        path    : './templates/pages/snippets/libary.' + typeName + '.html',
                        params  : params,
                        success : function() {
                            that.loadSrcByUserViewPort();
                        }
                    });
            },

            initialize  : function(params) {

                var that = this;

                    that.listenTo(this.model, 'destroy',    that.remove);
                    that.listenTo(this.model, 'sync',       that.render);
                    that.listenTo(this.model, 'change',     that.render);
            }
        });

        Libary.List = Backbone.View.extend({

            className       : 'list',

            listItems       : [],
            scrollCounter   : 0,

            _scrolling : function() {

                if (this.scrollCounter <= 10) {
                    this.scrollCounter++;
                    return;
                }

                this.scrollCounter = 0;
                _.each(this.listItems, function(item) {
                    item.loadSrcByUserViewPort();
                });
            },

            initialize : function() {

                _.bindAll(this, 'refresh', '_scrolling');

                var that = this;
                    that.collection = new List.Collection({
                        store : that.model.get('id')
                    });

                    that.$el.attr('id', that.model.get('id'));

                    that.listenTo(that.collection, 'add', function(model) {
                        that.addItem(model);
                    });
            },

            refresh : function() {

                var that = this;
                    that.listItems = [];
                    that.$el.html(that.defaultTmpl);

                    that.collection.each(function(model) {
                        that.addItem(model);
                    });

                    that.$el.find('.content').off()
                        .on('scroll', that._scrolling);

                    if (that.collection.length !== 0) {
                        that.$el.css('display', 'inline-block');
                    }
            },

            addItem : function(model) {

                var view = new Libary.ListItem({ model : model });
                    view.$el.prependTo(this.$el.find('.content'));
                    view.render();

                    this.listItems.push(view);
            },

            render : function(success) {

                var that = this;

                return when.promise(function(resolve, reject) {
                    that.template({
                        path    : './templates/pages/snippets/libary.list.html',
                        success : function() {
                            that.$el.find('.head .listname').html(that.model.get('name'));
                            that.defaultTmpl = that.$el.html();
                            resolve();
                        }
                    });
                });
            }
        });

        Libary.View = Backbone.View.extend({

            el              : '#main.libary',
            scrollCounter   : 0,


            events : {

                'click #sidebar #lists .listItem' : function(el) {

                    var value = $(el.target).attr('id');
                     if (!value) {
                        value = $(el.target).parent().attr('id');
                     }

                    var $list = $('#libary').find('#' + value);

                    $('#libary').animate({
                        scrollLeft: $list.position().left
                    }, 500);


                    function doBounce(element, times, distance, speed) {
                        for(var i = 0; i < times; i++) {
                            element.animate({marginTop: '-='+distance}, speed)
                                .animate({marginTop: '+='+distance}, speed);
                        }
                    }

                    doBounce($list, 2, '5px', 200);
                }
            },


            _scrolling : function() {

                var that = this;

                if (that.scrollCounter < 10) {
                    that.scrollCounter = ++that.scrollCounter;
                    return;
                }

                that.scrollCounter = 0;

                _.each(Libary.lists, function(list, listName) {

                    if (!list) {
                        return;
                    }

                    var inView = isElementInViewport(list.$el[0]);
                    if (inView === true) {
                        _.each(list.listItems, function(listItem) {
                            listItem.loadSrcByUserViewPort();
                        });
                    }
                });

            },

            _initializeLists : function() {

                var promises = [];

                var that = this;
                    that.cLists.each(function(model) {
                        promises.push(that.addListView(model));
                    });

                    when.all(promises)
                        .done(function() {

                            //enable scrolling event
                            that.$el.find('#libary')
                                .on('scroll', that._scrolling);

                            that.cLists.save();
                        });
            },

            addListView : function(model) {

                var $libary = this.$el.find('#libary');

                var view = new Libary.List({ model : model });
                    view.$el.appendTo($libary);

                    //set to list store
                    Libary.lists[model.get('id')] = view;

                var that = this;

                return view.render()
                        .then(view.collection.refresh)
                        .then(function(collection) {

                            //refresh totalCount
                            that.cLists.get(collection.store).set('totalCount', collection.length);

                            return collection;
                        }, Helper.showError)
                        .then(view.refresh, Helper.showError);
            },

            initialize : function() {

                _.bindAll(this, '_initializeLists');

                var that = this;
                    that.cLists = new Lists.Collection();

                    that.vHead      = new Libary.Head();
                    that.vSidebar   = new Libary.Sidebar({
                        collection : that.cLists
                    });

                    that.cLists
                        .refresh()
                        .done(that._initializeLists, Helper.showError);
            }
        });

})();

},{"../modules/helper.module.js":2,"../modules/list.module.js":3,"../modules/lists.module.js":4,"../modules/tags.module.js":7,"../modules/user.module.js":8,"backbone":"DIOwA5","jquery":"QRCzyp","underscore":"s12qeW","when":"My0/Wt"}],"5UBb1x":[function(require,module,exports){
(function() {

	"use strict";

    var $               = require('jquery');
    var _               = require('underscore');
    var Backbone        = require('backbone');
        Backbone.$      = $;

    var User        = require('../modules/user.module.js');

    var Whatis      = module.exports;

        Whatis.View = Backbone.View.extend({

            el      : '#main.whatis',
            events  : {

                'click #dropbox_login .login' : function() {

                    User.login()
                        .done(function() {
                            window.rRouter.navigate('libary', {
                                trigger : true
                            });
                        });
                }
            }
        });

})();

},{"../modules/user.module.js":8,"backbone":"DIOwA5","jquery":"QRCzyp","underscore":"s12qeW"}],"./client/scripts/pages/whatis.page.js":[function(require,module,exports){
module.exports=require('5UBb1x');
},{}]},{},[1]);