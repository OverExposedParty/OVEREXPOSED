const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const responsiveStylesheetPath = path.join(
  __dirname,
  '../../public/css/general/settings/responsive.css'
);

test('portrait account containers use 85% width and proportional height', () => {
  const stylesheet = fs.readFileSync(responsiveStylesheetPath, 'utf8');
  const portraitStart = stylesheet.indexOf('@media (orientation: portrait)');
  const landscapeStart = stylesheet.indexOf(
    '@media (max-width: 768px) and (orientation: landscape)'
  );
  const portraitStyles = stylesheet.slice(portraitStart, landscapeStart);
  const accountContainerStyles = portraitStyles.match(
    /\.account-container\s*\{([^}]*)\}/
  )?.[1];
  const expandedPanelStyles = portraitStyles.match(
    /\.account-expanded-panel\s*\{([^}]*)\}/
  )?.[1];
  const actionContainerStyles = portraitStyles.match(
    /\.account-button-container\s*\{([^}]*)\}/
  )?.[1];
  const footerStyles = portraitStyles.match(
    /\.account-footer\s*\{([^}]*)\}/
  )?.[1];

  assert.ok(portraitStart >= 0, 'portrait account styles should exist');
  assert.ok(
    landscapeStart > portraitStart,
    'portrait account styles should be complete'
  );
  assert.match(accountContainerStyles || '', /width:\s*min\(85vw,\s*420px\);/);
  assert.match(expandedPanelStyles || '', /width:\s*100%;/);
  assert.match(expandedPanelStyles || '', /height:\s*auto;/);
  assert.match(expandedPanelStyles || '', /aspect-ratio:\s*14\s*\/\s*15;/);
  assert.match(
    actionContainerStyles || '',
    /min-height:\s*min\(42\.5vw,\s*210px\);/
  );
  assert.match(footerStyles || '', /min-height:\s*min\(14\.5714vw,\s*72px\);/);
});
