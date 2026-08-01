function registerOePanelSocialMediaExportRoutes(context) {
  const { app } = context;

  with (context) {
    app.post(
      '/api/oe-panel/social-media/export-video',
      async (req, res, next) => {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        next();
      },
      OE_PANEL_EXPORT_UPLOAD.single('video'),
      async (req, res) => {
        const uploadedPath = req.file?.path;
        const outputDirectory = path.join(os.tmpdir(), 'oe-panel-exports');
        const outputPath = path.join(
          outputDirectory,
          `${crypto.randomUUID()}.mp4`
        );
        const textPath = path.join(
          outputDirectory,
          `${crypto.randomUUID()}-caption.txt`
        );

        const cleanup = async () => {
          await Promise.allSettled(
            [uploadedPath, outputPath, textPath]
              .filter(Boolean)
              .map((filePath) => fs.promises.rm(filePath, { force: true }))
          );
        };

        try {
          if (!ffmpegPath) {
            return res.apiError({
              status: 500,
              code: 'oe_panel_export_ffmpeg_missing',
              message: 'Video export is not available on this server'
            });
          }

          if (!req.file || !uploadedPath) {
            return res.apiError({
              status: 400,
              code: 'oe_panel_export_video_required',
              message: 'Video file is required'
            });
          }

          const settings = JSON.parse(String(req.body.settings || '{}'));
          const crop = settings.crop || {};
          const edit = settings.edit || {};
          const metrics = settings.metrics || {};
          const gamemode = String(edit.gamemode || 'truth-or-dare').replace(
            /[^a-z0-9-]/gi,
            ''
          );
          const watermarkPath = path.join(
            PUBLIC_DIRECTORY,
            'images',
            'content',
            'watermarks',
            `${gamemode}.png`
          );
          const fontPath = path.join(
            PUBLIC_DIRECTORY,
            'fonts',
            'overexposed',
            'OverExposed-Regular.otf'
          );

          const outputWidth = 1080;
          const outputHeight = 1920;
          const [ratioWidth, ratioHeight] = String(crop.aspectRatio || '16 / 9')
            .split('/')
            .map((value) => Number(value.trim()));
          const frameRatio = (ratioWidth || 16) / (ratioHeight || 9);
          const outputRatio = outputWidth / outputHeight;
          const frameWidth =
            frameRatio > outputRatio
              ? outputWidth
              : Math.round(outputHeight * frameRatio);
          const frameHeight =
            frameRatio > outputRatio
              ? Math.round(outputWidth / frameRatio)
              : outputHeight;
          const frameX = Math.round((outputWidth - frameWidth) / 2);
          const frameY = Math.round((outputHeight - frameHeight) / 2);
          const zoom = clampNumber(crop.zoom, 1, 3, 1);
          const cropX = clampNumber(crop.x, 0, 100, 50);
          const cropY = clampNumber(crop.y, 0, 100, 50);
          const trimStart = clampNumber(crop.trimStart, 0, 60 * 60, 0);
          const trimEnd = clampNumber(crop.trimEnd, 0, 60 * 60, 0);
          const trimDuration =
            trimEnd > trimStart ? Math.max(trimEnd - trimStart, 0.1) : null;
          const textX = Math.round(
            clampNumber(metrics.textX, 0, outputWidth, 0)
          );
          const textY = Math.round(
            clampNumber(metrics.textY, 0, outputHeight, 0)
          );
          const textWidth = Math.round(
            clampNumber(metrics.textWidth, 1, outputWidth, outputWidth)
          );
          const textAlign = ['left', 'center', 'right'].includes(
            edit.horizontalAlign
          )
            ? edit.horizontalAlign
            : 'center';
          const textFontSize = Math.round(
            clampNumber(metrics.fontSize, 8, 220, 56)
          );
          const lineSpacing = Math.round(
            clampNumber(metrics.lineSpacing, -100, 200, textFontSize * 0.16)
          );
          const textColor = String(metrics.textColor || '#66CCFF').replace(
            /[^#a-fA-F0-9]/g,
            ''
          );
          const watermarkWidth = Math.round(outputWidth * 0.42);
          const watermarkX = Math.round(
            outputWidth * (clampNumber(edit.watermarkX, 0, 100, 34) / 100) -
              watermarkWidth / 2
          );
          const watermarkYPercent = clampNumber(edit.watermarkY, 0, 100, 92);
          const watermarkY = `H*${watermarkYPercent / 100}-(overlay_h/2)`;
          const drawTextX =
            textAlign === 'left'
              ? `${textX}`
              : textAlign === 'right'
                ? `${textX + textWidth}-text_w`
                : `${textX}+(${textWidth}-text_w)/2`;

          await fs.promises.mkdir(outputDirectory, { recursive: true });
          await fs.promises.writeFile(
            textPath,
            String(edit.text || ''),
            'utf8'
          );

          const filterComplex = [
            `color=c=black:s=${outputWidth}x${outputHeight}[bg]`,
            `[0:v]scale=w='if(gt(a,${frameRatio}),-2,${Math.round(
              frameWidth * zoom
            )})':h='if(gt(a,${frameRatio}),${Math.round(
              frameHeight * zoom
            )},-2)',crop=${frameWidth}:${frameHeight}:x='(iw-ow)*${cropX / 100}':y='(ih-oh)*${
              cropY / 100
            }'[cropped]`,
            `[bg][cropped]overlay=${frameX}:${frameY}:shortest=1[base]`,
            `[1:v]format=rgba,colorchannelmixer=aa=0.5,scale=${watermarkWidth}:-1[wm]`,
            `[base][wm]overlay=${watermarkX}:${watermarkY},drawtext=fontfile='${escapeFfmpegText(
              fontPath
            )}':textfile='${escapeFfmpegText(
              textPath
            )}':fontcolor=${textColor}:fontsize=${textFontSize}:line_spacing=${lineSpacing}:x='${drawTextX}':y=${textY}[outv]`
          ].join(';');

          await runFfmpeg([
            '-y',
            ...(trimDuration
              ? ['-ss', String(trimStart), '-t', String(trimDuration)]
              : []),
            '-i',
            uploadedPath,
            '-loop',
            '1',
            '-i',
            watermarkPath,
            '-filter_complex',
            filterComplex,
            '-map',
            '[outv]',
            '-map',
            '0:a?',
            '-c:v',
            'libx264',
            '-preset',
            'slow',
            '-crf',
            '18',
            '-pix_fmt',
            'yuv420p',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-movflags',
            '+faststart',
            '-shortest',
            outputPath
          ]);

          const rawFileName = String(settings.fileName || 'overexposed-export')
            .trim()
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
          const downloadName = `${rawFileName || 'overexposed-export'}.mp4`;

          res.download(outputPath, downloadName, async (error) => {
            await cleanup();
            if (error && !res.headersSent) {
              res.apiError({
                status: 500,
                code: 'oe_panel_export_download_failed',
                message: 'Failed to download exported video'
              });
            }
          });
        } catch (err) {
          console.error(
            `[REQ ${req.id}] Failed to export social video:`,
            err.stderr || err
          );
          await cleanup();
          res.apiError({
            status: 500,
            code: 'oe_panel_social_video_export_failed',
            message: 'Failed to export video'
          });
        }
      }
    );
  }
}

module.exports = { registerOePanelSocialMediaExportRoutes };
