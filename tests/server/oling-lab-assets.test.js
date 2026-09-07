const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const express = require('express');

const { configureMiddleware } = require('../../server/middleware');

let baseUrl;
let server;

before(
  () =>
    new Promise((resolve) => {
      const app = express();
      configureMiddleware(app);
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    })
);

after(
  () =>
    new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    })
);

test('serves Oling Lab assets from their new directory', async () => {
  const response = await fetch(
    `${baseUrl}/images/olings/lab/eggs/base/egg.svg`
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^image\/svg\+xml/);
});

test('serves the Disposable Oling Pod artwork', async () => {
  const response = await fetch(
    `${baseUrl}/images/olings/lab/items/oling-pods/disposable/artwork.svg`
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^image\/svg\+xml/);
});

test('serves every Disposable Oling Pod composition layer', async () => {
  for (const layer of ['back', 'front', 'base']) {
    const response = await fetch(
      `${baseUrl}/images/olings/lab/items/oling-pods/disposable/layers/${layer}.svg`
    );

    assert.equal(response.status, 200, `${layer}.svg should be available`);
    assert.match(response.headers.get('content-type'), /^image\/svg\+xml/);
  }
});

test('serves every configured Oling Lab furniture placement sound', async () => {
  const folders = [
    'tables/standard-table',
    'incubators/incubeta',
    'door-modules/explorer-gateway',
    'beds/oling-bed',
    'storage/supply-shelf',
    'storage/pod-rack',
    'ceiling-lights/basic-hanging-light'
  ];

  for (const folder of folders) {
    const response = await fetch(
      `${baseUrl}/sounds/olings/lab/furniture/${folder}/placed.wav`
    );
    assert.equal(
      response.status,
      200,
      `${folder}/placed.wav should be available`
    );
    assert.match(response.headers.get('content-type'), /^audio\/wav/);
  }
});

test('serves the Oling Lab roaming edge-impact sound', async () => {
  const response = await fetch(
    `${baseUrl}/sounds/olings/lab/roaming/edge-hit.wav`
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^audio\/wav/);
});

test('redirects persisted legacy Oling Lab asset URLs', async () => {
  const response = await fetch(
    `${baseUrl}/images/olings/eggs/base/egg.svg?v=legacy`,
    { redirect: 'manual' }
  );

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('location'),
    '/images/olings/lab/eggs/base/egg.svg?v=legacy'
  );
});
