
var dgram = require('dgram')
, util    = require('util')
, checks  = require('./checks')
, notify  = require('./notify')
, fetch   = require('./fetch')

var array_unique = function(array) {
  var a = [];
  var l = array.length;
  for(var i=0; i<l; i++) {
    for(var j=i+1; j<l; j++) {
      // If array[i] is found later in the array
      if (array[i] === array[j])
        j = ++i;
    }
    a.push(array[i]);
  }
  return a;
};

var Monitor = function(app_config, name, config) {
  this.app_config = app_config;
  this.name = name;
  this.config = config;

  if (typeof config.fetch === 'string') {
    if (!config.check) {
      config.check = config.fetch;
    }
    this.fetch = fetch[config.fetch].bind(this);
  }
  else if (typeof config.fetch === 'function') {
    this.fetch = config.fetch.bind(this);
  }
  if (typeof config.check === 'string') {
    this.check_value = checks[config.check].bind(this);
  }
  else if (typeof config.check === 'function') {
    this.check_value = config.check.bind(this);
  }
  this.state = 'ok';
  this.stats = {
    ok:0,
    warning:0,
    critical:0
  };
};

Monitor.prototype.start = function() {
    if (this.config.interval && !this._timer) {
      var self = this;
      this._timer = setInterval(function() {self.pull();}, 1000 * this.config.interval);
    }
};

Monitor.prototype.stop = function() {
  if (this._timer) {
    clearInterval(this._timer);
    this._timer = null;
  }
};

Monitor.prototype.pull = function() {
  var self = this;
  this.fetch(function(response) {
    self.check(response);
  });
};

Monitor.prototype.check = function(value) {
  var self = this;
  this.check_value(value, function(level, error) {
    if (level !== self.state || (level !== 'ok' && self.last_notification_time < (new Date).getTime() - (1000 * (self.config.contact_repeat_rate||3600)))) {
      var contacts = self.get_contacts();
      contacts.forEach(function(contact) {
        var method = contact.method || notify.email;
        if (typeof method === 'string') {
          method = notify[method].bind(self);
        }
        else {
          method = method.bind(self);
        }
        method(contact, value, level, error);
      });

      ++self.stats[level];
      self.last_notification_time = (new Date).getTime();
      self.state = level;
    }
  });
};

Monitor.prototype.get_contacts = function(optional_property) {
  var self = this;
  function _get(name) {
    var contacts = [];
    var contact = self.app_config.contacts[name];
    if (typeof contact === 'string') {
      contacts = contacts.concat(_get(contact));
    }
    else if (util.isArray(contact)) {
      contact.forEach(function(c) {
        contacts = contacts.concat(_get(c));
      });
    }
    else if (typeof contact === 'object') {
      contacts.push(contact);
    }
    return array_unique(contacts);
  }
  var contacts;
  if (this.config.contact) {
    contacts = _get(this.config.contact);
  }
  else {
    contacts = [this.config];
  }
  if (optional_property) {
    contacts = contacts.map(function(c) {return c[optional_property];}).filter(function(c) {return c !== undefined;});
  }
  return contacts;
};

var monitor_list = [];
var monitors = {};
var server;

exports.monitors = function() {
  return monitor_list;
};

exports.configure = function(config) {

  monitor_list.forEach(function(m) {m.stop();});
  monitor_list = [];
  monitors = {};

  Object.keys(config.services).forEach(function(name) {
    var monitor = new Monitor(config, name, config.services[name]);
    monitors[name] = monitor;
    monitor_list.push(monitor);
    monitor.start();
  });

  if (server === undefined && typeof config.port === 'number') {

    server = dgram.createSocket('udp4', function (msg, rinfo) {
      if (config.dumpMessages) { util.log(msg.toString()); }
      var bits = msg.toString().split(':');
      var key = bits.shift()
        .replace(/\s+/g, '_')
        .replace(/\//g, '-')
        .replace(/[^a-zA-Z_\-0-9\.]/g, '');

      if (listeners[key]) {
        var value;
        if (bits.length == 0) {
          value = 0;
        }
        else {
          value = bits.join(':');
        }
        listeners[key].check(value);
      }
    });

    server.bind(config.port || 8135, config.address || undefined);

    util.log("server is up");

  }
};

if (module.parent === null && process.argv.length > 1) {
  var config = require('./config');
  config.configFile(process.argv[2], function(config, oldConfig) {
    exports.configure(config);
  });
}


