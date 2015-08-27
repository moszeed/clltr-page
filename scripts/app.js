(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function() {

    "use strict";

    var $ = require('jquery');
        $.ajaxPrefilter(function(options) {
            options.async = true;
        });

    var Backbone      = require('drbx-js-backbone');
        Backbone.View = require('backbone-template');

    var User   = require('./scripts/modules/user.module.js');
    var Router = require('./scripts/modules/router.module.js')();

    var App = module.exports;

        App.Main = Backbone.View.extend({

            el: 'body #main',

            initialize: function() {
                this.listenTo(Router, 'changePage', this.render);
                this.render();
            },

            render: function(page) {

                page = page || Router.getCurrentPage() || null;
                if (page === null) {
                    throw new Error('no page given');
                }

                this.template({
                    path: './templates/pages/' + page + '.html'
                });
            }
        });

        App.View = Backbone.View.extend({

            el: 'body',

            events: {

                'click button.login': function() {

                    User.login()
                        .then(function() {
                            Router.changePage('libary');
                        });
                },

                'click #logout': function() {
                    User.logout();
                    Router.changePage('whatis');
                }
            },

            initialize: function() {
                this.vMain = new App.Main();
            }
        });

        App.current = new App.View();

})();

},{"./scripts/modules/router.module.js":2,"./scripts/modules/user.module.js":3,"backbone-template":"backbone-template","drbx-js-backbone":"drbx-js-backbone","jquery":"jquery"}],2:[function(require,module,exports){
(function() {

    "use strict";

    var Backbone = require('drbx-js-backbone');
    var User     = require('./user.module.js');

    var Router = Backbone.Router.extend({

            routes: {
                '*path': 'default'
            },

            initialize: function(opts) {

                opts = opts || {};

                var that = this;
                    that.on('route:default', function(urlParams) {

                        if (urlParams !== null &&
                            urlParams.indexOf('access_token') !== -1) {
                            Backbone.DrbxJs.Dropbox.AuthDriver.Popup.oauthReceiver();
                            return;
                        }

                        that.changePage(urlParams);
                    });
            },

            changePage: function(page) {

                page = page || 'libary';

                if (!User.isLoggedIn()) {
                    page = 'whatis';
                }

                this.navigate(page);
                this.trigger('changePage');
            },

            getCurrentPage: function() {
                return Backbone.history.fragment;
            }
        });

    module.exports = function() {

        var currentRouter = new Router();
        Backbone.history.start();
        return currentRouter;
    };

})();

},{"./user.module.js":3,"drbx-js-backbone":"drbx-js-backbone"}],3:[function(require,module,exports){
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

},{"drbx-js-backbone":"drbx-js-backbone","helper":"helper"}]},{},[1]);
