(function () {
  function create(options) {
    const { root, getStep, isActive } = options;
    const targetSvg = root.querySelector('[data-oe-tutorial-target]');
    const targetRings = targetSvg.querySelectorAll('ellipse');
    const annotationElement = root.querySelector(
      '[data-oe-tutorial-annotation]'
    );

    function resolveTarget(target) {
      if (typeof target === 'function') return target() || null;
      if (typeof target === 'string') return document.querySelector(target);
      return target?.getBoundingClientRect ? target : null;
    }

    function refresh() {
      const step = isActive() ? getStep() : null;
      const target = resolveTarget(step?.target);
      const annotation =
        typeof step?.targetAnnotation === 'string'
          ? { src: step.targetAnnotation }
          : step?.targetAnnotation;
      targetSvg.classList.toggle('is-visible', Boolean(target));
      targetSvg.classList.toggle(
        'has-annotation',
        Boolean(target && annotation?.src)
      );
      annotationElement?.classList.toggle(
        'is-visible',
        Boolean(target && annotation?.src)
      );
      root.classList.toggle('has-target', Boolean(target));
      if (!target) {
        annotationElement?.style.removeProperty(
          '--oe-tutorial-annotation-image'
        );
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = Number(annotation?.padding ?? step.targetPadding ?? 14);
      const values = {
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        rx: rect.width / 2 + padding,
        ry: rect.height / 2 + padding
      };

      targetRings.forEach((ring, index) => {
        Object.entries(values).forEach(([key, value]) => {
          const offset = index ? (key === 'cx' ? 3 : key === 'cy' ? -2 : 2) : 0;
          ring.setAttribute(key, String(value + offset));
        });
      });

      if (annotationElement && annotation?.src) {
        const configuredWidth = Number(annotation.width);
        const annotationWidth =
          Number.isFinite(configuredWidth) && configuredWidth > 0
            ? configuredWidth
            : rect.width + padding * 2;
        const annotationHeight = rect.height + padding * 2;
        const gap = Number(annotation.gap) || 0;
        const offsetX = Number(annotation.offsetX) || 0;
        const offsetY = Number(annotation.offsetY) || 0;
        const visibleLeft = Math.max(
          0,
          Math.min(1, Number(annotation.visibleBounds?.left) || 0)
        );
        let annotationLeft = rect.left - padding + offsetX;
        if (annotation.placement === 'after') {
          annotationLeft =
            rect.right + gap - annotationWidth * visibleLeft + offsetX;
        } else if (annotation.side === 'right') {
          annotationLeft = rect.right + gap - annotationWidth + offsetX;
        } else if (annotation.side === 'left') {
          annotationLeft = rect.left - gap + offsetX;
        }
        annotationElement.style.setProperty(
          '--oe-tutorial-annotation-image',
          `url("${String(annotation.src).replaceAll('"', '\\"')}")`
        );
        annotationElement.style.setProperty(
          '--oe-tutorial-annotation-colour',
          annotation.colour || 'var(--oe-tutorial-page-primary-colour)'
        );
        annotationElement.style.left = `${annotationLeft}px`;
        annotationElement.style.top = `${rect.top - padding + offsetY}px`;
        annotationElement.style.width = `${annotationWidth}px`;
        annotationElement.style.height = `${annotationHeight}px`;
      } else {
        annotationElement?.style.removeProperty(
          '--oe-tutorial-annotation-image'
        );
        annotationElement?.style.removeProperty(
          '--oe-tutorial-annotation-colour'
        );
      }
    }

    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);

    return {
      refresh,
      destroy() {
        window.removeEventListener('resize', refresh);
        window.removeEventListener('scroll', refresh, true);
      }
    };
  }

  window.OETutorialTarget = { create };
})();
