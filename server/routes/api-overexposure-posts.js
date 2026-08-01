function registerOverexposurePostRoutes(context) {
  const { app } = context;

  with (context) {
    app.post('/api/overexposure-posts', async (req, res) => {
      try {
        const publicData = req.body.public || {};
        const contentData = req.body.content || {};
        const authorData = req.body.author || {};
        const placementData = req.body.placement || {};
        const lifecycleData = req.body.lifecycle || {};
        const title = contentData.title ?? req.body.title;
        const text = contentData.text ?? req.body.text;
        const id = publicData.id ?? req.body.id;
        const date = lifecycleData.postedAt ?? req.body.date;
        const userIcon = authorData.icon ?? req.body.userIcon;
        const x = placementData.x ?? req.body.x;
        const y = placementData.y ?? req.body.y;
        const tag = publicData.tag ?? req.body.tag;
        const account = await getCurrentAccount(req);

        if (!account) {
          return res.apiError({
            status: 401,
            code: 'account_required',
            message: 'Sign in to post on Overexposure.'
          });
        }

        if (!requireVerifiedAccount(res, account, 'post on Overexposure')) {
          return;
        }

        const deleteCode = generateDeleteCode();
        const saltRounds = 10;
        const deleteCodeHash = await bcrypt.hash(deleteCode, saltRounds);
        const requestedUserIcon = normalizeOeIcon(userIcon);
        const accountUserIcon = normalizeOeIcon(account?.profile?.oeIcon);
        const authorIcon = !isDefaultOeIcon(requestedUserIcon)
          ? requestedUserIcon
          : accountUserIcon || requestedUserIcon || defaultOeIcon;

        const saved = await OverexposurePost.create({
          public: {
            id,
            tag,
            visibility: publicData.visibility || 'public'
          },
          content: {
            title,
            text
          },
          author: {
            accountId: account?._id || null,
            usernameSnapshot: account?.username || null,
            isAnonymous: !account,
            icon: authorIcon
          },
          placement: {
            x: Number(x),
            y: Number(y)
          },
          lifecycle: {
            postedAt: parseOverexposurePostedAt(date)
          },
          system: {
            createdAt: new Date(),
            updatedAt: new Date()
          },
          security: {
            deleteCodeHash
          }
        });

        if (account) {
          await Account.updateOne(
            { _id: account._id },
            {
              $push: {
                'overexposure.postsCreated':
                  createOverexposureAccountSummary(saved)
              }
            }
          );
        }

        res.apiSuccess(
          {
            message: 'Overexposure post saved successfully',
            overexposurePost: serializeOverexposurePost(saved),
            deleteCode
          },
          201
        );
      } catch (err) {
        console.error(
          `[REQ ${req.id}] ❌ Error saving Overexposure post:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'overexposure_post_save_failed',
          message: 'Failed to save Overexposure post'
        });
      }
    });

    app.delete('/api/overexposure-posts/:id', async (req, res) => {
      try {
        const publicId = req.params.id;
        const { deleteCode } = req.body;

        if (!deleteCode) {
          return res.apiError({
            status: 400,
            code: 'delete_code_required',
            message: 'Delete code is required'
          });
        }

        const overexposurePost = await OverexposurePost.findOne({
          $or: [{ 'public.id': publicId }, { id: publicId }]
        }).select(
          '+security.deleteCodeHash +deleteCodeHash +title +text +id +date +userIcon +x +y +tag +visibility'
        );

        const deleteCodeHash =
          overexposurePost?.security?.deleteCodeHash ||
          overexposurePost?.deleteCodeHash;

        if (!overexposurePost || !deleteCodeHash) {
          return res.apiError({
            status: 403,
            code: 'invalid_overexposure_post_delete_code',
            message: 'Invalid Overexposure post or delete code'
          });
        }

        const matches = await bcrypt.compare(deleteCode, deleteCodeHash);
        if (!matches) {
          return res.apiError({
            status: 403,
            code: 'invalid_overexposure_post_delete_code',
            message: 'Invalid Overexposure post or delete code'
          });
        }

        await OverexposurePost.deleteOne({ _id: overexposurePost._id });

        if (overexposurePost.author?.accountId) {
          const deletedSummary =
            createOverexposureAccountSummary(overexposurePost);
          deletedSummary.status.deletedAt = new Date();

          await Account.updateOne(
            { _id: overexposurePost.author.accountId },
            {
              $set: {
                'overexposure.postsCreated.$[postSummary].status.deletedAt':
                  deletedSummary.status.deletedAt
              },
              $push: {
                'overexposure.postsDeleted': deletedSummary
              }
            },
            {
              arrayFilters: [
                { 'postSummary.post.postId': overexposurePost._id }
              ]
            }
          );
        }

        res.apiSuccess({ message: 'Overexposure post deleted successfully' });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] ❌ Error deleting Overexposure post:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'overexposure_post_delete_failed',
          message: 'Failed to delete Overexposure post'
        });
      }
    });
  }
}

module.exports = {
  registerOverexposurePostRoutes
};
