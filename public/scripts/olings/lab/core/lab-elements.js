(function () {
  function getOlingLabElements(root = document) {
    return {
      page: root.querySelector('.oling-lab-page'),
      room: root.getElementById('oling-lab-room'),
      viewport: root.getElementById('oling-lab-viewport'),
      editToggle: root.getElementById('oling-lab-edit-toggle'),
      customiseTools: root.getElementById('oling-lab-customise-tools'),
      customiseCategoryButtons:
        root.querySelectorAll?.('[data-oling-lab-customise-category]') || [],
      status: root.getElementById('oling-lab-save-status'),
      viewingLabel: root.getElementById('oling-lab-viewing-label'),
      scrollLeft: root.getElementById('oling-lab-scroll-left'),
      scrollRight: root.getElementById('oling-lab-scroll-right'),
      actionPanel: null,
      incubatorPanel: root.getElementById('oling-lab-incubator-panel'),
      incubatorPanelTabs: root.getElementById('oling-lab-incubator-panel-tabs'),
      incubatorPanelTitle: root.getElementById(
        'oling-lab-incubator-panel-title'
      ),
      incubatorPanelContent: root.getElementById(
        'oling-lab-incubator-panel-content'
      ),
      incubatorPanelFooter: root.getElementById(
        'oling-lab-incubator-panel-footer'
      ),
      incubatorPanelBack: root.getElementById('oling-lab-incubator-panel-back'),
      incubatorPanelToggle: root.getElementById(
        'oling-lab-incubator-panel-toggle'
      ),
      olingPanel: root.getElementById('oling-lab-inspect-panel'),
      olingPanelTabs: root.getElementById('oling-lab-inspect-panel-tabs'),
      olingPanelTitle: root.getElementById('oling-lab-inspect-panel-title'),
      olingPanelContent: root.getElementById('oling-lab-inspect-panel-content'),
      olingPanelBack: root.getElementById('oling-lab-inspect-panel-back'),
      olingPanelToggle: root.getElementById('oling-lab-inspect-panel-toggle'),
      wallStylePanel: root.getElementById('oling-lab-wall-style-panel'),
      wallStylePanelToggle: root.getElementById(
        'oling-lab-wall-style-panel-toggle'
      ),
      wallStylePanelHeader: root.getElementById(
        'oling-lab-wall-style-panel-header'
      ),
      wallStylePanelTitle: root.getElementById(
        'oling-lab-wall-style-panel-title'
      ),
      wallStylePanelContent: root.getElementById(
        'oling-lab-wall-style-panel-content'
      ),
      wallStylePanelFooter: root.getElementById(
        'oling-lab-wall-style-panel-footer'
      ),
      wallDecorationPanel: root.getElementById(
        'oling-lab-wall-decoration-panel'
      ),
      wallDecorationPanelToggle: root.getElementById(
        'oling-lab-wall-decoration-panel-toggle'
      ),
      wallDecorationPanelInventory: root.getElementById(
        'oling-lab-wall-decoration-inventory'
      ),
      wallDecorationStoreAll: root.getElementById(
        'oling-lab-wall-decoration-store-all'
      ),
      furniturePanel: root.getElementById('oling-lab-furniture-panel'),
      furniturePanelToggle: root.getElementById(
        'oling-lab-furniture-panel-toggle'
      ),
      furniturePanelInventory: root.getElementById(
        'oling-lab-furniture-inventory'
      ),
      furnitureDetailPanel: root.getElementById(
        'oling-lab-furniture-detail-panel'
      ),
      furnitureDetailPanelToggle: root.getElementById(
        'oling-lab-furniture-detail-panel-toggle'
      ),
      furnitureDetailPanelClose: root.getElementById(
        'oling-lab-furniture-detail-panel-close'
      ),
      furnitureDetailPanelTitle: root.getElementById(
        'oling-lab-furniture-detail-panel-title'
      ),
      furnitureDetailPanelContent: root.getElementById(
        'oling-lab-furniture-detail-panel-content'
      ),
      storagePanel: root.getElementById('oling-lab-storage-panel'),
      storagePanelTitle: root.getElementById('oling-lab-storage-panel-title'),
      storagePanelToggle: root.getElementById('oling-lab-storage-panel-toggle'),
      storagePanelBack: root.getElementById('oling-lab-storage-panel-back'),
      storagePanelContent: root.getElementById(
        'oling-lab-storage-panel-content'
      ),
      supplyStoragePanel: root.getElementById('oling-lab-supply-storage-panel'),
      supplyStoragePanelTitle: root.getElementById(
        'oling-lab-supply-storage-panel-title'
      ),
      supplyStoragePanelToggle: root.getElementById(
        'oling-lab-supply-storage-panel-toggle'
      ),
      supplyStoragePanelBack: root.getElementById(
        'oling-lab-supply-storage-panel-back'
      ),
      supplyStoragePanelContent: root.getElementById(
        'oling-lab-supply-storage-panel-content'
      ),
      supplyStorageQuickSell: root.getElementById(
        'oling-lab-supply-storage-quick-sell'
      ),
      furnitureSellButtons:
        root.querySelectorAll?.('[data-oling-lab-furniture-sell]') || [],
      restPanel: root.getElementById('oling-lab-rest-panel'),
      restPanelToggle: root.getElementById('oling-lab-rest-panel-toggle'),
      restPanelClose: root.getElementById('oling-lab-rest-panel-close'),
      restPanelTitle: root.getElementById('oling-lab-rest-panel-title'),
      restPanelContent: root.getElementById('oling-lab-rest-panel-content'),
      restPanelFooter: root.getElementById('oling-lab-rest-panel-footer'),
      gatewayPanel: root.getElementById('oling-lab-gateway-panel'),
      gatewayPanelTabs: root.getElementById('oling-lab-gateway-panel-tabs'),
      gatewayPanelToggle: root.getElementById('oling-lab-gateway-panel-toggle'),
      gatewayPanelClose: root.getElementById('oling-lab-gateway-panel-close'),
      gatewayPanelTitle: root.getElementById('oling-lab-gateway-panel-title'),
      gatewayPanelContent: root.getElementById(
        'oling-lab-gateway-panel-content'
      ),
      gatewayPanelFooter: root.getElementById('oling-lab-gateway-panel-footer'),
      backdrop: root.getElementById('oling-lab-menu-backdrop'),
      menu: root.querySelector('.oling-lab-menu'),
      menuTabs: root.getElementById('oling-lab-menu-tabs'),
      menuTitle: root.getElementById('oling-lab-menu-title'),
      menuContent: root.getElementById('oling-lab-menu-content'),
      menuFooter: root.getElementById('oling-lab-menu-footer'),
      menuClose: root.getElementById('oling-lab-menu-close')
    };
  }
  window.getOlingLabElements = getOlingLabElements;
})();
