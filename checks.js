
exports.http = function(res, on_error) {
  var statusCode = this.config.statusCode === undefined ? 200 : this.config.statusCode;
  if (res.statusCode !== statusCode) {
    return on_error('critical', this.name + " response: " + res.statusCode + ' (expected ' + statusCode + ')');
  }
  if (this.config.bodyMatch !== undefined) {
    if (!res.body.match(this.config.bodyMatch)) {
      return on_error('critical', this.name + " body doesn't match " + this.config.bodyMatch);
    }
  }
  if (this.config.duration !== undefined && res.duration >= this.config.duration) {
    return on_error('warning', this.name + " took " + res.duration + "s (warning at " + this.config.duration + "s)");
  }
  on_error('ok', this.name + ' ok');
};

exports.http_200 = function(res, on_error) {
  if (res.statusCode === 200) {
    on_error('ok', this.name + " response: " + res.statusCode);
  }
  else {
    on_error('critical', this.name + " response: " + res.statusCode);
  }
};

exports.value = function(res, on_error) {
  if (typeof this.config.critical !== undefined) {
    if (res >= this.config.critical) {
      return on_error('critical', this.name + ' exceeds ' + this.config.critical);
    }
  }
  if (typeof this.config.warning !== undefined) {
    if (res >= this.config.warning) {
      return on_error('warning', this.name + ' exceeds ' + this.config.warning);
    }
  }
  on_error('ok', this.name + ' ok');
};

