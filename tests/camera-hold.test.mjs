import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraHold} from '../house3d/web/camera-hold.js';

test('orbit holds throughout a drag and for 30 seconds after the latest adjustment',()=>{
 const c=cameraHold();
 c.start();c.change();assert.ok(c.blocked(50000));c.end(50000);
 assert.ok(c.blocked(75000));c.start();c.change();c.end(76000);
 assert.ok(c.blocked(105999));assert.equal(c.resume(105999),false);
 assert.equal(c.blocked(106000),false);assert.ok(c.resume(106000));assert.equal(c.resume(106001),false);
});

test('clicks and programmatic changes do not claim the camera; selecting a shot releases it',()=>{
 const c=cameraHold();c.change();c.start();c.end(1);
 assert.equal(c.blocked(2),false);assert.equal(c.resume(30002),false);
 c.start();c.change();c.end(3);c.reset();assert.equal(c.blocked(4),false);assert.equal(c.resume(30004),false);
});
