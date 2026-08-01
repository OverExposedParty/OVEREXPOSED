const LAB_ROWS = 2;

const LAB_MIN_COLUMNS = 3;

const LAB_MAX_COLUMNS = 16;

const STARTER_LAB_COLUMNS = 3;

const LAB_PURCHASE_MAX_COLUMNS = 10;

const LAB_COLUMN_PRICES = Object.freeze({
  4: 150,
  5: 225,
  6: 325,
  7: 450,
  8: 600,
  9: 800,
  10: 1050
});

const OlingLabItems = {
  standard_door: {
    id: 'standard_door',
    name: 'Standard Door',
    type: 'door',
    category: 'door',
    rarity: 'common',
    layer: 'room',
    width: 1,
    height: 1,
    image: '/images/olings/furniture/doors/standard-door/standard-door.svg',
    exitGridPlacement:
      '/images/olings/furniture/doors/standard-door/exit-grid-placement.svg',
    locked: true,
    containerSlots: [
      {
        slotId: 'door-module',
        label: 'Door Module',
        accepts: ['door-module']
      }
    ]
  },
  standard_table: {
    id: 'standard_table',
    name: 'Standard Table',
    type: 'table',
    category: 'table',
    rarity: 'common',
    layer: 'room',
    width: 1,
    height: 1,
    image: '/images/olings/furniture/tables/standard-table/standard-table.svg',
    containerSlots: [
      {
        slotId: 'tabletop',
        label: 'Tabletop',
        accepts: ['incubator']
      }
    ]
  },
  incubeta: {
    id: 'incubeta',
    name: 'Incubeta',
    type: 'incubator',
    category: 'incubator',
    rarity: 'common',
    layer: 'container',
    width: 1,
    height: 1,
    image: '/images/olings/furniture/incubators/incubeta/incubeta.svg',
    acceptedSlots: ['tabletop'],
    inventorySlots: [
      {
        slotId: 'egg',
        slotType: 'egg',
        label: 'Egg',
        x: 256,
        y: 272
      }
    ]
  },
  explorer_gateway: {
    id: 'explorer_gateway',
    name: 'Explorer Gateway',
    type: 'door-module',
    category: 'door-module',
    rarity: 'uncommon',
    layer: 'container',
    width: 1,
    height: 1,
    image:
      '/images/olings/furniture/door-modules/explorer-gateway/explorer-gateway.svg',
    acceptedSlots: ['door-module']
  },
  oling_bed: {
    id: 'oling_bed',
    name: 'Oling Bed',
    type: 'bed',
    category: 'bed',
    rarity: 'uncommon',
    layer: 'room',
    width: 1,
    height: 1,
    allowedRows: [1],
    image: '/images/olings/furniture/beds/oling-bed/oling-bed.svg',
    // This filled SVG defines the area where an Oling may rest. Its shape—not
    // its bounding box—is used by the lab client when choosing a position.
    restGridPlacement:
      '/images/olings/furniture/beds/oling-bed/rest-grid-placement.svg',
    // Future beds can expose multiple entries here for their individual sleep
    // spaces. The placement inside each space comes from restGridPlacement.
    sleepSlots: [{ slotId: 'sleep-1' }]
  },
  supply_shelf: {
    id: 'supply_shelf',
    name: 'Supply Shelf',
    type: 'storage',
    category: 'storage',
    rarity: 'uncommon',
    layer: 'room',
    width: 1,
    height: 1,
    allowedRows: [1],
    image: '/images/olings/furniture/storage/supply-shelf/supply-shelf.svg',
    // The SVG is sized to its placement rectangle, not to the full lab cell.
    usesFullGridArtboard: false,
    storageGridPlacement:
      '/images/olings/furniture/storage/supply-shelf/storage-grid-placement.svg',
    inventorySlots: Array.from({ length: 16 }, (_, index) => ({
      slotId: `shelf-${index + 1}`,
      slotType: 'storage',
      label: `Shelf slot ${index + 1}`,
      maxStack: 8
    }))
  },
  basic_hanging_light: {
    id: 'basic_hanging_light',
    name: 'Basic Hanging Light',
    type: 'ceiling-light',
    category: 'ceiling-light',
    rarity: 'common',
    layer: 'room',
    width: 1,
    height: 1,
    allowedRows: [0],
    image:
      '/images/olings/furniture/ceiling-lights/basic-hanging-light/basic-hanging-light.svg',
    usesFullGridArtboard: false
  }
};

const STARTER_FURNITURE_KEYS = ['standard_table', 'incubeta'];

module.exports = {
  LAB_ROWS,
  LAB_MIN_COLUMNS,
  LAB_MAX_COLUMNS,
  STARTER_LAB_COLUMNS,
  LAB_PURCHASE_MAX_COLUMNS,
  LAB_COLUMN_PRICES,
  OlingLabItems,
  STARTER_FURNITURE_KEYS
};
