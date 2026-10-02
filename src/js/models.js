// Vehicle catalogue. Specs are approximate (US market) and are only used for the simulation.
// Add a model by adding an entry here; the UI picks everything up from this table.
export const MODELS = {
  model3: {
    name: 'Model 3', body: 'sedan', screen: { inches: 15.4, w: 1600, h: 1000 },
    battery: 82, rangeMi: 363, zeroTo60: 4.2, topMph: 125, rearScreen: true,
    paints: [['Pearl White', '#e8e9ea'], ['Stealth Grey', '#6d7074'], ['Deep Blue', '#1f3a68'], ['Diamond Black', '#16171a'], ['Ultra Red', '#a3141c'], ['Quicksilver', '#b9bcc0']],
    wheels: ['18" Photon', '19" Nova', '20" Helix'], trunk: 'Trunk', frunk: true,
  },
  modely: {
    name: 'Model Y', body: 'suv', screen: { inches: 15.4, w: 1600, h: 1000 },
    battery: 81, rangeMi: 327, zeroTo60: 4.6, topMph: 125, rearScreen: true,
    paints: [['Pearl White', '#e8e9ea'], ['Stealth Grey', '#6d7074'], ['Deep Blue', '#1f3a68'], ['Diamond Black', '#16171a'], ['Ultra Red', '#a3141c'], ['Quicksilver', '#b9bcc0']],
    wheels: ['19" Crossflow', '20" Induction', '21" Überturbine'], trunk: 'Liftgate', frunk: true,
  },
  models: {
    name: 'Model S', body: 'sedan', screen: { inches: 17, w: 1760, h: 1040 },
    battery: 100, rangeMi: 405, zeroTo60: 3.1, topMph: 149, rearScreen: true,
    paints: [['Pearl White', '#e8e9ea'], ['Stealth Grey', '#6d7074'], ['Midnight Silver', '#44484d'], ['Deep Blue', '#1f3a68'], ['Solid Black', '#16171a'], ['Ultra Red', '#a3141c']],
    wheels: ['19" Tempest', '21" Arachnid'], trunk: 'Liftback', frunk: true,
    note: 'Tesla announced Model S/X production wind-down; kept for completeness.',
  },
  modelx: {
    name: 'Model X', body: 'suv', screen: { inches: 17, w: 1760, h: 1040 },
    battery: 100, rangeMi: 335, zeroTo60: 3.8, topMph: 149, rearScreen: true, falconDoors: true,
    paints: [['Pearl White', '#e8e9ea'], ['Stealth Grey', '#6d7074'], ['Midnight Silver', '#44484d'], ['Deep Blue', '#1f3a68'], ['Solid Black', '#16171a'], ['Ultra Red', '#a3141c']],
    wheels: ['20" Cyber Stream', '22" Turbine'], trunk: 'Liftgate', frunk: true,
    note: 'Tesla announced Model S/X production wind-down; kept for completeness.',
  },
  cybertruck: {
    name: 'Cybertruck', body: 'truck', screen: { inches: 18.5, w: 1792, h: 1008 },
    battery: 123, rangeMi: 325, zeroTo60: 4.1, topMph: 112, rearScreen: true,
    paints: [['Stainless Steel', '#a9acb0'], ['Stealth Grey wrap', '#55595e'], ['Matte Black wrap', '#17181a'], ['Satin White wrap', '#d9dadb']],
    wheels: ['18" All-Terrain', '20" Cyber'], trunk: 'Tonneau', frunk: true,
  },
};

export const MODEL_ORDER = ['model3', 'modely', 'models', 'modelx', 'cybertruck'];
