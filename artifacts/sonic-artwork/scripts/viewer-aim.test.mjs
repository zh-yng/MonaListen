import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { screenPointToNdc } from '../src/lib/viewer-aim.ts';

test('camera-center aim remains centered', () => {
  assert.deepEqual(screenPointToNdc({ x: 200, y: 400 }, { left: 0, top: 0, width: 400, height: 800 }), { x: 0, y: 0 });
});

test('a lower visible circle aims lower rather than at the optical center', () => {
  assert.deepEqual(screenPointToNdc({ x: 200, y: 600 }, { left: 0, top: 0, width: 400, height: 800 }), { x: 0, y: -0.5 });
});

test('offset and scrolled renderer bounds use the same viewport coordinate system', () => {
  assert.deepEqual(screenPointToNdc({ x: 230, y: 420 }, { left: 30, top: -180, width: 400, height: 800 }), { x: 0, y: -0.5 });
});

test('orientation changes do not introduce a vertical coordinate bias', () => {
  assert.deepEqual(screenPointToNdc({ x: 600, y: 100 }, { left: 0, top: 0, width: 800, height: 400 }), { x: 0.5, y: 0.5 });
});

test('missing, invalid, or out-of-view aim fades instead of choosing a different point', () => {
  const viewport = { left: 0, top: 0, width: 400, height: 800 };
  for (const point of [{ x: NaN, y: 400 }, { x: -1, y: 400 }, { x: 200, y: 801 }]) {
    assert.equal(screenPointToNdc(point, viewport), null);
  }
  assert.equal(screenPointToNdc({ x: 200, y: 400 }, { ...viewport, width: 0 }), null);
});

test('unprojected aim intersects the artwork at the detail beneath the reticle', () => {
  for (const viewport of [
    { left: 0, top: 0, width: 393, height: 852 },
    { left: 20, top: -160, width: 844, height: 390 },
  ]) {
    const camera = new PerspectiveCamera(50, viewport.width / viewport.height, 0.1, 10);
    camera.position.set(0, 0, 2);
    camera.updateMatrixWorld(true);
    const detail = new Vector3(0.15, -0.25, 0);
    const projected = detail.clone().project(camera);
    const focus = {
      x: viewport.left + (projected.x + 1) * viewport.width / 2,
      y: viewport.top + (1 - projected.y) * viewport.height / 2,
    };
    const aim = screenPointToNdc(focus, viewport);
    assert.ok(aim);
    const direction = new Vector3(aim.x, aim.y, 0.5).unproject(camera).sub(camera.position).normalize();
    const intersection = camera.position.clone().addScaledVector(direction, -camera.position.z / direction.z);
    assert.ok(intersection.distanceTo(detail) < 1e-9, 'Ray must hit the actual detail, not a point above it');
  }
});
