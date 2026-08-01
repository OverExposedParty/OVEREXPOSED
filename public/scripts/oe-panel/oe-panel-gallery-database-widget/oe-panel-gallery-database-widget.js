(function () {
  const { normaliseGalleryImagePath } = window.OE_PANEL_WIDGET_HELPERS || {};

  window.OE_PANEL_GALLERY_WIDGET_RENDERER =
    window.createOePanelGalleryWidgetRenderer({
      normaliseGalleryImagePath
    });
  window.OE_PANEL_DATABASE_BUTTON_LIST_WIDGET_RENDERER =
    window.createOePanelDatabaseButtonListWidgetRenderer();
})();
