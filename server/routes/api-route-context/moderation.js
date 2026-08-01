function createModerationContext(context) {
  const {
    crypto,
    formatOePanelDateTime,
    formatReportLabel,
    getOverexposurePostedAt,
    getOverexposurePublicId,
    getOverexposureTitle,
    normalizeReportText,
    OverexposurePost,
    Report
  } = context;

  async function findOverexposurePostForReport(targetId) {
    const safeTargetId = normalizeReportText(targetId, 120);
    if (!safeTargetId) return null;

    const targetQuery = [{ 'public.id': safeTargetId }];
    if (safeTargetId.match(/^[a-f\d]{24}$/i)) {
      targetQuery.push({ _id: safeTargetId });
    }

    return OverexposurePost.findOne({ $or: targetQuery });
  }

  function hashOptionalRequestIp(req) {
    const value = req.ip || req.socket?.remoteAddress || '';
    if (!value) return null;
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  async function buildOverexposurePostReport(req, account) {
    const targetId = normalizeReportText(
      req.body?.target?.id || req.body?.targetId,
      120
    );

    if (!targetId) {
      return {
        error: {
          status: 400,
          code: 'report_target_required',
          message: 'Choose a post to report.'
        }
      };
    }

    const post = await findOverexposurePostForReport(targetId);

    if (!post) {
      return {
        error: {
          status: 404,
          code: 'report_target_not_found',
          message: 'That post could not be found.'
        }
      };
    }

    const reporter = req.body?.reporter || {};
    const reporterComputerId = normalizeReportText(reporter.computerId, 160);
    const reporterUsername =
      account?.username || normalizeReportText(reporter.usernameSnapshot, 80);

    return {
      report: {
        target: {
          type: 'overexposure_post',
          id: String(post._id),
          objectId: post._id,
          collectionName: 'overexposure-posts',
          labelSnapshot: getOverexposureTitle(post) || 'Overexposure post'
        },
        reporter: {
          accountId: account?._id || null,
          usernameSnapshot: reporterUsername || null,
          computerId: reporterComputerId || null,
          sessionId: normalizeReportText(reporter.sessionId, 160) || null,
          ipHash: hashOptionalRequestIp(req)
        },
        reportedUser: {
          accountId: post.author?.accountId || null,
          usernameSnapshot: post.author?.usernameSnapshot || null,
          computerId: null,
          sessionId: null
        },
        context: {
          source: 'overexposure',
          postId: post._id,
          postPublicId: getOverexposurePublicId(post),
          pageUrl: normalizeReportText(req.body?.context?.pageUrl, 2000)
        }
      }
    };
  }

  function getOverexposureReportSeverity(report) {
    if (report.priority === 'urgent' || report.priority === 'high') {
      return 'high';
    }
    if (report.status === 'open' || report.status === 'reviewing') {
      return 'medium';
    }
    return 'low';
  }

  function getOePanelPostStatus(post) {
    const visibility = post?.public?.visibility || post?.visibility || 'public';
    if (post?.lifecycle?.deletedAt || visibility === 'deleted') {
      return 'Deleted';
    }
    if (post?.lifecycle?.hiddenAt || visibility === 'hidden') {
      return 'Hidden';
    }
    return 'Published';
  }

  function serializeOePanelOverexposureReport(report, post, reportCount = 1) {
    const title =
      getOverexposureTitle(post || {}) ||
      report.target?.labelSnapshot ||
      report.context?.postPublicId ||
      'Reported post';
    const status = formatReportLabel(report.status);
    const reason = formatReportLabel(report.reason);
    const createdAt = formatOePanelDateTime(report.system?.createdAt);
    const postSlug = report.context?.postPublicId || report.target?.id;
    const author = post?.author?.isAnonymous
      ? 'Anonymous'
      : post?.author?.usernameSnapshot || 'Account user';

    return {
      title,
      roomCode:
        report.context?.postPublicId || String(report.target?.id || '-'),
      detail: [status, reason, createdAt].filter(Boolean).join(' | '),
      severity: getOverexposureReportSeverity(report),
      href: postSlug ? `/overexposure/${encodeURIComponent(postSlug)}` : '',
      'container-type': 'moderation-report',
      containerType: 'moderation-report',
      reportId: String(report._id),
      status: report.status,
      reason: report.reason,
      priority: report.priority,
      createdAt: report.system?.createdAt || null,
      moderation: {
        reviewStatus:
          report.status === 'reviewing'
            ? 'In review'
            : report.status === 'open'
              ? 'Needs review'
              : formatReportLabel(report.status),
        reportStatus: status,
        priority: formatReportLabel(report.priority),
        actionTaken: report.moderation?.actionTaken || '-',
        reviewedAt: formatOePanelDateTime(report.moderation?.reviewedAt)
      },
      report: {
        id: String(report._id),
        reason,
        details: report.details || '-',
        reporter:
          report.reporter?.usernameSnapshot ||
          report.reporter?.computerId ||
          'Unknown reporter',
        reportedAt: createdAt,
        status,
        priority: formatReportLabel(report.priority)
      },
      post: {
        title,
        text: post?.content?.text ?? post?.text ?? '-',
        url: postSlug ? `/overexposure/${encodeURIComponent(postSlug)}` : '',
        postedAt: formatOePanelDateTime(getOverexposurePostedAt(post || {})),
        author,
        status: getOePanelPostStatus(post),
        reportCount,
        publicId:
          report.context?.postPublicId || getOverexposurePublicId(post || {})
      }
    };
  }

  function getOePanelReportPostId(report) {
    return String(report?.context?.postId || report?.target?.objectId || '');
  }

  async function getOePanelReportPost(report) {
    const postId = getOePanelReportPostId(report);
    if (!postId) return null;

    return OverexposurePost.findById(postId)
      .select('+title +text +id +date +userIcon +x +y +tag +visibility')
      .lean();
  }

  async function getOePanelReportCount(report) {
    const postId = getOePanelReportPostId(report);
    if (!postId) return 1;

    return Report.countDocuments({
      'target.type': 'overexposure_post',
      'context.source': 'overexposure',
      'target.id': postId
    });
  }

  async function serializeOePanelModerationReport(report) {
    const [post, reportCount] = await Promise.all([
      getOePanelReportPost(report),
      getOePanelReportCount(report)
    ]);

    return serializeOePanelOverexposureReport(report, post, reportCount || 1);
  }

  return {
    findOverexposurePostForReport,
    hashOptionalRequestIp,
    buildOverexposurePostReport,
    getOverexposureReportSeverity,
    getOePanelPostStatus,
    serializeOePanelOverexposureReport,
    getOePanelReportPostId,
    getOePanelReportPost,
    getOePanelReportCount,
    serializeOePanelModerationReport
  };
}

module.exports = {
  createModerationContext
};
