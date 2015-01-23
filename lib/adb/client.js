(function() {
  var ClearCommand, Client, Connection, ForwardCommand, FrameBufferCommand, GetDevicePathCommand, GetFeaturesCommand, GetPackagesCommand, GetPropertiesCommand, GetSerialNoCommand, GetStateCommand, HostDevicesCommand, HostDevicesWithPathsCommand, HostKillCommand, HostTrackDevicesCommand, HostTransportCommand, HostVersionCommand, InstallCommand, IsInstalledCommand, ListForwardsCommand, LogCommand, Logcat, LogcatCommand, Monkey, MonkeyCommand, Parser, ProcStat, Promise, RebootCommand, RemountCommand, ScreencapCommand, ShellCommand, StartActivityCommand, Sync, SyncCommand, TcpCommand, TcpUsbServer, TrackJdwpCommand, UninstallCommand, WaitBootCompleteCommand, debug;

  Monkey = require('adbkit-monkey');

  Logcat = require('adbkit-logcat');

  Promise = require('bluebird');

  debug = require('debug')('adb:client');

  Connection = require('./connection');

  Sync = require('./sync');

  Parser = require('./parser');

  ProcStat = require('./proc/stat');

  HostVersionCommand = require('./command/host/version');

  HostDevicesCommand = require('./command/host/devices');

  HostDevicesWithPathsCommand = require('./command/host/deviceswithpaths');

  HostTrackDevicesCommand = require('./command/host/trackdevices');

  HostKillCommand = require('./command/host/kill');

  HostTransportCommand = require('./command/host/transport');

  ClearCommand = require('./command/host-transport/clear');

  FrameBufferCommand = require('./command/host-transport/framebuffer');

  GetFeaturesCommand = require('./command/host-transport/getfeatures');

  GetPackagesCommand = require('./command/host-transport/getpackages');

  GetPropertiesCommand = require('./command/host-transport/getproperties');

  InstallCommand = require('./command/host-transport/install');

  IsInstalledCommand = require('./command/host-transport/isinstalled');

  LogcatCommand = require('./command/host-transport/logcat');

  LogCommand = require('./command/host-transport/log');

  MonkeyCommand = require('./command/host-transport/monkey');

  RebootCommand = require('./command/host-transport/reboot');

  RemountCommand = require('./command/host-transport/remount');

  ScreencapCommand = require('./command/host-transport/screencap');

  ShellCommand = require('./command/host-transport/shell');

  StartActivityCommand = require('./command/host-transport/startactivity');

  SyncCommand = require('./command/host-transport/sync');

  TcpCommand = require('./command/host-transport/tcp');

  TrackJdwpCommand = require('./command/host-transport/trackjdwp');

  UninstallCommand = require('./command/host-transport/uninstall');

  WaitBootCompleteCommand = require('./command/host-transport/waitbootcomplete');

  ForwardCommand = require('./command/host-serial/forward');

  GetDevicePathCommand = require('./command/host-serial/getdevicepath');

  GetSerialNoCommand = require('./command/host-serial/getserialno');

  GetStateCommand = require('./command/host-serial/getstate');

  ListForwardsCommand = require('./command/host-serial/listforwards');

  TcpUsbServer = require('./tcpusb/server');

  Client = (function() {
    function Client(options) {
      var _base, _base1;
      this.options = options != null ? options : {};
      (_base = this.options).port || (_base.port = 5037);
      (_base1 = this.options).bin || (_base1.bin = 'adb');
    }

    Client.prototype.createTcpUsbBridge = function(serial) {
      return new TcpUsbServer(this, serial);
    };

    Client.prototype.connection = function() {
      var conn, connectListener, errorListener, resolver;
      resolver = Promise.defer();
      conn = new Connection(this.options).on('error', errorListener = function(err) {
        return resolver.reject(err);
      }).on('connect', connectListener = function() {
        return resolver.resolve(conn);
      }).connect();
      return resolver.promise["finally"](function() {
        conn.removeListener('error', errorListener);
        return conn.removeListener('connect', connectListener);
      });
    };

    Client.prototype.version = function(callback) {
      return this.connection().then(function(conn) {
        return new HostVersionCommand(conn).execute();
      }).nodeify(callback);
    };

    Client.prototype.listDevices = function(callback) {
      return this.connection().then(function(conn) {
        return new HostDevicesCommand(conn).execute();
      }).nodeify(callback);
    };

    Client.prototype.listDevicesWithPaths = function(callback) {
      return this.connection().then(function(conn) {
        return new HostDevicesWithPathsCommand(conn).execute();
      }).nodeify(callback);
    };

    Client.prototype.trackDevices = function(callback) {
      return this.connection().then(function(conn) {
        return new HostTrackDevicesCommand(conn).execute();
      }).nodeify(callback);
    };

    Client.prototype.kill = function(callback) {
      return this.connection().then(function(conn) {
        return new HostKillCommand(conn).execute();
      }).nodeify(callback);
    };

    Client.prototype.getSerialNo = function(serial, callback) {
      return this.connection().then(function(conn) {
        return new GetSerialNoCommand(conn).execute(serial);
      }).nodeify(callback);
    };

    Client.prototype.getDevicePath = function(serial, callback) {
      return this.connection().then(function(conn) {
        return new GetDevicePathCommand(conn).execute(serial);
      }).nodeify(callback);
    };

    Client.prototype.getState = function(serial, callback) {
      return this.connection().then(function(conn) {
        return new GetStateCommand(conn).execute(serial);
      }).nodeify(callback);
    };

    Client.prototype.getProperties = function(serial, callback) {
      return this.transport(serial).then(function(transport) {
        return new GetPropertiesCommand(transport).execute();
      }).nodeify(callback);
    };

    Client.prototype.getFeatures = function(serial, callback) {
      return this.transport(serial).then(function(transport) {
        return new GetFeaturesCommand(transport).execute();
      }).nodeify(callback);
    };

    Client.prototype.getPackages = function(serial, callback) {
      return this.transport(serial).then(function(transport) {
        return new GetPackagesCommand(transport).execute();
      }).nodeify(callback);
    };

    Client.prototype.forward = function(serial, local, remote, callback) {
      return this.connection().then(function(conn) {
        return new ForwardCommand(conn).execute(serial, local, remote);
      }).nodeify(callback);
    };

    Client.prototype.listForwards = function(serial, callback) {
      return this.connection().then(function(conn) {
        return new ListForwardsCommand(conn).execute(serial);
      }).nodeify(callback);
    };

    Client.prototype.transport = function(serial, callback) {
      return this.connection().then(function(conn) {
        return new HostTransportCommand(conn).execute(serial)["return"](conn);
      }).nodeify(callback);
    };

    Client.prototype.shell = function(serial, command, callback) {
      return this.transport(serial).then(function(transport) {
        return new ShellCommand(transport).execute(command);
      }).nodeify(callback);
    };

    Client.prototype.reboot = function(serial, callback) {
      return this.transport(serial).then(function(transport) {
        return new RebootCommand(transport).execute();
      }).nodeify(callback);
    };

    Client.prototype.remount = function(serial, callback) {
      return this.transport(serial).then(function(transport) {
        return new RemountCommand(transport).execute();
      }).nodeify(callback);
    };

    Client.prototype.trackJdwp = function(serial, callback) {
      return this.transport(serial).then(function(transport) {
        return new TrackJdwpCommand(transport).execute();
      }).nodeify(callback);
    };

    Client.prototype.framebuffer = function(serial, format, callback) {
      if (format == null) {
        format = 'raw';
      }
      if (typeof format === 'function') {
        callback = format;
        format = 'raw';
      }
      return this.transport(serial).then(function(transport) {
        return new FrameBufferCommand(transport).execute(format);
      }).nodeify(callback);
    };

    Client.prototype.screencap = function(serial, callback) {
      return this.transport(serial).then((function(_this) {
        return function(transport) {
          return new ScreencapCommand(transport).execute()["catch"](function(err) {
            debug("Emulating screencap command due to '" + err + "'");
            return _this.framebuffer(serial, 'png');
          });
        };
      })(this)).nodeify(callback);
    };

    Client.prototype.openLog = function(serial, name, callback) {
      return this.transport(serial).then(function(transport) {
        return new LogCommand(transport).execute(name);
      }).nodeify(callback);
    };

    Client.prototype.openTcp = function(serial, port, host, callback) {
      if (typeof host === 'function') {
        callback = host;
        host = void 0;
      }
      return this.transport(serial).then(function(transport) {
        return new TcpCommand(transport).execute(port, host);
      }).nodeify(callback);
    };

    Client.prototype.openMonkey = function(serial, port, callback) {
      var tryConnect;
      if (port == null) {
        port = 1080;
      }
      if (typeof port === 'function') {
        callback = port;
        port = 1080;
      }
      tryConnect = (function(_this) {
        return function(times) {
          return _this.openTcp(serial, port).then(function(stream) {
            return Monkey.connectStream(stream);
          })["catch"](function(err) {
            if (times -= 1) {
              debug("Monkey can't be reached, trying " + times + " more times");
              return Promise.delay(100).then(function() {
                return tryConnect(times);
              });
            } else {
              throw err;
            }
          });
        };
      })(this);
      return tryConnect(1)["catch"](function(err) {
        return this.transport(serial);
      }).then(function(transport) {
        return new MonkeyCommand(transport).execute(port);
      }).then(function(out) {
        return tryConnect(20);
      }).then(function(monkey) {
        return monkey.once('end', function() {
          return out.end();
        });
      }).nodeify(callback);
    };

    Client.prototype.openLogcat = function(serial, options, callback) {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      return this.transport(serial).then(function(transport) {
        return new LogcatCommand(transport).execute(options);
      }).then(function(stream) {
        return Logcat.readStream(stream, {
          fixLineFeeds: false
        });
      }).nodeify(callback);
    };

    Client.prototype.openProcStat = function(serial, callback) {
      return this.syncService(serial).then(function(sync) {
        return new ProcStat(sync);
      }).nodeify(callback);
    };

    Client.prototype.clear = function(serial, pkg, callback) {
      return this.transport(serial).then(function(transport) {
        return new ClearCommand(transport).execute(pkg);
      }).nodeify(callback);
    };

    Client.prototype.install = function(serial, apk, callback) {
      var temp;
      temp = Sync.temp(typeof apk === 'string' ? apk : '_stream.apk');
      return this.push(serial, apk, temp).then((function(_this) {
        return function(transfer) {
          var endListener, errorListener, resolver;
          resolver = Promise.defer();
          transfer.on('error', errorListener = function(err) {
            return resolver.reject(err);
          });
          transfer.on('end', endListener = function() {
            return resolver.resolve(_this.installRemote(serial, temp));
          });
          return resolver.promise["finally"](function() {
            transfer.removeListener('error', errorListener);
            return transfer.removeListener('end', endListener);
          });
        };
      })(this)).nodeify(callback);
    };

    Client.prototype.installRemote = function(serial, apk, callback) {
      return this.transport(serial).then((function(_this) {
        return function(transport) {
          return new InstallCommand(transport).execute(apk).then(function() {
            return _this.shell(serial, ['rm', '-f', apk]);
          }).then(function(stream) {
            return new Parser(stream).readAll();
          }).then(function(out) {
            return true;
          });
        };
      })(this)).nodeify(callback);
    };

    Client.prototype.uninstall = function(serial, pkg, callback) {
      return this.transport(serial).then(function(transport) {
        return new UninstallCommand(transport).execute(pkg);
      }).nodeify(callback);
    };

    Client.prototype.isInstalled = function(serial, pkg, callback) {
      return this.transport(serial).then(function(transport) {
        return new IsInstalledCommand(transport).execute(pkg);
      }).nodeify(callback);
    };

    Client.prototype.startActivity = function(serial, options, callback) {
      return this.transport(serial).then(function(transport) {
        return new StartActivityCommand(transport).execute(options);
      }).nodeify(callback);
    };

    Client.prototype.syncService = function(serial, callback) {
      return this.transport(serial).then(function(transport) {
        return new SyncCommand(transport).execute();
      }).nodeify(callback);
    };

    Client.prototype.stat = function(serial, path, callback) {
      return this.syncService(serial).then(function(sync) {
        return sync.stat(path)["finally"](function() {
          return sync.end();
        });
      }).nodeify(callback);
    };

    Client.prototype.readdir = function(serial, path, callback) {
      return this.syncService(serial).then(function(sync) {
        return sync.readdir(path)["finally"](function() {
          return sync.end();
        });
      }).nodeify(callback);
    };

    Client.prototype.pull = function(serial, path, callback) {
      return this.syncService(serial).then(function(sync) {
        return sync.pull(path).on('end', function() {
          return sync.end();
        });
      }).nodeify(callback);
    };

    Client.prototype.push = function(serial, contents, path, mode, callback) {
      if (typeof mode === 'function') {
        callback = mode;
        mode = void 0;
      }
      return this.syncService(serial).then(function(sync) {
        return sync.push(contents, path, mode).on('end', function() {
          return sync.end();
        });
      }).nodeify(callback);
    };

    Client.prototype.waitBootComplete = function(serial, callback) {
      return this.transport(serial).then(function(transport) {
        return new WaitBootCompleteCommand(transport).execute();
      }).nodeify(callback);
    };

    return Client;

  })();

  module.exports = Client;

}).call(this);