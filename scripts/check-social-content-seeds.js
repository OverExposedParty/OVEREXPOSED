require('dotenv').config();

const mongoose = require('mongoose');

const SocialContentItem = require('../models/content/social-content-item-schema');

function getDatabaseUri(baseUri, dbName) {
  try {
    const parsedUri = new URL(baseUri);
    parsedUri.pathname = `/${dbName}`;
    return parsedUri.toString();
  } catch (error) {
    console.warn(
      `Could not derive "${dbName}" MongoDB URI from base URI:`,
      error.message || error
    );
    return baseUri;
  }
}

async function main() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  const socialUri =
    process.env.MONGO_URI_SOCIAL ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_SOCIAL || 'social');

  await mongoose.connect(socialUri);

  const summary = await SocialContentItem.aggregate([
    { $match: { 'idea.sourceType': 'oe_seed' } },
    {
      $unwind: '$platforms'
    },
    {
      $group: {
        _id: { platform: '$platforms', status: '$status' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.platform': 1, '_id.status': 1 } }
  ]);

  console.table(
    summary.map((item) => ({
      platform: item._id.platform,
      status: item._id.status,
      count: item.count
    }))
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message || error);
  await mongoose.disconnect();
  process.exit(1);
});
