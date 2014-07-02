var _ = require('underscore');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var SockJS = require('sockjs-client-node');
var TMNBot = function (options) {
  this.options = _.extend({
    endpoint: 'http://www.treesmovienight.com/socket',
    sockjs: {
      debug: false
    }
  }, options)
  this.authenticated = false;
  this.ready = false;
  this.connected = false;
  this.callbacks = {};
  this.callbackIndex = 0;
  this.retryCount = 0;
  this.maxRetries = 5;
  this.retryTimeout = 1000;
  this.reconnect = {
    maxAttempts: 15,
    delay: 1000,
    maxDelay: 5000,
    attempts: 0,
    reconnecting: false
  };
  this.callQueue = [];
  this.listen();
  this.connect();
};

util.inherits(TMNBot, EventEmitter);

TMNBot.prototype.call = function () {
  if (this.authenticated) {
    this._call.apply(this, arguments);
  } else {
    this.callQueue.push(arguments);
  }
};

TMNBot.prototype._call = function () {
  var data = {};
  var _arguments = [];
  for (var i = 0; i < arguments.length; i++) {
    if (i === 0) {
      data.method = arguments[i];
    } else if (i === (arguments.length - 1) && typeof arguments[i] === 'function') {
      data.callback = this.storeCallback(arguments[i]);
    } else {
      _arguments.push(arguments[i]);
    }
  }

  if (_arguments.length) {
    data.arguments = _arguments;
  }

  return this.sockjs.send(JSON.stringify(data));
};

TMNBot.prototype.storeCallback = function (cb) {
  var index = this.callbackIndex++;
  this.callbacks['cb_' + index] = cb;
  return 'cb_' + index;
};

TMNBot.prototype.runCallback = function (cb, args) {
  if (this.callbacks[cb] !== 'undefined') {
    this.callbacks[cb].apply(this, args);
  }
};

TMNBot.prototype.listen = function () {
  this.on('ready', this.onReady.bind(this));
};

TMNBot.prototype.connect = function () {
  if (this.sockjs) {
    this.close();
  }
  
  console.log('Connecting...');

  this.sockjs = new SockJS(this.options.endpoint, ['websocket'], this.options.sockjs);

  if (this.sockjs.readyState === SockJS.CLOSING) {
    this.onClose();
  }
  
  this.sockjs.onmessage = this.onMessage.bind(this);
  this.sockjs.onclose = this.onClose.bind(this);
};

TMNBot.prototype.onMessage = function (event) {
  var data;
  try {
    data = JSON.parse(event.data);
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
  } catch (e) {}
  
  if (typeof data === 'object') {
    if (typeof data.callback === 'string') {
      this.runCallback(data.callback, data.arguments);
    } else if (typeof data.channel === 'string' && (data.channel === 'ready' || this.connected)) {
      this.emit(data.channel, data.data);
    }
  }
};

TMNBot.prototype.onClose = function () {
  this.markAsOffline();
  this.reconnect.reconnecting = false;
  this.tryToReconnect();
};

TMNBot.prototype.onReady = function () {
  console.log('Server is ready...');
  this.ready = true;
  this.reconnect.reconnecting = false;
  this.reconnect.attempts = 0;
  this.sendReady();
};

TMNBot.prototype.sendReady = function () {
  var self = this;
  console.log('Client is ready...');
  this._call('ready', function(err, data) {
    if (!err) {
      self.connected = true;
      self._authenticate();
    } else {
      if (self.retryCount < self.maxRetries) {
        self.retryCount++;
        setTimeout(_.bind(self.sendReady, self), self.retryTimeout);
      } else {
        self.retryCount = 0;
      }
    }
  });
};

TMNBot.prototype.tryToReconnect = function () {
  if (this.reconnect.reconnecting) { return false; }
  this.reconnect.attempts++;
  if (this.reconnect.attempts > this.reconnect.maxAttempts) {
    window.location.href = window.location.href.split('#')[0];
  } else {
    this.reconnect.reconnecting = true;
    var self = this;
    var delay = this.reconnect.attempts * this.reconnect.delay;
        delay = Math.min(delay, this.reconnect.maxDelay);
    setTimeout(function () {
      self.connect();
    }, delay);
  }
};

TMNBot.prototype._authenticate = function () {
  var self = this;
  console.log('Authenticating...');
  this._call('user.authenticate', { username: this.options.username, password: this.options.password }, function(err, data) {
    if (!err) {
      console.log('Authenticated!');
      self.user = data.user;
      self.authenticated = true;
      self.flushCallQueue();
    } else {
      throw new Error('Could not authenticate the bot.');
    }
  });
};

TMNBot.prototype.flushCallQueue = function () {
  for (var i = 0; i < this.callQueue.length; i++) {
    this._call.apply(this, this.callQueue[i]);
  }
  this.callQueue = [];
};

TMNBot.prototype.disconnect = function () {
  if (this.connected) {
    this.close();
  }
};

TMNBot.prototype.markAsOffline = function () {
  this.user = null;
  this.connected = false;
  this.authenticated = false;
  this.ready = false;
};

TMNBot.prototype.close = function () {
  this.sockjs.close();
  this.markAsOffline();
  this.sockjs = null;
};

module.exports = TMNBot;