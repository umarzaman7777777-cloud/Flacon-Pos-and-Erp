import { AppState, Product } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 101,
    name: 'Ceiling-Fan-Rod-18-Deluxe',
    price: 260,
    cat: 'Rod (Ceiling)',
    color: 'Matt Black',
    size: '18 inch',
    weight: '0.85 kg',
    stock: 45,
    reorderLevel: 10,
    recipe: [
      { material: 'M.S. Steel Pipe', weightPerUnit: 0.8 },
      { material: 'Safety Bolt & Cotter Pin', itemsPerUnit: 1 },
      { material: 'Rubber Bushing', itemsPerUnit: 1 }
    ]
  },
  {
    id: 102,
    name: 'Ceiling-Fan-Rod-24-Standard',
    price: 340,
    cat: 'Rod (Ceiling)',
    color: 'Pure White',
    size: '24 inch',
    weight: '1.15 kg',
    stock: 35,
    reorderLevel: 8,
    recipe: [
      { material: 'M.S. Steel Pipe', weightPerUnit: 1.1 },
      { material: 'Safety Bolt & Cotter Pin', itemsPerUnit: 1 },
      { material: 'Rubber Bushing', itemsPerUnit: 1 }
    ]
  },
  {
    id: 103,
    name: 'Ceiling-Fan-Rod-12-Heavy',
    price: 195,
    cat: 'Rod (Ceiling)',
    color: 'Off-White',
    size: '12 inch',
    weight: '0.65 kg',
    stock: 50,
    reorderLevel: 12,
    recipe: [
      { material: 'M.S. Steel Pipe', weightPerUnit: 0.6 },
      { material: 'Safety Bolt & Cotter Pin', itemsPerUnit: 1 },
      { material: 'Rubber Bushing', itemsPerUnit: 1 }
    ]
  },
  {
    id: 104,
    name: 'Ceiling-Fan-Rod-36-Industrial',
    price: 490,
    cat: 'Rod (Ceiling)',
    color: 'Smoke Grey',
    size: '36 inch',
    weight: '1.85 kg',
    stock: 25,
    reorderLevel: 10,
    recipe: [
      { material: 'M.S. Heavy Pipe', weightPerUnit: 1.75 },
      { material: 'Safety Bolt & Cotter Pin', itemsPerUnit: 1 },
      { material: 'Rubber Bushing', itemsPerUnit: 1 }
    ]
  },
  {
    id: 105,
    name: 'Ceiling-Fan-Rod-48-Heavy',
    price: 680,
    cat: 'Rod (Ceiling)',
    color: 'Silver',
    size: '48 inch',
    weight: '2.45 kg',
    stock: 20,
    reorderLevel: 5,
    recipe: [
      { material: 'M.S. Heavy Pipe', weightPerUnit: 2.35 },
      { material: 'Safety Bolt & Cotter Pin', itemsPerUnit: 1 },
      { material: 'Rubber Bushing', itemsPerUnit: 1 }
    ]
  },
  {
    id: 106,
    name: 'Pedestal-Fan-Extension-Rod-20',
    price: 390,
    cat: 'Rod (Pedestal)',
    color: 'Shine Black',
    size: '20 inch',
    weight: '1.35 kg',
    stock: 30,
    reorderLevel: 8,
    recipe: [
      { material: 'M.S. Steel Pipe', weightPerUnit: 1.25 },
      { material: 'Safety Bolt & Cotter Pin', itemsPerUnit: 1 }
    ]
  },
  {
    id: 107,
    name: 'Pedestal-Fan-Telescopic-Rod-24',
    price: 430,
    cat: 'Rod (Pedestal)',
    color: 'Matt Black',
    size: '24 inch',
    weight: '1.50 kg',
    stock: 25,
    reorderLevel: 6,
    recipe: [
      { material: 'M.S. Steel Pipe', weightPerUnit: 1.4 },
      { material: 'Safety Bolt & Cotter Pin', itemsPerUnit: 1 }
    ]
  }
];

export const INITIAL_STATE: AppState = {
  theme: 'dark',
  logoTheme: 'amber',
  bgStyle: 'grid',
  bgIntensity: 18,
  textSize: 'medium',
  density: 'comfortable',
  reduceMotion: false,
  highContrast: false,
  iconStyle: 'rounded',
  shadowIntensity: 'default',
  language: 'en',
  pin: '321',
  recoveryAnswer: 'Umar',
  autolockMinutes: 5,
  autolockSeconds: 300,
  deviceName: 'Shop Counter',
  ntn: '4128956-8',
  salesTaxReg: '08-01-8412-911-28',
  exportCompanyName: 'Falcon Rod Maker',
  exportCompanyAddress: 'Circular Road, Industrial Estate, Gujrat',
  exportCompanyPhone: '+92 300 6214589',
  exportCompanyEmail: 'falconrodmaker.gujrat@gmail.com',
  exportHeaderStyle: 'banner',
  exportHeaderFontSize: 'normal',
  exportHeaderFontWeight: 'bold',
  exportHeaderCustomName: '#F5B700',
  exportHeaderCustomSub: '#E8590C',
  exportHeaderCustomLine: '#F5B700',
  exportHeaderCustomBg: '#24282C',
  paperSize: 'a4',
  exportColorMode: 'colour',
  exportLanguage: 'en',
  voiceReplyEnabled: true,

  products: INITIAL_PRODUCTS,
  items: [
    {
      id: 201,
      name: 'Pipe Threading & Hole Punching',
      price: 35,
      cat: 'Job Work Item',
      recipe: [{ material: 'M.S. Steel Pipe', weightPerUnit: 0.15 }]
    },
    {
      id: 202,
      name: 'Rod Swaging & Collar Fitting',
      price: 45,
      cat: 'Job Work Item',
      recipe: [{ material: 'Safety Bolt & Cotter Pin', itemsPerUnit: 1 }]
    }
  ],

  factories: [
    { name: 'Al-Madina Fan Workshop', location: 'Shaheen Chowk, Gujrat', contact: '0301-7894561' },
    { name: 'Royal Star Fan Industry', location: 'Sargodha Road, Gujrat', contact: '0322-6549870' },
    { name: 'National Electric Co.', location: 'G.T Road, Gujrat', contact: '0333-8521479' },
    { name: 'Pak Fan Ancillary Unit', location: 'Small Estate, Gujrat', contact: '0300-9874563' }
  ],

  customerLedgers: [
    {
      name: 'Al-Madina Fan Workshop',
      entries: [
        { id: 'cl_101', date: '01/09/2026', time: '10:30 AM', desc: 'Order #0001 — 50x Ceiling-Fan-Rod-18-Deluxe (18")', debit: 13000, credit: 10000, method: 'Cash', detail: 'Received at shop counter' },
        { id: 'cl_102', date: '08/09/2026', time: '02:15 PM', desc: 'Order #0004 — 40x Ceiling-Fan-Rod-24-Standard (24")', debit: 13600, credit: 10000, method: 'Online', detail: 'Meezan Bank Txn #4891' }
      ]
    },
    {
      name: 'Royal Star Fan Industry',
      entries: [
        { id: 'cl_201', date: '03/09/2026', time: '11:00 AM', desc: 'Order #0002 — 80x Ceiling-Fan-Rod-12-Heavy (12")', debit: 15600, credit: 10000, method: 'Cheque', detail: 'HBL Chq #884912', chequeDate: '20/09/2026', chequeStatus: 'pending' }
      ]
    },
    {
      name: 'National Electric Co.',
      entries: [
        { id: 'cl_301', date: '05/09/2026', time: '04:00 PM', desc: 'Order #0003 — 30x Ceiling-Fan-Rod-36-Industrial (36")', debit: 14700, credit: 14700, method: 'Cash', detail: 'Fully settled on pickup' }
      ]
    }
  ],

  painters: [
    {
      name: 'Rashid Painter',
      colours: ['Shine Black', 'Matt Black', 'Pure White', 'Silver'],
      entries: [
        { id: 'pl_101', date: '02/09/2026', time: '10:00 AM', desc: 'Powder coating 18" Ceiling Fan Down Rods', color: 'Matt Black', itemSize: '18 inch', itemCount: '120', ratePerItem: '22', debit: 2000, credit: 2640, method: 'Cash' },
        { id: 'pl_102', date: '09/09/2026', time: '04:30 PM', desc: 'Weekly advance payment', debit: 3000, credit: 0, method: 'Cash', detail: 'Eid advance' }
      ]
    },
    {
      name: 'Tariq Spray Center',
      colours: ['Moon White', 'Half White', 'Smoke Grey'],
      entries: [
        { id: 'pl_201', date: '04/09/2026', time: '01:00 PM', desc: 'Powder coating 24" Ceiling Fan Down Rods', color: 'Pure White', itemSize: '24 inch', itemCount: '85', ratePerItem: '25', debit: 1000, credit: 2125, method: 'Online' }
      ]
    }
  ],

  rawSuppliers: [
    {
      name: 'Ittefaq Steel Mills Gujranwala',
      entries: [
        { id: 'rl_101', date: '01/09/2026', time: '09:00 AM', desc: 'M.S. Steel Pipe bundle 16 Gauge (3/4" Dia)', stockName: 'M.S. Steel Pipe', weightIn: 450, bundleCount: '9', gaugeCount: '16 Gauge', rate: 290, rateType: 'weight', debit: 100000, credit: 130500, method: 'Bank', detail: 'Bank Al-Habib' },
        { id: 'rl_102', date: '10/09/2026', time: '11:30 AM', desc: 'M.S. Heavy Pipe 14 Gauge (1" Dia)', stockName: 'M.S. Heavy Pipe', weightIn: 220, bundleCount: '5', rate: 295, rateType: 'weight', debit: 50000, credit: 64900, method: 'Cash' }
      ]
    },
    {
      name: 'Punjab Hardware & Fittings Trader',
      entries: [
        { id: 'rl_201', date: '03/09/2026', time: '03:00 PM', desc: 'Rod Safety Bolts, Cotter Pins & Bushings', stockName: 'Safety Bolt & Cotter Pin', itemsIn: 1500, debit: 20000, credit: 22500, method: 'Cash' }
      ]
    }
  ],

  labourWorkers: [
    {
      name: 'Muhammad Rafiq (Master)',
      workType: 'Pipe Cutting & Punching',
      rateType: 'daily',
      rate: 1600,
      startDate: '01/01/2025',
      entries: [
        { id: 'wl_101', date: '12/09/2026', time: '06:00 PM', kind: 'attendance', status: 'present', debit: 0, credit: 1600, note: 'Daily wage logged' },
        { id: 'wl_102', date: '13/09/2026', time: '06:00 PM', kind: 'attendance', status: 'present', debit: 0, credit: 1600, note: 'Daily wage logged' },
        { id: 'wl_103', date: '14/09/2026', time: '05:00 PM', kind: 'payment', debit: 5000, credit: 0, method: 'Cash', note: 'Weekly wage withdrawal' }
      ]
    },
    {
      name: 'Shabbir Hussain',
      workType: 'Pipe Threading & Swaging',
      rateType: 'piece',
      rate: 0,
      pieceRates: [
        { size: '18 inch', rate: 6.5, rodSize: 'R/18"', guardSize: 'R/18"', weight: '0.85 kg', sticks: '1' },
        { size: '24 inch', rate: 8.5, rodSize: 'R/24"', guardSize: 'R/24"', weight: '1.15 kg', sticks: '1' }
      ],
      startDate: '15/03/2025',
      entries: [
        { id: 'wl_201', date: '12/09/2026', time: '06:30 PM', kind: 'attendance', status: 'present', size: '18 inch', units: 140, debit: 0, credit: 910, note: '140 pcs 18" threaded' }
      ]
    }
  ],

  scrapBuyers: [
    {
      name: 'Bismillah Scrap Merchant',
      entries: [
        { id: 'sl_101', date: '05/09/2026', time: '02:00 PM', desc: 'Pipe end cut-offs & boring chips scrap', itemName: 'Steel Pipe Scrap', type: 'Steel', weight: 140, rate: 165, debit: 23100, credit: 20000, method: 'Cash', detail: 'Weight slip #1049' }
      ]
    }
  ],

  withdrawals: [
    { id: 'wd_101', date: '06/09/2026', desc: 'Owner Personal Cash Drawing', amount: 15000, method: 'Cash', detail: 'Home groceries & family expense', withdrawnBy: 'Umar Zaman', withdrawnIn: 'Cash' },
    { id: 'wd_102', date: '12/09/2026', desc: 'Utility vehicle fuel drawing', amount: 4500, method: 'Cash', detail: 'Suzuki Carry petrol', withdrawnBy: 'Umar Zaman', withdrawnIn: 'Cash' }
  ],

  customLedgersList: [
    {
      id: 'cul_1',
      name: 'Super Asia Ancillary Job-Work',
      selfWeightStock: 120,
      entries: [
        { id: 'cule_101', date: '04/09/2026', time: '11:00 AM', desc: 'Received customer steel pipe for cutting & threading', weight: '250', itemCount: '150', ratePerItem: '35', debit: 5250, credit: 0, itemMethod: 'SteelWeight', itemWeightStatus: 'confirmed', selfWeightStock: 120 }
      ]
    }
  ],

  returns: [
    {
      id: 'pr_101',
      date: '07/09/2026',
      factory: 'Al-Madina Fan Workshop',
      product: 'Ceiling-Fan-Rod-18-Deluxe',
      quantity: 4,
      reason: 'Thread pitch alignment gap on lower canopy fitting',
      status: 'resolved',
      resolution: 'reworked',
      reworkCost: 150,
      billingChoice: 'replace',
      destinationChoice: 'factory'
    }
  ],

  expenses: [
    { id: 'exp_101', date: '01/09/2026', desc: 'Workshop Electricity Bill GEPCO', category: 'Electricity', amount: 34500, method: 'Online', detail: 'Consumer #28914' },
    { id: 'exp_102', date: '04/09/2026', desc: 'Oxygen & Acetylene Gas Refill', category: 'Gas', amount: 6200, method: 'Cash', detail: 'Gujrat Cylinder Depot' },
    { id: 'exp_103', date: '08/09/2026', desc: 'Rickshaw Transport for 120 fan rods to Lahore', category: 'Transport', amount: 2800, method: 'Cash', detail: 'Goods Adda Sargodha Road' },
    { id: 'exp_104', date: '10/09/2026', desc: 'Workshop Sweeper & Cleaner monthly', category: 'Factory Cleaner', amount: 4000, method: 'Cash' }
  ],

  transactions: [
    {
      id: '0001',
      date: '01/09/2026',
      time: '10:30',
      itemsSummary: 'Ceiling-Fan-Rod-18-Deluxe (18")',
      itemCount: 50,
      itemCounts: '50',
      itemRates: '260',
      total: 13000,
      factory: 'Al-Madina Fan Workshop',
      confirmed: true,
      sizes: '18 inch',
      colors: 'Matt Black',
      paid: true,
      method: 'Cash',
      detailCash: 'Received at shop'
    },
    {
      id: '0002',
      date: '03/09/2026',
      time: '11:00',
      itemsSummary: 'Ceiling-Fan-Rod-12-Heavy (12")',
      itemCount: 80,
      itemCounts: '80',
      itemRates: '195',
      total: 15600,
      factory: 'Royal Star Fan Industry',
      confirmed: true,
      sizes: '12 inch',
      colors: 'Off-White',
      paid: false,
      method: 'Cheque',
      detailBank: 'HBL Chq #884912'
    },
    {
      id: '0003',
      date: '05/09/2026',
      time: '16:00',
      itemsSummary: 'Ceiling-Fan-Rod-36-Industrial (36")',
      itemCount: 30,
      itemCounts: '30',
      itemRates: '490',
      total: 14700,
      factory: 'National Electric Co.',
      confirmed: true,
      sizes: '36 inch',
      colors: 'Smoke Grey',
      paid: true,
      method: 'Cash'
    },
    {
      id: '0004',
      date: '08/09/2026',
      time: '14:15',
      itemsSummary: 'Ceiling-Fan-Rod-24-Standard (24")',
      itemCount: 40,
      itemCounts: '40',
      itemRates: '340',
      total: 13600,
      factory: 'Al-Madina Fan Workshop',
      confirmed: true,
      sizes: '24 inch',
      colors: 'Pure White',
      paid: false
    }
  ],

  customerPayments: [
    {
      txnId: '0001',
      id: 'cp_101',
      date: '01/09/2026',
      time: '10:35 AM',
      amount: 10000,
      method: 'Cash',
      detail: 'Advance on dispatch',
      receivedBy: 'Umar Zaman',
      receivedIn: 'Cash Box'
    },
    {
      txnId: '0002',
      id: 'cp_102',
      date: '03/09/2026',
      time: '11:05 AM',
      amount: 10000,
      method: 'Cheque',
      detail: 'HBL Cheque #884912',
      receivedBy: 'Umar Zaman',
      receivedIn: 'Bank Account'
    },
    {
      txnId: '0003',
      id: 'cp_103',
      date: '05/09/2026',
      time: '04:10 PM',
      amount: 14700,
      method: 'Cash',
      detail: 'Cleared in full',
      receivedBy: 'Umar Zaman',
      receivedIn: 'Cash Box'
    }
  ],

  expenseCategories: ['Raw Material', 'Labour', 'Paint', 'Electricity', 'Gas', 'Sanitation', 'Factory Cleaner', 'Rickshaw Rent', 'Rent', 'Transport', 'Repair/Rework'],
  workTypes: ['Pipe Cutting', 'Pipe Punching', 'Pipe Threading', 'Swaging', 'Painting', 'Packing'],
  rodSizes: ['R/6"', 'R/12"', 'R/18"', 'R/24"', 'R/30"', 'R/36"', 'R/42"', 'R/48"', 'R/54"', 'R/60"'],
  rodWeights: ['0.45 kg', '0.65 kg', '0.85 kg', '1.15 kg', '1.5 kg', '1.85 kg', '2.45 kg'],
  guardSizes: ['R/6"', 'R/12"', 'R/18"', 'R/24"', 'R/30"', 'R/36"', 'R/42"', 'R/48"', 'R/54"', 'R/60"'],
  guardWeights: ['0.45 kg', '0.65 kg', '0.85 kg', '1.15 kg', '1.5 kg', '1.85 kg', '2.45 kg'],
  stickCounts: ['1', '2', '3', '4'],
  productColours: ['Matt Black', 'Shine Black', 'Pure White', 'Off-White', 'Smoke Grey', 'Silver', 'Golden', 'Antique Brass'],
  productNames: [
    'Ceiling-Fan-Rod-12-Heavy',
    'Ceiling-Fan-Rod-18-Deluxe',
    'Ceiling-Fan-Rod-24-Standard',
    'Ceiling-Fan-Rod-30-Special',
    'Ceiling-Fan-Rod-36-Industrial',
    'Ceiling-Fan-Rod-48-Heavy',
    'Ceiling-Fan-Rod-60-Extra-Long',
    'Pedestal-Fan-Extension-Rod-20',
    'Bracket-Fan-Mounting-Rod-16'
  ],
  productSizes: ['R/12"', 'R/18"', 'R/24"', 'R/30"', 'R/36"', 'R/48"', 'R/60"'],
  productWeights: ['0.65 kg', '0.85 kg', '1.15 kg', '1.85 kg', '2.45 kg'],
  rawItemNames: ['M.S. Steel Pipe', 'M.S. Heavy Pipe', 'Safety Bolt & Cotter Pin', 'Rubber Bushing', 'Threaded Coupler'],
  rawLedgerDescriptions: ['M.S. Steel Pipe bundle (16 Gauge)', 'M.S. Heavy Pipe bundle (14 Gauge)', 'Advance Payment', 'Balance Payment', 'Purchase'],
  rawWeights: ['150 kg', '220 kg', '350 kg', '450 kg', '600 kg'],
  rawBundleCounts: ['3', '5', '8', '10', '15'],
  rawGaugeCounts: ['14 Gauge', '16 Gauge', '18 Gauge'],
  rawSizeCounts: ['12 inch', '18 inch', '24 inch', '36 inch', '48 inch'],
  rawMaterialReorderLevels: { 'M.S. Steel Pipe': 100, 'M.S. Heavy Pipe': 50 },
  rawMaterialItemReorderLevels: { 'Safety Bolt & Cotter Pin': 100, 'Rubber Bushing': 150 },
  rawMaterialUnits: { 'M.S. Steel Pipe': 'kg', 'M.S. Heavy Pipe': 'kg' },
  rawMaterialResetAt: {},

  companyName: 'Falcon Rod Maker',
  companyTagline: 'Precision Ceiling Fan Down Rod Specialist — Gujrat, Pakistan',
  visualSettings: {
    theme: 'dark',
    logoTheme: 'amber',
    showBlueprintGrid: true,
    density: 'comfortable',
    fontSize: 'normal',
    reduceMotion: false
  },
  workers: [
    {
      name: 'Muhammad Rafiq (Master)',
      workType: 'Pipe Cutting & Punching',
      rateType: 'daily',
      rate: 1600,
      startDate: '01/01/2025',
      entries: [
        { id: 'wl_101', date: '12/09/2026', time: '06:00 PM', kind: 'attendance', status: 'present', debit: 0, credit: 1600, note: 'Daily wage logged' },
        { id: 'wl_102', date: '13/09/2026', time: '06:00 PM', kind: 'attendance', status: 'present', debit: 0, credit: 1600, note: 'Daily wage logged' },
        { id: 'wl_103', date: '14/09/2026', time: '05:00 PM', kind: 'payment', debit: 5000, credit: 0, method: 'Cash', note: 'Weekly wage withdrawal' }
      ]
    },
    {
      name: 'Shabbir Hussain',
      workType: 'Pipe Threading & Swaging',
      rateType: 'piece',
      rate: 0,
      pieceRates: [
        { size: '18 inch', rate: 6.5, rodSize: 'R/18"', guardSize: 'R/18"', weight: '0.85 kg', sticks: '1' },
        { size: '24 inch', rate: 8.5, rodSize: 'R/24"', guardSize: 'R/24"', weight: '1.15 kg', sticks: '1' }
      ],
      startDate: '15/03/2025',
      entries: [
        { id: 'wl_201', date: '12/09/2026', time: '06:30 PM', kind: 'attendance', status: 'present', size: '18 inch', units: 140, debit: 0, credit: 910, note: '140 pcs 18" threaded' }
      ]
    }
  ],
  rawStock: [
    { id: 'rs_1', name: 'M.S. Steel Pipe (16 Gauge - 3/4" Dia)', category: 'Raw Material', initialWeight: 450, weight: 450, unit: 'kg', reorderLevel: 100, lastUpdated: '2026-09-01' },
    { id: 'rs_2', name: 'M.S. Heavy Pipe (14 Gauge - 1" Dia)', category: 'Raw Material', initialWeight: 220, weight: 220, unit: 'kg', reorderLevel: 50, lastUpdated: '2026-09-10' },
    { id: 'rs_3', name: 'Safety Bolt & Cotter Pin Fittings', category: 'Fittings', initialWeight: 0, weight: 0, initialQuantity: 1200, quantity: 1200, unit: 'pcs', reorderLevel: 150, lastUpdated: '2026-09-03' },
    { id: 'rs_4', name: 'Rubber Bushings & Canopy Rings', category: 'Fittings', initialWeight: 0, weight: 0, initialQuantity: 1500, quantity: 1500, unit: 'pcs', reorderLevel: 200, lastUpdated: '2026-09-03' }
  ],
  cart: [],
  nextTxnId: '0005',
  productReturns: [
    {
      id: 'ret_1',
      date: '2026-09-08',
      productName: 'Ceiling-Fan-Rod-18-Deluxe',
      qty: 4,
      factory: 'Al-Madina Fan Workshop',
      reason: 'Thread pitch alignment gap on lower canopy fitting',
      status: 'pending'
    }
  ],
  inquiries: [
    {
      id: 'inq_1',
      date: '2026-03-24',
      party: 'Lahore Electric Store (Kashif Sb)',
      phone: '0300-4567891',
      detail: 'Needs 500 pcs 24 inch heavy gauge ceiling fan rods delivered by Friday.',
      urgency: 'urgent',
      resolved: false
    },
    {
      id: 'inq_2',
      date: '2026-03-25',
      party: 'Gujranwala Fan Syndicate',
      phone: '0321-9876543',
      detail: 'Inquiry regarding rate quotation for 1000 pcs 18 inch deluxe fan rods.',
      urgency: 'normal',
      resolved: false
    }
  ],
  signatureUrl: undefined,
  stampUrl: undefined
};
