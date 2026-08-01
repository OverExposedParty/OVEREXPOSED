function escapeHtmlAttribute(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(value = '') {
  return escapeHtmlAttribute(value).replace(/"/g, '&quot;');
}

module.exports = {
  escapeHtmlAttribute,
  escapeHtmlText
};
