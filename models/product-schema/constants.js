const PRODUCT_STATUSES = [
  'draft',
  'scheduled',
  'active',
  'archived',
  'sold-out'
];
const PRODUCT_VISIBILITIES = [
  'public',
  'hidden',
  'members_only',
  'password_only'
];
const PRODUCT_TYPES = ['physical', 'digital'];
const PRODUCT_MEDIA_TYPES = ['image', 'video'];
const INVENTORY_SYNC_SOURCES = ['manual', 'stripe', 'warehouse'];

module.exports = {
  PRODUCT_STATUSES,
  PRODUCT_VISIBILITIES,
  PRODUCT_TYPES,
  PRODUCT_MEDIA_TYPES,
  INVENTORY_SYNC_SOURCES
};
