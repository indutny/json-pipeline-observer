'use strict';

var assert = require('assert');
var pipeline = require('json-pipeline');

var observer = require('../');

function check(o, done, expected) {
  var log = [];
  o.on('data', function(entry) {
    log.push(entry);
  });
  o.on('end', function() {
    assert.deepEqual(log, expected);
    done();
  });

  o.finish();
}

describe('Observer', function() {
  var p;
  var o;
  beforeEach(function() {
    p = pipeline.create();
    o = observer.create(p);
  });

  it('should observe addition of nodes/inputs', function(done) {
    var node = p.create('node', p.create('first-input'));
    node.addInput(p.create('second-input'));

    check(o, done, [
      { action: 'create', node: 0, opcode: 'first-input' },
      { action: 'create', node: 1, opcode: 'node' },
      { action: 'addInput', node: 1, other: 0 },
      { action: 'create', node: 2, opcode: 'second-input' },
      { action: 'addInput', node: 1, other: 2 }
    ]);
  });

  it('should observe removal of inputs', function(done) {
    var node = p.create('node', [
      p.create('first-input'),
      p.create('second-input') ]);
    node.clearInputs();

    check(o, done, [
      { action: 'create', node: 0, opcode: 'first-input' },
      { action: 'create', node: 1, opcode: 'second-input' },
      { action: 'create', node: 2, opcode: 'node' },
      { action: 'addInput', node: 2, other: 0 },
      { action: 'addInput', node: 2, other: 1 },
      { action: 'removeInput', node: 2, old: 1, index: 1 },
      { action: 'removeInput', node: 2, old: 0, index: 0 }
    ]);
  });

  it('should observe replacement of inputs', function(done) {
    var node = p.create('node', [
      p.create('first-input'),
      p.create('second-input') ]);
    node.replaceInput(0, p.create('replacement'));

    check(o, done, [
      { action: 'create', node: 0, opcode: 'first-input' },
      { action: 'create', node: 1, opcode: 'second-input' },
      { action: 'create', node: 2, opcode: 'node' },
      { action: 'addInput', node: 2, other: 0 },
      { action: 'addInput', node: 2, other: 1 },
      { action: 'create', node: 3, opcode: 'replacement' },
      { action: 'replaceInput', node: 2, index: 0, from: 0, to: 3 }
    ]);
  });

  it('should observe change of opcode', function(done) {
    var node = p.create('node');
    node.opcode = 'new-node';

    check(o, done, [
      { action: 'create', node: 0, opcode: 'node' },
      { action: 'changeOpcode', node: 0, from: 'node', to: 'new-node' }
    ]);
  });

  it('should observe change of index', function(done) {
    var node = p.create('node');
    var other = p.create('other-node');
    p.remove(node);

    check(o, done, [
      { action: 'create', node: 0, opcode: 'node' },
      { action: 'create', node: 1, opcode: 'other-node' },
      { action: 'changeIndex', node: 0, from: 0, to: -1 },
      { action: 'changeIndex', node: 1, from: 1, to: 0 }
    ]);
  });
});
