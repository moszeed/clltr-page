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

},{"./modules/router.module.js":5,"backbone":"DIOwA5","jquery":"QRCzyp","underscore":"s12qeW","when":"My0/Wt"}],2:[function(require,module,exports){
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


})();

},{}],3:[function(require,module,exports){
(function() {

    "use strict";

    var $               = require('jquery');
    var _               = require('underscore');
    var when            = require('when');
    var Backbone        = require('backbone');
        Backbone.$      = $;

    var User            = require('./user.module.js');
        Backbone.setDropboxClient(User.getDbClient());

    var List = module.exports;

        List.Model = Backbone.Model.extend({

            embedlyUrl  : "https://api.embed.ly/1/extract?key=35550e76c44048aa92ca559f77d2fd1e&format=json&url=",

            store       : 'list',
            defaults    : {
                url         : null,
                name        : null,
                type        : null,
                tags        : null,
                description : null,
                previewImageUrl : null,
                favicon_url : null,
                created     : null
            },

            fetchData : function() {

                var that = this;
                return when.promise(function(resolve, reject) {

                    var setData = function(pageData) {

                        pageData = pageData || {};

                        var params = {
                            name            : pageData.title || that.get('url'),
                            description     : pageData.description || '',
                            type            : pageData.type || null,
                            previewImageUrl : null,
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
                                params.type = 'image';
                            }
                        }

                        that.save(params);

                        resolve();
                    };

                    $.ajax({
                        url     : that.embedlyUrl + that.get('url'),
                        error   : setData,
                        success : setData
                    });
                });
            }
        });

        List.Collection = Backbone.Collection.extend({

            store       : 'list',
            model       : List.Model,

            comparator  : 'name',

            addByUrl    : function(url) {

                var that  = this;
                var model = new List.Model();

                if (url.substring(0, 'http'.length)    !== 'http' &&
                    url.substring(0, 'https'.length)   !== 'https') {
                    url = "https://" + url;
                }

                model.set('url', url);

                return model.fetchData()
                    .then(function() {
                        that.add(model);
                    });
            },

            refresh : function(params) {

                var that = this;
                    that.reset();
                    return that.fetch({
                        filter  : params || void 0,
                        update  : true
                    });
            }
        });

})();

},{"./user.module.js":7,"backbone":"DIOwA5","jquery":"QRCzyp","underscore":"s12qeW","when":"My0/Wt"}],4:[function(require,module,exports){
(function() {

    "use strict";

    var $           = require('jquery');
    var _           = require('underscore');
    var Backbone    = require('backbone');
        Backbone.$  = $;

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

},{"backbone":"DIOwA5","jquery":"QRCzyp","underscore":"s12qeW"}],5:[function(require,module,exports){
(function() {

    "use strict";


    var $           = require('jquery');
    var Backbone    = require('backbone');
        Backbone.$  = $;

    var User        = require('./user.module.js');
    var Main        = require('./main.module.js');
    var Dropbox     = require('dropbox');

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

},{"./main.module.js":4,"./user.module.js":7,"backbone":"DIOwA5","dropbox":"tBYV3e","jquery":"QRCzyp"}],6:[function(require,module,exports){
(function() {

    "use strict";

    var User            = require('./user.module.js');
    var _               = require('underscore');
    var Backbone        = require('backbone');
        Backbone.setDropboxClient(User.getDbClient());

    var Tags = module.exports;

        Tags.Model = Backbone.Model.extend({

            store       : 'tags',
            defaults    : {
                name        : null,
                description : null,
                totalCount  : null
            }
        });

        Tags.Collection = Backbone.Collection.extend({

            store       : 'tags',
            model       : Tags.Model,
            comparator  : 'name',

            refresh : function() {

                var that = this;
                    that.reset();

                return this.fetch({
                    update  : true,
                    success : function() {
                        that.unshift({
                            name : 'all'
                        });
                    }
                });
            }
        });

})();

},{"./user.module.js":7,"backbone":"DIOwA5","underscore":"s12qeW"}],7:[function(require,module,exports){
(function() {

    "use strict";

    var Dropbox = require('dropbox');
    var when    = require('when');
    var Helper  = require('./helper.module.js');

    var DropboxClient = new Dropbox.Client({
            key     : "slx7xwupbtv0chg",
            sandbox : true
        });

        DropboxClient.authDriver(new Dropbox.AuthDriver.Popup({
            receiverUrl     : Helper.getCurrentUrl(),
            rememberUser    : true
        }));


    var User = module.exports;

        User.getDbClient = function() {

            if (!User.isLoggedIn()) {
                throw new Error('not logged in');
            }

            return DropboxClient;
        };

        User.isLoggedIn = function() {

            var isAuthenticated = DropboxClient.isAuthenticated();
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
                DropboxClient.authenticate(function(error, client) {
                    if (error) reject(error);
                    else {
                        localStorage.setItem("alreadyAuthenticated", "true");
                        resolve();
                    }
                });
            });
        };

        //exports.DropboxClient = DropboxClient;
})();

},{"./helper.module.js":2,"dropbox":"tBYV3e","when":"My0/Wt"}],"./client/scripts/pages/impressum.page.js":[function(require,module,exports){
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
    var Tags    = require('../modules/tags.module.js');
    var User    = require('../modules/user.module.js');
    var Helper  = require('../modules/helper.module.js');


    var Libary = module.exports;

        Libary.Events = _.extend({}, Backbone.Events);


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

                        var $loadingIndicator = $('.loadingIndicator');
                            $loadingIndicator.css('visibility', 'visible');

                        this.collection.addByUrl(value)
                            .done(function() {
                                $loadingIndicator.css('visibility', 'hidden');
                                $element.val('');
                            });
                    }

                }
            }
        });


        Libary.EditWidget = Backbone.View.extend({

            className   : 'editWidget',

            events      : {

                'click .close' : function() {
                    $('.overlay').hide();
                    $('.overlayInner').html('').hide();
                },

                'click .save' : function() {

                    var that = this;
                    _.each(this.model.attributes, function(value, key) {
                        var $input = that.$el.find('input.' + key);
                        if ($input.length === 1) {
                            that.model.set(key, $input.val());
                        } else {

                            var $textarea = that.$el.find('textarea.' + key);
                            if ($textarea.length === 1) {
                                that.model.set(key, $textarea.val());
                            }
                        }
                    });

                    this.model.save();

                    $('.overlay').hide();
                    $('.overlayInner').html('').hide();
                }
            },

            initialize : function() {
                this.render();
            },

            render : function() {

                var $overlay        = $('.overlay');
                var $overlayInner   = $('.overlayInner');

                var that = this;
                    that.template({
                        path    : './templates/widgets/libary.edit.html',
                        params  : this.model.attributes,
                        success : function() {
                            $overlayInner
                                .html(that.$el)
                                .css('display', 'block');
                            $overlay.css('display', 'block');
                        }
                    });
            }
        });

        Libary.DeleteWidget = Backbone.View.extend({

            events : {

                'click .close' : function() {
                    $('.overlay').hide();
                    $('.overlayInner').html('').hide();
                },

                'click .delete' : function() {

                    this.model.destroy();

                    $('.overlay').hide();
                    $('.overlayInner').html('').hide();
                }
            },

            initialize : function() {
                this.render();
            },

            render : function() {
                var $overlay        = $('.overlay');
                var $overlayInner   = $('.overlayInner');

                var that = this;
                    that.template({
                        path    : './templates/widgets/libary.delete.html',
                        success : function() {
                            $overlayInner
                                .html(that.$el)
                                .css('display', 'block');
                            $overlay.css('display', 'block');
                        }
                    });
            }
        });

        Libary.TagWidget = Backbone.View.extend({

            events : {

                'click .close' : function() {
                    $('.overlay').hide();
                    $('.overlayInner').html('').hide();
                },

                'click .set' : function() {

                    var $select = this.$el.find('.possible_tags select');
                    var $input  = this.$el.find('.new_tag input');

                    var value = $select.val();
                    if (value === "null") {
                        value = $input.val();
                        if (value === void 0 || value.length === 0) {
                            alert('no tag selected');
                            return;
                        }
                    }

                    var model = this.collection.findWhere({ name : value });
                    if (model === void 0) {

                        model = new Tags.Model();
                        model.set('name', value);

                        this.collection.create(model);
                        Libary.Events.trigger('refreshTags');
                    }

                    var tags = this.model.get('tags');
                    if (tags === null) {
                        tags = [];
                    }

                    tags.push(model.get('name'));
                    this.model.set('tags', tags);
                    this.model.save();

                    $('.overlay').hide();
                    $('.overlayInner').html('').hide();
                }
            },

            initialize : function(params) {

                this.options = params.options;

                this.collection = new Tags.Collection();
                this.collection.refresh();

                this.render();
            },

            render : function() {

                var $overlay        = $('.overlay');
                var $overlayInner   = $('.overlayInner');

                var that = this;
                    that.template({
                        path    : './templates/widgets/libary.tag.html',
                        params  : {
                            attrs : this.model.attributes,
                            tags : this.collection.models
                        },
                        success : function() {
                            $overlayInner
                                .html(that.$el)
                                .css('display', 'block');
                            $overlay.css('display', 'block');
                        }
                    });
            }
        });



        Libary.TagItem = Backbone.View.extend({

            events      : {

                'click span' : function() {

                    if (confirm('rly delete tag?')) {
                        this.model.destroy();
                    }

                    return false;
                },

                'click' : function(el) {
                    Libary.Events.trigger('refresh', this.model.get('name'));
                }
            },

            className   : 'tag_item',
            render      : function() {
                this.template({
                    path    : './templates/pages/snippets/libary.tagItem.html',
                    params  : this.model.attributes
                });
            }
        });

        Libary.Tags = Backbone.View.extend({

            el          : '#main.libary #tags',

            setTagActive : function(tagName) {

                this.$el.find('.tag_item').css('background-color', 'transparent');

                var $tag = this.$el.find('.' + tagName.replace(new RegExp(' ', 'g'), '_'));
                if ($tag.length !== 0) {
                    $tag.parent().css('background-color', '#DEDEDE');
                } else {
                    this.parent().$el.find('.all').css('background-color', '#DEDEDE');
                }
            },

            addItem     : function(model) {

                var tagItem = new Libary.TagItem({model:model});
                    tagItem.$el.appendTo(this.$el.find('.content'));
                    tagItem.render();
            },

            initialize  : function() {

                var that = this;

                    that.listenTo(that.collection, 'reset', function() {
                        that.$el.find('.content').html('');
                    });

                    that.listenTo(that.collection, 'destroy', function() {
                        that.collection.refresh();
                    });

                    that.listenTo(Libary.Events, 'refreshTags', function() {
                        that.collection.refresh();
                    });

                    that.listenTo(that.collection, 'sync', function() {
                        _.each(that.collection.models, function(model) {
                            that.addItem(model);
                        });
                    });

                    that.collection.refresh();
            }
        });

        Libary.VideoListItem = Backbone.View.extend({

            events      : {

                'click' : function() {
                    var win = window.open(this.model.get('url'), '_blank');
                        win.focus();
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
                    new Libary.DeleteWidget({
                        model : this.model
                    });
                    return false;
                },

                'click .control .edit' : function() {
                    new Libary.EditWidget({
                        model : this.model
                    });
                    return false;
                }
            },

            className   : 'list_item video',
            render      : function() {
                var that = this;
                    that.template({
                        path    : './templates/pages/snippets/libary.listItemVideo.html',
                        params  : this.model.attributes
                    });
            },

            initialize  : function() {

                var that = this;

                    that.listenTo(this.model, 'destroy', function() {
                        that.remove();
                    });

                    that.listenTo(this.model, 'sync', function() {
                        that.render();
                    });

                    that.listenTo(this.model, 'change', function() {
                        that.render();
                    });
            }
        });

        Libary.VideoList = Backbone.View.extend({

            el          : '#main.libary #libary #videos',
            addItem     : function(model) {

                var listItem = new Libary.VideoListItem({model:model});
                    listItem.$el.prependTo(this.$el.find('.content'));
                    listItem.render();
            }
        });


        Libary.ImageListItem = Backbone.View.extend({

            events      : {

                'click' : function() {
                    var win = window.open(this.model.get('url'), '_blank');
                        win.focus();
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
                    new Libary.DeleteWidget({
                        model : this.model
                    });
                    return false;
                },

                'click .control .edit' : function() {
                    new Libary.EditWidget({
                        model : this.model
                    });
                    return false;
                }
            },

            className   : 'list_item image',
            render      : function() {

                var that = this;
                    that.template({
                        path    : './templates/pages/snippets/libary.listItemImage.html',
                        params  : this.model.attributes
                    });
            },

            initialize  : function() {

                var that = this;

                    that.listenTo(this.model, 'destroy', function() {
                        that.remove();
                    });

                    that.listenTo(this.model, 'sync', function() {
                        that.render();
                    });

                    that.listenTo(this.model, 'change', function() {
                        that.render();
                    });
            }
        });

        Libary.ImagesList = Backbone.View.extend({


            el          : '#main.libary #libary #images',
            addItem     : function(model) {

                var listItem = new Libary.ImageListItem({model:model});
                    listItem.$el.prependTo(this.$el.find('.content'));
                    listItem.render();
            }
        });



        Libary.LinkListItem = Backbone.View.extend({

            events      : {

                'click' : function() {
                    var win = window.open(this.model.get('url'), '_blank');
                        win.focus();
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
                    new Libary.DeleteWidget({
                        model : this.model
                    });
                    return false;
                },

                'click .control .edit' : function() {
                    new Libary.EditWidget({
                        model : this.model
                    });
                    return false;
                }
            },

            className   : 'list_item link',
            render      : function() {

                var params = _.extend({}, this.model.attributes, {
                    dateFormated : Helper.timeConverter(this.model.get('created'))
                });

                var that = this;
                    that.template({
                        path    : './templates/pages/snippets/libary.listItemLink.html',
                        params  : params
                    });
            },

            initialize  : function() {

                var that = this;

                    that.listenTo(this.model, 'destroy', function() {
                        that.remove();
                    });

                    that.listenTo(this.model, 'sync', function() {
                        that.render();
                    });

                    that.listenTo(this.model, 'change', function() {
                        that.render();
                    });
            }
        });

        Libary.LinkList = Backbone.View.extend({

            el          : '#main.libary #libary #links',
            addItem     : function(model) {

                var listItem = new Libary.LinkListItem({model:model});
                    listItem.$el.prependTo(this.$el.find('.content'));
                    listItem.render();
            }
        });


        Libary.List = Backbone.View.extend({

            el          : '#main.libary #libary',
            initialize  : function() {

                var that = this;

                    that.vLinksList     = new Libary.LinkList();
                    that.vImagesist     = new Libary.ImagesList();
                    that.vVideosList    = new Libary.VideoList();

                    that.listenTo(that.collection, 'add', function(model) {

                        switch(model.get('type')) {

                            case 'image': this.vImagesist.addItem(model); break;
                            case 'video': this.vVideosList.addItem(model); break;

                            default:
                                this.vLinksList.addItem(model);
                                break;
                        }
                    });

                    that.listenTo(that.collection, 'sync', function() {
                        console.log('link_list: ' + that.vLinksList.$el.find('.list_item').length);
                    });

                    that.listenTo(that.collection, 'reset', function() {
                        that.vLinksList.$el.find('.content').html('');
                        that.vImagesist.$el.find('.content').html('');
                        that.vVideosList.$el.find('.content').html('');
                    });

                    that.collection.refresh();
            }
        });



        Libary.View = Backbone.View.extend({

            el          : '#main.libary',

            initialize  : function() {

                var that = this;

                    that.cList = new List.Collection();
                    that.cTags = new Tags.Collection();

                    that.vHead = new Libary.Head({collection: that.cList});
                    that.vList = new Libary.List({collection: that.cList});
                    that.vTags = new Libary.Tags({collection: that.cTags});

                    that.listenTo(Libary.Events, 'refresh', function(tagName) {

                        var filter = {};
                        if (tagName !== void 0 &&
                            tagName !== 'all') {
                            filter = {
                                tags : tagName
                            };
                        }

                        that.vTags.setTagActive(tagName);
                        that.cList.refresh(filter);
                    });
            }

        });

})();

},{"../modules/helper.module.js":2,"../modules/list.module.js":3,"../modules/tags.module.js":6,"../modules/user.module.js":7,"backbone":"DIOwA5","jquery":"QRCzyp","underscore":"s12qeW","when":"My0/Wt"}],"./client/scripts/pages/whatis.page.js":[function(require,module,exports){
module.exports=require('5UBb1x');
},{}],"5UBb1x":[function(require,module,exports){
(function() {

	"use strict";

    var $           = require('jquery');
    var _           = require('underscore');
    var Backbone    = require('backbone');
        Backbone.$  = $;

    var User        = require('../modules/user.module.js');

    var Whatis  = module.exports;
        Whatis.View = Backbone.View.extend({

            el      : '#main.whatis',
            events  : {

                'click #login' : function() {

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

},{"../modules/user.module.js":7,"backbone":"DIOwA5","jquery":"QRCzyp","underscore":"s12qeW"}]},{},[1]);