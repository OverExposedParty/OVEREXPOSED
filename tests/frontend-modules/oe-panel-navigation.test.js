const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const navigationPath = path.join(
  __dirname,
  '../../public/scripts/oe-panel/core/oe-panel-navigation.js'
);

test('OE panel section links preserve table series and expansion requests', () => {
  const dom = new JSDOM('<!doctype html>', { runScripts: 'dangerously' });
  const { window } = dom;
  let request;

  try {
    window.eval(fs.readFileSync(navigationPath, 'utf8'));
    window.OE_PANEL_NAVIGATION.bindSectionLinkRequests((detail) => {
      request = detail;
    });
    window.dispatchEvent(
      new window.CustomEvent('oe-panel-section-link-request', {
        detail: {
          section: 'Achievements',
          gridId: 'achievements-grid-2',
          query: '[key:first-win]',
          series: 'library',
          expandFirstMatch: true
        }
      })
    );

    assert.deepEqual(
      { ...request },
      {
        section: 'Achievements',
        gridId: 'achievements-grid-2',
        query: '[key:first-win]',
        series: 'library',
        expandFirstMatch: true
      }
    );
  } finally {
    dom.window.close();
  }
});
