const mongoose = require('mongoose');
const { createProductSchema } = require('../product-schema/schema');

const ProductSchema = createProductSchema();

module.exports =
  mongoose.models.Product ||
  mongoose.model('Product', ProductSchema, 'products');
