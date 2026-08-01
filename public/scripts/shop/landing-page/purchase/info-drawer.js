(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});

  with (shop) {
    function attachPurchaseInfoDrawer(media, product) {
      media.classList.remove('is-viewing-product-info');
      media.classList.remove('is-viewing-egg-preview');
      media
        .querySelectorAll(
          '.oe-purchase-info-toggle, .oe-purchase-info-panel, .oe-purchase-egg-preview-panel'
        )
        .forEach((element) => element.remove());

      const panel = document.createElement('aside');
      panel.className = 'oe-purchase-info-panel';
      setPurchaseInfoPanelInteractivity(panel, false);
      const eggPreviewPanel = document.createElement('aside');
      eggPreviewPanel.className = 'oe-purchase-egg-preview-panel';
      setPurchaseInfoPanelInteractivity(eggPreviewPanel, false);

      const closeInfo = () => {
        media.classList.remove('is-viewing-product-info');
        panel.classList.remove('is-open');
        setPurchaseInfoPanelInteractivity(panel, false);
      };
      const closeEggPreview = () => {
        media.classList.remove('is-viewing-egg-preview');
        eggPreviewPanel.classList.remove('is-open');
        setPurchaseInfoPanelInteractivity(eggPreviewPanel, false);
      };
      const openInfo = () => {
        closeEggPreview();
        setPurchaseInfoPanelInteractivity(panel, true);
        window.requestAnimationFrame(() => {
          media.classList.add('is-viewing-product-info');
          panel.classList.add('is-open');
        });
      };
      const openEggPreview = () => {
        closeInfo();
        setPurchaseInfoPanelInteractivity(eggPreviewPanel, true);
        window.requestAnimationFrame(() => {
          media.classList.add('is-viewing-egg-preview');
          eggPreviewPanel.classList.add('is-open');
        });
      };

      const infoButton = createPurchaseInfoButton(
        'View product details',
        openInfo
      );
      const eggPreviewButton = isEggProduct(product)
        ? createPurchaseEggPreviewButton('Egg preview', openEggPreview)
        : null;
      const info = getProductInfoSummary(product);

      panel.appendChild(
        createPurchaseInfoBackButton('Back from product details', closeInfo)
      );
      panel.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Item Details'
        })
      );
      panel.appendChild(
        Object.assign(document.createElement('p'), {
          className: 'oe-purchase-info-copy',
          textContent: info.description
        })
      );
      panel.appendChild(
        Object.assign(document.createElement('p'), {
          className: 'oe-purchase-info-copy',
          textContent: info.purpose
        })
      );

      const details = document.createElement('div');
      details.className = 'oe-purchase-info-list';
      info.detailRows.forEach(([label, value]) => {
        details.appendChild(createPurchaseInfoRow(label, value));
      });
      if (details.children.length) panel.appendChild(details);

      if (eggPreviewButton) {
        const oddsList = document.createElement('div');
        oddsList.className = 'oe-purchase-egg-preview-odds';
        oddsList.appendChild(
          Object.assign(document.createElement('p'), {
            className: 'oe-purchase-egg-preview-copy',
            textContent: 'Loading probabilities...'
          })
        );

        const status = Object.assign(document.createElement('p'), {
          className: 'oe-purchase-egg-preview-status',
          textContent: ''
        });

        const previewHatchButton = document.createElement('button');
        previewHatchButton.type = 'button';
        previewHatchButton.className = 'oe-purchase-preview-hatch-button';
        previewHatchButton.textContent = 'Preview Hatch';
        previewHatchButton.addEventListener('click', () =>
          openPreviewHatch(product, status)
        );

        loadOlingEggs()
          .then((eggs) => {
            const eggDefinition = findOlingEggDefinition(product, eggs);
            const odds = getEggOdds(product, eggDefinition);
            oddsList.replaceChildren();
            if (!odds.length) {
              oddsList.appendChild(
                Object.assign(document.createElement('p'), {
                  className: 'oe-purchase-egg-preview-copy',
                  textContent: 'No hatch probabilities available yet.'
                })
              );
              return;
            }
            odds.forEach(([rarity, chance]) => {
              oddsList.appendChild(
                createPurchaseInfoRow(
                  formatShopHatchTitle(rarity),
                  formatEggChance(chance)
                )
              );
            });
          })
          .catch((error) => {
            console.error('Failed to load egg probabilities:', error);
            oddsList.replaceChildren(
              Object.assign(document.createElement('p'), {
                className: 'oe-purchase-egg-preview-copy',
                textContent: 'Could not load hatch probabilities.'
              })
            );
          });

        eggPreviewPanel.append(
          createPurchaseInfoBackButton(
            'Back from egg preview',
            closeEggPreview
          ),
          Object.assign(document.createElement('h3'), {
            textContent: 'Egg Probabilities'
          }),
          oddsList,
          Object.assign(document.createElement('p'), {
            className: 'oe-purchase-egg-preview-copy',
            textContent: 'Preview hatch uses a fake result for now.'
          }),
          previewHatchButton,
          status
        );
      }

      media.append(
        infoButton,
        ...(eggPreviewButton ? [eggPreviewButton, eggPreviewPanel] : []),
        panel
      );
    }

    Object.assign(shop, { attachPurchaseInfoDrawer });
  }
})();
