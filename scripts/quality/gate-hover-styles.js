const fs = require('node:fs');
const path = require('node:path');

const HOVER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
const CSS_ROOT = path.resolve(__dirname, '../../public/css');
const EXCLUDED_STYLESHEETS = new Set([
  path.join(CSS_ROOT, 'oe-panel/oe-panel/dashboard-widgets.css')
]);

function scanUntilBoundary(source, startIndex) {
  let quote = null;
  let parentheses = 0;
  let brackets = 0;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (quote) {
      if (character === '\\') {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      const commentEnd = source.indexOf('*/', index + 2);
      if (commentEnd === -1) return { index: source.length, type: 'end' };
      index = commentEnd + 1;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(') {
      parentheses += 1;
    } else if (character === ')') {
      parentheses = Math.max(0, parentheses - 1);
    } else if (character === '[') {
      brackets += 1;
    } else if (character === ']') {
      brackets = Math.max(0, brackets - 1);
    } else if (parentheses === 0 && brackets === 0) {
      if (character === '{') return { index, type: 'block' };
      if (character === ';') return { index, type: 'statement' };
    }
  }

  return { index: source.length, type: 'end' };
}

function findClosingBrace(source, openingIndex) {
  let depth = 1;
  let quote = null;

  for (let index = openingIndex + 1; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (quote) {
      if (character === '\\') {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      const commentEnd = source.indexOf('*/', index + 2);
      if (commentEnd === -1) return source.length - 1;
      index = commentEnd + 1;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  throw new Error(`Unclosed CSS block beginning at character ${openingIndex}`);
}

function splitLeadingTrivia(rawHeader) {
  let index = 0;

  while (index < rawHeader.length) {
    if (/\s/.test(rawHeader[index])) {
      index += 1;
      continue;
    }

    if (rawHeader.startsWith('/*', index)) {
      const commentEnd = rawHeader.indexOf('*/', index + 2);
      if (commentEnd === -1) break;
      index = commentEnd + 2;
      continue;
    }

    break;
  }

  return {
    leading: rawHeader.slice(0, index),
    header: rawHeader.slice(index).trim()
  };
}

function splitSelectors(selectorText) {
  const selectors = [];
  let startIndex = 0;
  let quote = null;
  let parentheses = 0;
  let brackets = 0;

  for (let index = 0; index < selectorText.length; index += 1) {
    const character = selectorText[index];
    const nextCharacter = selectorText[index + 1];

    if (quote) {
      if (character === '\\') {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      const commentEnd = selectorText.indexOf('*/', index + 2);
      if (commentEnd === -1) break;
      index = commentEnd + 1;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(') {
      parentheses += 1;
    } else if (character === ')') {
      parentheses = Math.max(0, parentheses - 1);
    } else if (character === '[') {
      brackets += 1;
    } else if (character === ']') {
      brackets = Math.max(0, brackets - 1);
    } else if (character === ',' && parentheses === 0 && brackets === 0) {
      selectors.push(selectorText.slice(startIndex, index).trim());
      startIndex = index + 1;
    }
  }

  selectors.push(selectorText.slice(startIndex).trim());
  return selectors.filter(Boolean);
}

function getIndent(leading) {
  const lastNewline = Math.max(
    leading.lastIndexOf('\n'),
    leading.lastIndexOf('\r')
  );
  return leading.slice(lastNewline + 1).match(/^[\t ]*/)?.[0] || '';
}

function formatSelectorList(selectors, indent) {
  return selectors.join(`,\n${indent}`);
}

function isRuleContainer(header) {
  return /^@(media|supports|container|layer|scope|document)\b/i.test(header);
}

function transformContainer(source, hoverIsGuarded = false) {
  let cursor = 0;
  let output = '';

  while (cursor < source.length) {
    const boundary = scanUntilBoundary(source, cursor);
    if (boundary.type === 'end') {
      output += source.slice(cursor);
      break;
    }

    if (boundary.type === 'statement') {
      output += source.slice(cursor, boundary.index + 1);
      cursor = boundary.index + 1;
      continue;
    }

    const closingIndex = findClosingBrace(source, boundary.index);
    const rawHeader = source.slice(cursor, boundary.index);
    const body = source.slice(boundary.index + 1, closingIndex);
    const { leading, header } = splitLeadingTrivia(rawHeader);
    const normalizedHeader = header.toLowerCase();

    if (isRuleContainer(header)) {
      const isHoverMedia =
        normalizedHeader.startsWith('@media') &&
        normalizedHeader.includes('(hover: hover)') &&
        normalizedHeader.includes('(pointer: fine)');
      const transformedBody = transformContainer(
        body,
        hoverIsGuarded || isHoverMedia
      );
      output += `${rawHeader}{${transformedBody}}`;
    } else if (!hoverIsGuarded && normalizedHeader.includes(':hover')) {
      const selectors = splitSelectors(header);
      const hoverSelectors = selectors.filter((selector) =>
        selector.toLowerCase().includes(':hover')
      );
      const persistentSelectors = selectors.filter(
        (selector) => !selector.toLowerCase().includes(':hover')
      );
      const indent = getIndent(leading);

      if (persistentSelectors.length > 0) {
        output += `${leading}${formatSelectorList(
          persistentSelectors,
          indent
        )} {${body}}\n\n${indent}`;
      } else {
        output += leading;
      }

      const innerIndent = `${indent}  `;
      const indentedBody = body.replace(/\r?\n/g, (newline) => `${newline}  `);
      output += `@media ${HOVER_MEDIA_QUERY} {\n${innerIndent}${formatSelectorList(
        hoverSelectors,
        innerIndent
      )} {${indentedBody}}\n${indent}}`;
    } else {
      output += `${rawHeader}{${body}}`;
    }

    cursor = closingIndex + 1;
  }

  return output;
}

function listCssFiles(directory = CSS_ROOT) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listCssFiles(entryPath);
    }
    if (EXCLUDED_STYLESHEETS.has(entryPath)) return [];
    return entry.isFile() && entry.name.endsWith('.css') ? [entryPath] : [];
  });
}

function findFilesRequiringChanges() {
  return listCssFiles().filter((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    try {
      return transformContainer(source) !== source;
    } catch (error) {
      error.message = `${path.relative(process.cwd(), filePath)}: ${error.message}`;
      throw error;
    }
  });
}

function updateHoverStyles() {
  const changedFiles = [];

  listCssFiles().forEach((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    let transformed;
    try {
      transformed = transformContainer(source);
    } catch (error) {
      error.message = `${path.relative(process.cwd(), filePath)}: ${error.message}`;
      throw error;
    }
    if (transformed === source) return;
    fs.writeFileSync(filePath, transformed);
    changedFiles.push(filePath);
  });

  return changedFiles;
}

if (require.main === module) {
  const shouldWrite = process.argv.includes('--write');
  const files = shouldWrite ? updateHoverStyles() : findFilesRequiringChanges();

  if (files.length > 0) {
    const verb = shouldWrite ? 'Updated' : 'Needs hover gating';
    files.forEach((filePath) => {
      console.log(`${verb}: ${path.relative(process.cwd(), filePath)}`);
    });
  }

  if (!shouldWrite && files.length > 0) process.exitCode = 1;
}

module.exports = {
  findFilesRequiringChanges,
  splitSelectors,
  transformContainer,
  updateHoverStyles
};
