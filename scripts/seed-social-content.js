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

function getPlannedDate(daysFromNow, hour, minute) {
  const plannedFor = new Date();
  plannedFor.setDate(plannedFor.getDate() + daysFromNow);
  plannedFor.setHours(hour, minute, 0, 0);
  return plannedFor;
}

function createSchedule(daysFromNow, time) {
  const [hour, minute] = time.split(':').map(Number);
  const plannedFor = getPlannedDate(daysFromNow, hour, minute);

  return {
    plannedFor,
    postTime: time,
    timezone: 'Europe/London'
  };
}

function createLog(message) {
  return [
    {
      action: 'seeded',
      message,
      createdAt: new Date()
    }
  ];
}

async function main() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;

  if (!process.env.MONGO_URI_SOCIAL && !baseUri) {
    throw new Error(
      'Missing MONGO_URI_SOCIAL or MONGO_URI_OVEREXPOSURE in environment.'
    );
  }

  const socialUri =
    process.env.MONGO_URI_SOCIAL ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_SOCIAL || 'social');

  await mongoose.connect(socialUri);

  const existingSeeds = await SocialContentItem.countDocuments({
    'idea.sourceType': 'oe_seed'
  });

  if (existingSeeds > 0) {
    console.log(`Social seed data already exists (${existingSeeds} records).`);
    await mongoose.disconnect();
    return;
  }

  const seedItems = [
    {
      platforms: ['tiktok', 'instagram'],
      status: 'scheduled',
      type: 'general-meme',
      idea: {
        title: 'Anonymous confession opener',
        hook: 'Someone said the quiet part out loud.',
        angle: 'Turn a wall confession into a sharp short-form opener.',
        notes: 'Use quick cuts and captions with high contrast.',
        sourceType: 'oe_seed'
      },
      content: {
        caption:
          'A tiny confession, a very loud comment section. What would you say back?',
        script:
          'Open on the confession card, punch in on the strongest line, then ask viewers to stitch their reaction.',
        hashtags: ['overexposed', 'confessions', 'storytime'],
        callToAction: 'Comment your first reaction.'
      },
      schedule: createSchedule(1, '18:30'),
      log: createLog('Seeded scheduled short-form concept.')
    },
    {
      platforms: ['instagram'],
      status: 'ready',
      type: 'general-meme',
      idea: {
        title: 'Carousel: feelings people avoid saying',
        hook: 'Save this for when you do not have the words yet.',
        angle: 'Make anonymous lines feel saveable and shareable.',
        notes: 'Final copy is ready for carousel assembly.',
        sourceType: 'oe_seed'
      },
      content: {
        caption:
          'A carousel of short anonymous thoughts from the OE wall, designed for saves and shares.',
        script:
          'Slide 1 hook, slides 2-6 individual lines, final slide asks audience to submit their own.',
        hashtags: ['overexposed', 'feelings', 'anonymous'],
        callToAction: 'Share this with someone who gets it.'
      },
      log: createLog('Seeded ready Instagram carousel.')
    },
    {
      platforms: ['youtube-shorts', 'tiktok'],
      status: 'draft',
      type: 'general-meme',
      idea: {
        title: 'Three sentence story hook',
        hook: 'The first sentence sounds normal. The third one does not.',
        angle: 'Build a kinetic-text story prompt from an OE-style post.',
        notes: 'Record VO after script gets tightened.',
        sourceType: 'oe_seed'
      },
      content: {
        caption:
          'Short-form story prompt built from a real OE-style anonymous post.',
        script:
          'Read the three-line story over kinetic text. End with a question that invites replies.',
        hashtags: ['shorts', 'storyprompt', 'overexposed'],
        callToAction: 'Subscribe for the next anonymous story.'
      },
      schedule: createSchedule(3, '19:45'),
      log: createLog('Seeded short-form draft.')
    },
    {
      platforms: ['x'],
      status: 'idea',
      type: 'general-meme',
      idea: {
        title: 'Late night question thread',
        hook: 'What is something you almost posted but deleted?',
        angle: 'Invite replies without needing media.',
        sourceType: 'oe_seed'
      },
      content: {
        caption:
          'Late night prompt designed to get replies without needing media.',
        hashtags: ['overexposed'],
        callToAction: 'Reply anonymously on OE or directly in the thread.'
      },
      log: createLog('Seeded X prompt idea.')
    },
    {
      platforms: ['tiktok', 'instagram'],
      status: 'uploaded',
      type: 'general-meme',
      idea: {
        title: 'Two truths from the wall',
        hook: 'Two anonymous posts. One uncomfortable pattern.',
        angle: 'Pair two wall posts and make the pattern the reveal.',
        sourceType: 'oe_seed'
      },
      content: {
        caption: 'Two anonymous posts. One uncomfortable pattern.',
        hashtags: ['overexposed', 'anonymous', 'fyp'],
        callToAction: 'Follow for tomorrow’s wall pull.'
      },
      schedule: {
        ...createSchedule(-2, '17:00'),
        completedAt: getPlannedDate(-2, 17, 4)
      },
      log: createLog('Seeded uploaded short-form asset.')
    }
  ];

  const result = await SocialContentItem.insertMany(seedItems);
  console.log(`Inserted ${result.length} social content seed records.`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message || error);
  await mongoose.disconnect();
  process.exit(1);
});
