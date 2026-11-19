import assert from 'node:assert/strict';
import { createBoardScriptObject, scriptMixins } from './object-functions.js';

const mixinName = 'board-script-test-mixin';
delete scriptMixins[mixinName];

const boardObject = createBoardScriptObject(7, `@Board 7
@mixin ${mixinName}
#let $ready = true
@endmixin
:receive
#end`);

assert.equal(boardObject.id, 'board-7');
assert.equal(boardObject.scope, 'board');
assert.equal(boardObject.name, 'Board 7');
assert.equal(boardObject.scriptTargetName, 'board');
assert.equal(boardObject.labels[':receive'][0], 1);
assert.equal(boardObject.resting, false);
assert.ok(scriptMixins[mixinName]);
for (const property of ['layer', 'x', 'y', 'sprite']) {
    assert.equal(Object.hasOwn(boardObject, property), false);
}

assert.equal(createBoardScriptObject(8), null);

delete scriptMixins[mixinName];
console.log('Board script object tests passed.');
