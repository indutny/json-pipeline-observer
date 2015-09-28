'use strict';

var util = require('util');
var Readable = require('stream').Readable;

function Observer(pipeline) {
  Readable.call(this, {
    objectMode: true,
    read: function() {}
  });

  this.pipeline = pipeline;

  this.uid = 0;
  this.uidMap = new Map();

  this.attach();
}
util.inherits(Observer, Readable);
module.exports = Observer;

Observer.create = function create(pipeline) {
  return new Observer(pipeline);
};

Observer.prototype.attach = function attach() {
  this.observeMethod(this.pipeline, 'create', null, this.onCreate);
};

Observer.prototype.finish = function finish() {
  var self = this;

  // Ensure that Object.observe callbacks are invoked
  setImmediate(function() {
    self.push(null);
  });
};

Observer.prototype.getUID = function getUID(node) {
  if (this.uidMap.has(node))
    return this.uidMap.get(node);

  var uid = this.uid++;
  this.uidMap.set(node, uid);
  return uid;
};

Observer.prototype.observeMethod = function observeMethod(obj, method, before,
                                                          after) {
  var self = this;

  var old = obj[method];
  obj[method] = function() {
    var args = Array.prototype.slice.call(arguments);

    if (before)
      before.apply(self, [ this ].concat(args));
    var res = old.apply(this, arguments);
    if (after)
      after.apply(self, [ res, this ].concat(args));
    return res;
  };
};

Observer.prototype.observeObj = function observeObj(obj, callback) {
  var self = this;
  Object.observe(obj, function(changes) {
    changes.forEach(function(change) {
      callback.call(self, change);
    });
  });
};

Observer.prototype.observeArray = function observeArray(arr, callback) {
  // Existing
  arr.forEach(function(elem, i) {
    callback.call(this, { type: 'add', object: arr, name: i });
  }, this);

  // New
  this.observeObj(arr, callback);
};

Observer.prototype.observeProperty = function observeProperty(obj, prop, cb) {
  var value = obj[prop];
  var self = this;
  Object.defineProperty(obj, prop, {
    configurable: false,
    enumerable: true,

    get: function() {
      return value;
    },
    set: function(newValue) {
      cb.call(self, value, newValue);
      value = newValue;
    }
  });
};

Observer.prototype.onCreate = function onCreate(node) {
  this.push({
    action: 'create',
    node: node.index,
    opcode: node.opcode
  });

  var uid = this.getUID(node);

  this.observeProperty(node, 'index', function(from, to) {
    this.push({
      action: 'changeIndex', node: uid, from: from, to: to
    });
  });

  this.observeProperty(node, 'opcode', function(from, to) {
    this.push({
      action: 'changeOpcode', node: uid, from: from, to: to
    });
  });

  this.observeArray(node.inputs, function(change) {
    this.onArrayChange('Input', 'inputs', node, uid, change);
  });

  this.observeArray(node.control, function(change) {
    this.onArrayChange('Control', 'control', node, uid, change);
  });

  this.observeArray(node.literals, function(change) {
    this.onLiteralChange(node, uid, change);
  });
};

Observer.prototype.onArrayChange = function onArrayChange(postfix,
                                                          prop,
                                                          node,
                                                          uid,
                                                          change) {
  var index = change.name | 0;
  if (change.name.toString() !== index.toString())
    return;

  if (change.type === 'add') {
    this.push({
      action: 'add' + postfix,
      node: uid,
      other: this.getUID(node[prop][index])
    });
  } else if (change.type === 'delete') {
    this.push({
      action: 'remove' + postfix,
      node: uid,
      old: this.getUID(change.oldValue),
      index: index
    });
  } else if (change.type === 'update') {
    this.push({
      action: 'replace' + postfix,
      node: uid,
      index: index,
      from: this.getUID(change.oldValue),
      to: this.getUID(node[prop][index])
    });
  }
};

Observer.prototype.onLiteralChange = function onLiteralChange(node,
                                                              uid,
                                                              change) {
  var index = change.name | 0;
  if (change.name.toString() !== index.toString())
    return;

  if (change.type === 'add') {
    this.push({
      action: 'addLiteral',
      node: uid,
      other: node.literals[index]
    });
  } else if (change.type === 'delete') {
    this.push({
      action: 'removeLiteral',
      node: uid,
      old: change.oldValue,
      index: index
    });
  } else if (change.type === 'update') {
    this.push({
      action: 'replaceLiteral',
      node: uid,
      index: index,
      from: change.oldValue,
      to: node.literals[index]
    });
  }
};
