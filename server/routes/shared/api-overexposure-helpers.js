function toPlainObject(document) {
  if (!document) return {};
  return document.toObject ? document.toObject() : document;
}

function getOverexposurePublicId(post) {
  return post.public?.id || post.id || null;
}

function getOverexposureTag(post) {
  return post.public?.tag || post.tag || 'confessions';
}

function getOverexposureTitle(post) {
  return post.content?.title ?? post.title ?? '';
}

function getOverexposurePostedAt(post) {
  return (
    post.lifecycle?.postedAt ||
    post.date ||
    post.system?.createdAt ||
    post.createdAt ||
    new Date()
  );
}

function parseOverexposurePostedAt(value) {
  if (!value) return new Date();
  if (value instanceof Date) return value;

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;

  const dateParts = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dateParts) {
    const [, day, month, year] = dateParts;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date();
}

function serializeOverexposurePost(document) {
  const post = toPlainObject(document);
  const publicId = getOverexposurePublicId(post);
  const postedAt = getOverexposurePostedAt(post);

  return {
    _id: post._id,
    public: {
      id: publicId,
      tag: getOverexposureTag(post),
      visibility: post.public?.visibility || post.visibility || 'public'
    },
    content: {
      title: getOverexposureTitle(post),
      text: post.content?.text ?? post.text ?? ''
    },
    author: {
      accountId: post.author?.accountId || null,
      usernameSnapshot: post.author?.usernameSnapshot || null,
      isAnonymous: post.author?.isAnonymous ?? true,
      icon: post.author?.icon || post.userIcon || '0000:0100:0200:0300'
    },
    placement: {
      x: Number(post.placement?.x ?? post.x ?? 0),
      y: Number(post.placement?.y ?? post.y ?? 0)
    },
    lifecycle: {
      postedAt,
      deletedAt: post.lifecycle?.deletedAt || null,
      hiddenAt: post.lifecycle?.hiddenAt || null
    },
    system: {
      createdAt: post.system?.createdAt || post.createdAt || null,
      updatedAt: post.system?.updatedAt || post.updatedAt || null
    }
  };
}

function createOverexposureAccountSummary(post) {
  return {
    post: {
      postId: post._id,
      publicId: getOverexposurePublicId(post)
    },
    snapshot: {
      tag: getOverexposureTag(post),
      title: getOverexposureTitle(post)
    },
    status: {
      createdAt:
        post.system?.createdAt ||
        post.createdAt ||
        post.lifecycle?.postedAt ||
        new Date(),
      deletedAt: post.lifecycle?.deletedAt || null
    }
  };
}

function normalizeReportText(value, maxLength = 3000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

module.exports = {
  createOverexposureAccountSummary,
  getOverexposurePostedAt,
  getOverexposurePublicId,
  getOverexposureTag,
  getOverexposureTitle,
  normalizeReportText,
  parseOverexposurePostedAt,
  serializeOverexposurePost,
  toPlainObject
};
