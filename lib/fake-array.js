'use strict';

var util = require('util');

function FakeArray(callback) {
  Array.call(this);

  this._length = 0;
  this.callback = callback;

  var self = this;
  Object.defineProperty(this, 'length', {
    enumerable: false,
    configurable: false,

    get: function() {
      return self._getLength();
    },
    set: function(value) {
      return self._setLength(value);
    }
  });
}
util.inherits(FakeArray, Array);
module.exports = FakeArray;

FakeArray.prototype._getLength = function _getLength() {
  return this._length;
};

FakeArray.prototype._setLength = function _setLength(value) {
  // Delete on contraction
  for (var i = this._length - 1; i >= value; i--) {
    this.callback({
      type: 'delete',
      name: i,
      oldValue: this[i]
    });

    this._undefElem(i);
  }

  // Add on expansion
  for (var i = this._length; i < value; i++) {
    this._defElem(i);

    this.callback({
      type: 'add',
      name: i
    });
  }

  this._length = value;
};

FakeArray.prototype._undefElem = function _undefElem(index) {
  Object.defineProperty(this, index, {
    configurable: true,
    enumerable: false,

    writable: true,
    readable: true
  });
};

FakeArray.prototype._defElem = function _defElem(index) {
  var value = this[index];

  var self = this;
  Object.defineProperty(this, index, {
    configurable: true,
    enumerable: false,

    get: function() {
      return value;
    },
    set: function(newValue) {
      var oldValue = value;
      value = newValue;
      self.callback({ type: 'update', name: index, oldValue: oldValue });
    }
  });
};
