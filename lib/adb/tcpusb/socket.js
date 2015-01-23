(function() {
  var EventEmitter, Parser, Promise, Protocol, Socket, debug,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  EventEmitter = require('events').EventEmitter;

  Promise = require('bluebird');

  debug = require('debug')('adb:tcpusb:socket');

  Parser = require('../parser');

  Protocol = require('../protocol');

  Socket = (function(_super) {
    var A_AUTH, A_CLSE, A_CNXN, A_OKAY, A_OPEN, A_SYNC, A_WRTE, RollingCounter, ServiceMap, UINT32_MAX;

    __extends(Socket, _super);

    A_SYNC = 0x434e5953;

    A_CNXN = 0x4e584e43;

    A_OPEN = 0x4e45504f;

    A_OKAY = 0x59414b4f;

    A_CLSE = 0x45534c43;

    A_WRTE = 0x45545257;

    A_AUTH = 0x48545541;

    UINT32_MAX = 0xFFFFFFFF;

    function Socket(client, serial, socket) {
      this.client = client;
      this.serial = serial;
      this.socket = socket;
      this.ended = false;
      this.parser = new Parser(this.socket);
      this.version = 1;
      this.maxPayload = 4096;
      this.authorized = false;
      this.syncToken = new RollingCounter(UINT32_MAX);
      this.remoteId = new RollingCounter(UINT32_MAX);
      this.services = new ServiceMap;
      this.remoteAddress = this.socket.remoteAddress;
      this._inputLoop();
    }

    Socket.prototype.end = function() {
      if (!this.ended) {
        this.socket.end();
        this.services.end();
        this.emit('end');
        this.ended = true;
      }
      return this;
    };

    Socket.prototype._inputLoop = function() {
      return this._readMessage().then((function(_this) {
        return function(message) {
          return _this._route(message);
        };
      })(this)).then((function(_this) {
        return function() {
          return setImmediate(_this._inputLoop.bind(_this));
        };
      })(this))["catch"](Parser.PrematureEOFError, (function(_this) {
        return function() {
          return _this.end();
        };
      })(this));
    };

    Socket.prototype._readMessage = function() {
      return this.parser.readBytes(24).then(function(header) {
        return {
          command: header.readUInt32LE(0),
          arg0: header.readUInt32LE(4),
          arg1: header.readUInt32LE(8),
          length: header.readUInt32LE(12),
          check: header.readUInt32LE(16),
          magic: header.readUInt32LE(20)
        };
      }).then((function(_this) {
        return function(message) {
          return _this.parser.readBytes(message.length).then(function(data) {
            message.data = data;
            return message;
          });
        };
      })(this)).then((function(_this) {
        return function(message) {
          return _this._validateMessage(message);
        };
      })(this));
    };

    Socket.prototype._route = function(message) {
      if (this.ended) {
        return;
      }
      switch (message.command) {
        case A_SYNC:
          return this._handleSyncMessage(message);
        case A_CNXN:
          return this._handleConnectionMessage(message);
        case A_OPEN:
          return this._handleOpenMessage(message);
        case A_OKAY:
          return this._handleOkayMessage(message);
        case A_CLSE:
          return this._handleCloseMessage(message);
        case A_WRTE:
          return this._handleWriteMessage(message);
        case A_AUTH:
          return this._handleAuthMessage(message);
        default:
          return this.emit('error', new Error("Unknown command " + message.command));
      }
    };

    Socket.prototype._handleSyncMessage = function(message) {
      return this._writeHeader(A_SYNC, 1, this.syncToken.next(), 0);
    };

    Socket.prototype._handleConnectionMessage = function(message) {
      debug('A_CNXN', message);
      this.version = message.arg0;
      this.maxPayload = message.arg1;
      return this.client.getProperties(this.serial).then((function(_this) {
        return function(properties) {
          var prop;
          _this.authorized = true;
          return _this._writeMessage(A_CNXN, _this.version, _this.maxPayload, 'device::' + 　((function() {
            var _i, _len, _ref, _results;
            _ref = ['ro.product.name', 'ro.product.model', 'ro.product.device'];
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              prop = _ref[_i];
              _results.push("" + prop + "=" + properties[prop] + ";");
            }
            return _results;
          })()).join(''));
        };
      })(this))["catch"]((function(_this) {
        return function(err) {
          _this.emit('error', err);
          return _this.end();
        };
      })(this));
    };

    Socket.prototype._handleOpenMessage = function(message) {
      var command, localId, remoteId, service;
      if (!this.authorized) {
        return;
      }
      debug('A_OPEN', message);
      localId = message.arg0;
      remoteId = this.remoteId.next();
      service = message.data.slice(0, -1);
      command = service.toString().split(':', 1)[0];
      return this.client.transport(this.serial).then((function(_this) {
        return function(transport) {
          var parser, pump;
          if (_this.ended) {
            return;
          }
          debug("Calling " + service);
          _this.services.put(remoteId, transport);
          transport.write(Protocol.encodeData(service));
          parser = transport.parser;
          pump = function() {
            return new Promise(function(resolve, reject) {
              var maybeRead, out;
              out = parser.raw();
              maybeRead = function() {
                var chunk, _results;
                _results = [];
                while (chunk = _this._readChunk(out)) {
                  _results.push(_this._writeMessage(A_WRTE, remoteId, localId, chunk));
                }
                return _results;
              };
              out.on('readable', maybeRead);
              return out.on('end', resolve);
            });
          };
          parser.readAscii(4).then(function(reply) {
            switch (reply) {
              case Protocol.OKAY:
                _this._writeHeader(A_OKAY, remoteId, localId);
                return pump();
              case Protocol.FAIL:
                return parser.readError();
              default:
                return parser.unexpected(reply, 'OKAY or FAIL');
            }
          })["catch"](Parser.PrematureEOFError, function() {
            return true;
          })["finally"](function() {
            return _this._close(remoteId, localId);
          })["catch"](Parser.FailError, function(err) {
            debug("Unable to open transport: " + err);
            return _this.end();
          });
        };
      })(this));
    };

    Socket.prototype._handleOkayMessage = function(message) {
      var localId, remoteId;
      if (!this.authorized) {
        return;
      }
      debug('A_OKAY', message);
      localId = message.arg0;
      return remoteId = message.arg1;
    };

    Socket.prototype._handleCloseMessage = function(message) {
      var localId, remoteId;
      if (!this.authorized) {
        return;
      }
      debug('A_CLSE', message);
      localId = message.arg0;
      remoteId = message.arg1;
      return this._close(remoteId, localId);
    };

    Socket.prototype._handleWriteMessage = function(message) {
      var localId, remote, remoteId;
      if (!this.authorized) {
        return;
      }
      debug('A_WRTE', message);
      localId = message.arg0;
      remoteId = message.arg1;
      if (remote = this.services.get(remoteId)) {
        remote.write(message.data);
        this._writeHeader(A_OKAY, remoteId, localId);
      } else {
        debug("A_WRTE to unknown socket pair " + localId + "/" + remoteId);
      }
      return true;
    };

    Socket.prototype._handleAuthMessage = function(message) {
      debug('A_AUTH', message);
      return true;
    };

    Socket.prototype._close = function(remoteId, localId) {
      var remote;
      if (remote = this.services.remove(remoteId)) {
        remote.end();
        return this._writeHeader(A_CLSE, remoteId, localId);
      }
    };

    Socket.prototype._writeHeader = function(command, arg0, arg1, length, checksum) {
      var header;
      if (this.ended) {
        return;
      }
      header = new Buffer(24);
      header.writeUInt32LE(command, 0);
      header.writeUInt32LE(arg0 || 0, 4);
      header.writeUInt32LE(arg1 || 0, 8);
      header.writeUInt32LE(length || 0, 12);
      header.writeUInt32LE(checksum || 0, 16);
      header.writeUInt32LE(this._magic(command), 20);
      return this.socket.write(header);
    };

    Socket.prototype._writeMessage = function(command, arg0, arg1, data) {
      if (this.ended) {
        return;
      }
      if (!Buffer.isBuffer(data)) {
        data = new Buffer(data);
      }
      this._writeHeader(command, arg0, arg1, data.length, this._checksum(data));
      return this.socket.write(data);
    };

    Socket.prototype._validateMessage = function(message) {
      if (message.magic !== this._magic(message.command)) {
        throw new Error("Command failed magic check");
      }
      if (message.check !== this._checksum(message.data)) {
        throw new Error("Message checksum doesn't match received message");
      }
      return message;
    };

    Socket.prototype._readChunk = function(stream) {
      return stream.read(this.maxPayload) || stream.read();
    };

    Socket.prototype._checksum = function(data) {
      var char, sum, _i, _len;
      if (!Buffer.isBuffer(data)) {
        throw new Error("Unable to calculate checksum of non-Buffer");
      }
      sum = 0;
      for (_i = 0, _len = data.length; _i < _len; _i++) {
        char = data[_i];
        sum += char;
      }
      return sum;
    };

    Socket.prototype._magic = function(command) {
      return (command ^ 0xffffffff) >>> 0;
    };

    RollingCounter = (function() {
      function RollingCounter(max, min) {
        this.max = max;
        this.min = min != null ? min : 1;
        this.now = this.min;
      }

      RollingCounter.prototype.next = function() {
        if (!(this.now < this.max)) {
          this.now = this.min;
        }
        return ++this.now;
      };

      return RollingCounter;

    })();

    ServiceMap = (function() {
      function ServiceMap() {
        this.remotes = Object.create(null);
      }

      ServiceMap.prototype.end = function() {
        var remote, remoteId, _ref;
        _ref = this.remotes;
        for (remoteId in _ref) {
          remote = _ref[remoteId];
          remote.end();
        }
        this.remotes = Object.create(null);
      };

      ServiceMap.prototype.put = function(remoteId, socket) {
        return this.remotes[remoteId] = socket;
      };

      ServiceMap.prototype.get = function(remoteId) {
        return this.remotes[remoteId] || null;
      };

      ServiceMap.prototype.remove = function(remoteId) {
        var remote;
        if (remote = this.remotes[remoteId]) {
          delete this.remotes[remoteId];
          return remote;
        } else {
          return null;
        }
      };

      return ServiceMap;

    })();

    return Socket;

  })(EventEmitter);

  module.exports = Socket;

}).call(this);