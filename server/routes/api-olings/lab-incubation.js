const config = require('./lab-incubation-config');
const slots = require('./lab-incubation-slots');
const readiness = require('./lab-incubation-readiness');
const deductions = require('./lab-incubation-deductions');

module.exports = {
  ...config,
  ...slots,
  ...readiness,
  ...deductions
};
