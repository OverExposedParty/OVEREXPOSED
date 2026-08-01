const {
  formatOePanelDateTime,
  formatPartyGameLabel
} = require('./api-formatters');
const { parseBooleanLabel } = require('./api-parsers');
const {
  normalizeOeCustomisationStatus
} = require('./api-oe-customisation-helpers/status');
const {
  createOeCustomisationPayloadHelpers
} = require('./api-oe-customisation-helpers/payloads');
const {
  createOeCustomisationSerializers
} = require('./api-oe-customisation-helpers/serializers');
const {
  createOeCustomisationUploadHelpers
} = require('./api-oe-customisation-helpers/upload');
const {
  createOeCustomisationIssueHelpers
} = require('./api-oe-customisation-helpers/issues');

function createOeCustomisationHelpers(deps) {
  const uploadHelpers = createOeCustomisationUploadHelpers(deps);
  const payloadHelpers = createOeCustomisationPayloadHelpers({
    parseBooleanLabel
  });
  const serializers = createOeCustomisationSerializers({
    formatOePanelDateTime,
    formatPartyGameLabel,
    getOeCustomisationFileExists: uploadHelpers.getOeCustomisationFileExists
  });
  const issueHelpers = createOeCustomisationIssueHelpers({
    ...deps,
    getOeCustomisationFileExists: uploadHelpers.getOeCustomisationFileExists,
    validateOeCustomisationSvgDimensions:
      uploadHelpers.validateOeCustomisationSvgDimensions
  });

  return {
    ...payloadHelpers,
    getOeCustomisationFileExists: uploadHelpers.getOeCustomisationFileExists,
    getOeCustomisationIssues: issueHelpers.getOeCustomisationIssues,
    normalizeOeCustomisationImageFolder:
      uploadHelpers.normalizeOeCustomisationImageFolder,
    normalizeOeCustomisationStatus,
    saveOeCustomisationSvgUpload: uploadHelpers.saveOeCustomisationSvgUpload,
    ...serializers,
    slugifyOeCustomisationFileName:
      uploadHelpers.slugifyOeCustomisationFileName,
    validateOeCustomisationSvgDimensions:
      uploadHelpers.validateOeCustomisationSvgDimensions
  };
}

module.exports = {
  createOeCustomisationHelpers
};
