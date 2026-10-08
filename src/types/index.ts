export type AppTheme = 'dark' | 'light';

export type ThemeMode = 'dark' | 'light' | 'blue' | 'retro' | 'minimal';

export type LogoTheme = 'amber' | 'ocean' | 'emerald' | 'royal' | 'crimson' | 'sunset' | 'steel' | 'gold' | 'cyan' | 'orange' | 'custom';

export type AppLanguage = 'en' | 'ur';

export type AppView =
  | 'overview'
  | 'products'
  | 'transactions'
  | 'factories'
  | 'sales'
  | 'expenses'
  | 'raw_material'
  | 'paint_ledger'
  | 'labour_ledger'
  | 'scrapledger'
  | 'withdrawal'
  | 'stock'
  | 'inventory_forecast'
  | 'forecast'
  | 'returns'
  | 'visual_studio'
  | 'backup'
  | 'notifications'
  | 'rawmaterial'
  | 'paint'
  | 'labourledger'
  | 'productreturns'
  | 'gallery'
  | 'exports'
  | 'visualstudio'
  | 'settings'
  | 'printer';

export type PrinterConnectionType = 'wifi' | 'bluetooth' | 'wired';
export type PrinterPaperSize =
  | 'a4'
  | 'letter'
  | 'legal'
  | 'a5'
  | 'b5'
  | '80mm'
  | '58mm'
  | '100mm'
  | 'custom';

export type PrintOrientation = 'portrait' | 'landscape';
export type PrintMargins = 'none' | 'compact' | 'normal' | 'wide' | 'custom';
export type PrintColorMode = 'color' | 'monochrome';

export interface PrintPageSetup {
  paperSize: PrinterPaperSize;
  orientation: PrintOrientation;
  margins: PrintMargins;
  customWidthMm?: number;
  customHeightMm?: number;
  customMarginMm?: number;
  customMarginTopMm?: number;
  customMarginBottomMm?: number;
  customMarginLeftMm?: number;
  customMarginRightMm?: number;
  scale: number; // e.g. 100, 90, 80, 110
  colorMode: PrintColorMode;
  includeLogo: boolean;
  includeUrduAmount: boolean;
  includeSignatures: boolean;
  includeTimestamp: boolean;
  includePageNumbers: boolean;
  showWatermark?: boolean;
  printCopies: number;
  footerNote: string;
}

export interface PrinterSettings {
  connectionType: PrinterConnectionType;
  paperSize: PrinterPaperSize;
  printerName: string;
  wifiIpAddress: string;
  wifiPort: number;
  bluetoothDeviceName: string;
  bluetoothPaired: boolean;
  bluetoothDeviceId?: string;
  wiredPortName: string;
  autoPrintOnSale: boolean;
  printCopies: number;
  includeLogo: boolean;
  includeUrduAmount: boolean;
  footerNote: string;
  // Page setup extensions
  orientation?: PrintOrientation;
  margins?: PrintMargins;
  scale?: number;
  colorMode?: PrintColorMode;
  includeSignatures?: boolean;
  includeTimestamp?: boolean;
  includePageNumbers?: boolean;
  showWatermark?: boolean;
  customWidthMm?: number;
  customHeightMm?: number;
  customMarginMm?: number;
}

export interface VisualSettings {
  theme: ThemeMode;
  logoTheme: LogoTheme;
  showBlueprintGrid?: boolean;
  blueprintGridScale?: number; // Minor division scale in pixels (10px - 80px, default 20px)
  density?: 'comfortable' | 'compact';
  fontSize?: 'small' | 'normal' | 'large';
  reduceMotion?: boolean;
  hapticFeedback?: boolean;
  hapticAudio?: boolean;
  lockLogoPosition?: 'inline' | 'stacked';
  lockLogoHeight?: number;
  lockLogoVariant?: 'image' | 'vector';
  lockLogoFrame?: 'badge' | 'frameless';
  lockLogoAlignment?: 'center' | 'left';
  printerSettings?: PrinterSettings;
}

export interface RawStockItem {
  id?: string;
  name: string;
  category?: string;
  weight?: number;
  items?: number;
  initialWeight?: number;
  initialItems?: number;
  initialQuantity?: number;
  quantity?: number;
  lowStockThreshold?: number;
  reorderLevel?: number;
  unit?: string;
  lastUpdated?: string;
}

export interface Inquiry {
  id: string;
  date: string;
  party: string;
  phone: string;
  detail: string;
  urgency: 'normal' | 'high' | 'urgent';
  resolved?: boolean;
}

export interface RecipeItem {
  material: string;
  weightPerUnit?: number;
  itemsPerUnit?: number;
  customerSupplied?: boolean;
}

export interface RodBlueprintSpecs {
  rodType: 'ceiling' | 'pedestal';
  lengthInches: number;
  diameterInches?: string; // '3/4"', '1"', '1-1/4"', '1-1/2"'
  gauge: string; // '14 Gauge', '16 Gauge', '18 Gauge', '20 Gauge'
  hasTopClamp: boolean;
  hasBottomClamp: boolean;
  clampStyle: 'standard' | 'heavy_duty' | 'ring_collar' | 'welded_flange' | 'telescopic_sleeve';
  clampSize?: string; // '3/4"', '1"', '1-1/4"', '1-1/2"'
  clampGauge?: string; // '14 Gauge', '16 Gauge', '18 Gauge'
  threadType?: 'without_thread' | 'top_only' | 'bottom_only' | 'both_ends';
  threadStandard?: 'BSPT' | 'Metric' | 'NPT' | 'None';
  threadLengthInches?: number; // 1, 1.25, 1.5
  holeSizeMm: number; // 6, 8, 10, 12
  topHoleCount: number; // 0, 1, 2
  bottomHoleCount: number; // 0, 1, 2
  hasSafetySlit: boolean;
  hasWireConduit: boolean;
  canopyRings: boolean;
  // Garter Pin / Safety Cotter Pin Component Specs
  hasGarterPin?: boolean;
  garterPinType?: 'split_cotter' | 'hairpin_r_clip' | 'through_bolt_locknut';
  garterPinDiameterMm?: number;
  garterPinLengthMm?: number;
  garterPinMaterial?: 'zinc_plated_steel' | 'stainless_steel' | 'brass';
  finishColor?: string;
  notes?: string;
  // Extended Precision Engineering & Factory Detail Specs
  topHoleOffsetMm?: number;
  bottomHoleOffsetMm?: number;
  slitWidthMm?: number;
  slitLengthMm?: number;
  slitOffsetMm?: number;
  wallThicknessMm?: number;
  innerDiameterMm?: number;
  pipeEndCut?: 'square_deburred' | 'chamfer_45' | 'beveled' | 'slotted';
  clampBoltSize?: 'M6' | 'M8' | 'M10';
  clampEarWidthMm?: number;
  clampEarSpacingMm?: number;
  clampBoltLengthMm?: number;
  maxWiringCables?: number;
  coatingType?: 'powder_coated' | 'liquid_enamel' | 'chrome_plated' | 'galvanized' | 'raw_primed';
  toleranceMm?: number;
  loadRatingKg?: number;
  tensileStrengthKg?: number;
  engineerSignOff?: string;
  cadRevision?: string;
  batchCode?: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  cat: string;
  color?: string;
  size?: string;
  sizes?: string[];
  gauge?: string;
  weight?: string;
  stock?: number;
  reorderLevel?: number;
  recipe?: RecipeItem[];
  device?: string;
  blueprintSpecs?: RodBlueprintSpecs;
}

export interface CartLine {
  id: number;
  name: string;
  price: number;
  qty: number;
  color?: string | null;
  size?: string | null;
  batchId?: string;
  trackingNumber?: string;
}

export interface CustomerPayment {
  txnId: string;
  id: string;
  date: string;
  time: string;
  amount: number;
  method: string;
  detail: string;
  receivedBy?: string;
  receivedIn?: string;
  receiptUrl?: string;
  device?: string;
}

export interface GatePassData {
  fileData: string; // Base64 data URI for PDF or Image
  fileName: string;
  fileType: 'pdf' | 'image';
  fileSize?: number;
  uploadedAt: string;
  gatePassNo?: string;
  gateSequence?: number;
  gateSequenceNo?: string;
  receivedBy?: string;
  receiverRole?: string;
  gatePost?: string;
  vehicleNo?: string;
  driverName?: string;
  notes?: string;
  verified?: boolean;
  receiptType?: 'factory_customer' | 'raw_material_supplier';
  partyName?: string;
  orderRefId?: string;
}

export interface Transaction {
  id: string;
  date: string;
  time: string;
  itemsSummary: string;
  itemCount: number;
  itemCounts?: string;
  itemRates?: string;
  itemProductIds?: string;
  total: number;
  factory?: string | null;
  confirmed?: boolean;
  sizes?: string;
  colors?: string;
  paid: boolean;
  method?: string | null;
  detailCash?: string;
  detailBank?: string;
  detailOnline?: string;
  receiptUrl?: string;
  gatePass?: GatePassData;
  gatePassVerified?: boolean;
  gateSequence?: number;
  gateSequenceNo?: string;
  gateReceivedBy?: string;
  gateReceivedAt?: string;
  gatePost?: string;
  device?: string;
  isJobWork?: boolean;
  writtenOff?: number;
  batchId?: string;
  trackingNumber?: string;
  itemBatches?: string;
  itemTrackingNumbers?: string;
}

export interface Factory {
  name: string;
  location: string;
  contact: string;
}

export interface LedgerColumnConfig {
  showDate: boolean;
  showTime: boolean;
  showDesc: boolean;
  showDebit: boolean;
  showCredit: boolean;
  showBalance: boolean;
  showMethod: boolean;
  showPaidBy: boolean;
  showPaidTo: boolean;
  showAccount: boolean;
  showRef: boolean;
  showTax: boolean;
}

export interface CustomerLedgerEntry {
  id: string;
  date: string;
  time?: string;
  desc: string;
  debit: number;
  credit: number;
  method?: string;
  detail?: string;
  receivedBy?: string;
  receivedIn?: string;
  paidBy?: string;
  paidTo?: string;
  accountNumber?: string;
  bankName?: string;
  chequeNo?: string;
  chequeDate?: string;
  chequeStatus?: 'pending' | 'cleared' | 'bounced' | '';
  taxPercent?: number;
  taxAmt?: number;
  txnId?: string;
  receiptUrl?: string;
  device?: string;
}

export interface CustomerLedgerAccount {
  name: string;
  entries: CustomerLedgerEntry[];
}

export interface PaintEntry {
  id: string;
  date: string;
  time: string;
  desc: string;
  color?: string;
  itemSize?: string;
  itemType?: string;
  itemFactory?: string;
  itemCount?: string;
  ratePerItem?: string;
  debit: number;
  credit: number;
  method?: string;
  detail?: string;
  receivedBy?: string;
  receivedIn?: string;
  paidBy?: string;
  paidTo?: string;
  accountNumber?: string;
  bankName?: string;
  chequeNo?: string;
  chequeDate?: string;
  chequeStatus?: string;
  receiptUrl?: string;
  device?: string;
}

export interface Painter {
  name: string;
  colours?: string[];
  entries: PaintEntry[];
}

export interface RawEntry {
  id: string;
  date: string;
  time: string;
  desc: string;
  stockName?: string;
  isReturn?: boolean;
  weightIn?: number;
  itemsIn?: number;
  rateType?: string;
  rate?: number;
  weight?: string;
  bundleCount?: string;
  gaugeCount?: string;
  sizeCount?: string;
  debit: number;
  credit: number;
  method?: string;
  detail?: string;
  receivedBy?: string;
  receivedIn?: string;
  paidBy?: string;
  paidTo?: string;
  accountNumber?: string;
  bankName?: string;
  chequeNo?: string;
  chequeDate?: string;
  chequeStatus?: string;
  receiptUrl?: string;
  gatePass?: GatePassData;
  gateSequence?: number;
  gateSequenceNo?: string;
  gatePassNo?: string;
  gateReceivedAt?: string;
  gatePost?: string;
  device?: string;
}

export interface RawSupplier {
  name: string;
  entries: RawEntry[];
}

export interface ScrapEntry {
  id: string;
  date: string;
  time: string;
  desc: string;
  itemName?: string;
  type?: string;
  weight?: number;
  rate?: number;
  debit: number;
  credit: number;
  method?: string;
  detail?: string;
  receivedBy?: string;
  receivedIn?: string;
  paidBy?: string;
  paidTo?: string;
  accountNumber?: string;
  bankName?: string;
  chequeNo?: string;
  chequeDate?: string;
  chequeStatus?: string;
  device?: string;
}

export interface ScrapBuyer {
  name: string;
  entries: ScrapEntry[];
}

export interface WithdrawalEntry {
  id: string;
  date: string;
  time?: string;
  desc: string;
  amount: number;
  method: string;
  detail: string;
  note?: string;
  isReversed?: boolean;
  chequeDate?: string;
  chequeStatus?: string;
  withdrawnBy?: string;
  withdrawnIn?: string;
  paidBy?: string;
  paidTo?: string;
  accountNumber?: string;
  bankName?: string;
  chequeNo?: string;
  device?: string;
}

export interface LabourPieceRate {
  size: string;
  rate: number;
  rodSize?: string;
  guardSize?: string;
  weight?: string;
  sticks?: string;
  ready?: number;
}

export interface LabourEntry {
  id: string;
  date: string;
  time: string;
  kind: 'attendance' | 'payment' | 'advance' | 'loan' | 'damage';
  status?: 'present' | 'half' | 'absent' | 'leave';
  size?: string;
  units?: number;
  rate?: number;
  note?: string;
  debit: number;
  credit: number;
  workType?: string;
  method?: string;
  detail?: string;
  receivedBy?: string;
  receivedIn?: string;
  paidBy?: string;
  paidTo?: string;
  accountNumber?: string;
  bankName?: string;
  chequeNo?: string;
  chequeDate?: string;
  chequeStatus?: string;
  receiptUrl?: string;
  device?: string;
}

export interface Worker {
  name: string;
  workType: string;
  rateType: 'daily' | 'piece' | 'hourly';
  rate: number;
  pieceRates?: LabourPieceRate[];
  startDate?: string;
  endDate?: string;
  entries: LabourEntry[];
}

export interface CustomLedgerEntry {
  id: string;
  date: string;
  time: string;
  desc: string;
  size?: string;
  qty?: number;
  rate?: number;
  itemColour?: string;
  sizeCount?: string;
  itemCount?: string;
  ratePerItem?: string;
  weight?: string;
  weightPerItem?: number;
  weightPerScrap?: number;
  remainingWeight?: number | string;
  debit: number;
  credit: number;
  method?: string;
  detail?: string;
  receivedBy?: string;
  receivedIn?: string;
  paidBy?: string;
  paidTo?: string;
  accountNumber?: string;
  bankName?: string;
  chequeNo?: string;
  chequeDate?: string;
  chequeStatus?: string;
  itemMethod?: string;
  itemWeightStatus?: string;
  selfWeightStock?: number;
  material?: string;
  jobWorkTxnIds?: string[];
  receiptUrl?: string;
  device?: string;
}

export interface CustomLedger {
  id: string;
  name: string;
  weightStock?: {
    [key: string]: {
      weight: number;
      weightPerItem: number;
      weightPerScrap: number;
      remaining: number;
    };
  };
  selfWeightStock?: number;
  entries: CustomLedgerEntry[];
}

export interface ProductReturn {
  id: string;
  date: string;
  factory: string;
  product?: string;
  productName?: string;
  quantity?: number;
  qty?: number;
  reason?: string;
  originalOrderId?: string;
  status: 'pending' | 'resolved';
  resolution?: 'reworked' | 'scrapped';
  resolutionNotes?: string;
  reworkCost?: number;
  billingChoice?: string;
  refundAmount?: number;
  destinationChoice?: string;
  extraCustomerMaterial?: number;
  compensationRs?: number;
  compensationWeight?: number;
  device?: string;
}

export interface Expense {
  id: string;
  date: string;
  time?: string;
  desc: string;
  category: string;
  amount: number;
  method: string;
  detail?: string;
  paidBy?: string;
  paidTo?: string;
  accountNumber?: string;
  bankName?: string;
  chequeNo?: string;
  chequeDate?: string;
  chequeStatus?: string;
  taxPercent?: number;
  taxAmt?: number;
  receiptUrl?: string;
  device?: string;
}

export interface AppState {
  theme: AppTheme;
  logoTheme: LogoTheme;
  customLogoColor?: string;
  bgStyle: 'plain' | 'grid' | 'gradient' | 'steel';
  bgIntensity: number;
  textSize: 'small' | 'medium' | 'large';
  density: 'comfortable' | 'compact';
  reduceMotion: boolean;
  highContrast: boolean;
  iconStyle: 'sharp' | 'rounded';
  shadowIntensity: 'default' | 'none';
  language: AppLanguage;
  pin: string;
  recoveryAnswer: string;
  autolockMinutes: number;
  autolockSeconds?: number; // 30, 60 (1m), 300 (5m), 0 (never)
  deviceName: string;
  ntn: string;
  salesTaxReg: string;
  exportCompanyName: string;
  exportCompanyAddress: string;
  exportCompanyPhone: string;
  exportCompanyEmail: string;
  exportHeaderStyle: string;
  exportHeaderFontSize: string;
  exportHeaderFontWeight: string;
  exportHeaderCustomName: string;
  exportHeaderCustomSub: string;
  exportHeaderCustomLine: string;
  exportHeaderCustomBg: string;
  paperSize: 'a4' | 'letter' | 'legal' | 'a5';
  exportColorMode: 'colour' | 'bw';
  exportLanguage: 'en' | 'ur';
  voiceReplyEnabled: boolean;
  companyName: string;
  companyTagline: string;
  visualSettings: VisualSettings;
  products: Product[];
  items: Product[];
  factories: Factory[];
  customerLedgers: CustomerLedgerAccount[];
  painters: Painter[];
  rawSuppliers: RawSupplier[];
  labourWorkers: Worker[];
  workers: Worker[];
  scrapBuyers: ScrapBuyer[];
  withdrawals: WithdrawalEntry[];
  customLedgersList: CustomLedger[];
  returns: ProductReturn[];
  productReturns: ProductReturn[];
  expenses: Expense[];
  transactions: Transaction[];
  customerPayments: CustomerPayment[];
  rawStock: RawStockItem[];
  cart: CartLine[];
  nextTxnId: string;
  inquiries: Inquiry[];
  signatureUrl?: string;
  stampUrl?: string;
  expenseCategories: string[];
  workTypes: string[];
  rodSizes?: string[];
  rodWeights?: string[];
  guardSizes: string[];
  guardWeights: string[];
  stickCounts: string[];
  productColours: string[];
  productNames: string[];
  productSizes: string[];
  productWeights: string[];
  rawItemNames: string[];
  rawLedgerDescriptions: string[];
  rawWeights: string[];
  rawBundleCounts: string[];
  rawGaugeCounts: string[];
  rawSizeCounts: string[];
  rawMaterialReorderLevels: Record<string, number>;
  rawMaterialItemReorderLevels: Record<string, number>;
  rawMaterialUnits: Record<string, string>;
  rawMaterialResetAt: Record<string, { weight?: { date: string; time: string }; items?: { date: string; time: string } }>;
  sigStampImg?: string | null;
  exportedItems?: ExportedItem[];
  cloudTokens?: CloudTokensState;
  recycleBin?: RecycleBinItem[];
}

export type RecycleBinItemType =
  | 'transaction'
  | 'customer'
  | 'payment'
  | 'product'
  | 'factory'
  | 'factory_ledger_entry'
  | 'custom_ledger'
  | 'custom_ledger_entry'
  | 'painter'
  | 'paint_entry'
  | 'supplier'
  | 'raw_entry'
  | 'worker'
  | 'labour_entry'
  | 'scrap_buyer'
  | 'scrap_entry'
  | 'expense'
  | 'withdrawal'
  | 'inquiry'
  | 'raw_stock';

export interface RecycleBinItem {
  id: string;
  originalId: string;
  itemType: RecycleBinItemType;
  title: string;
  subtitle?: string;
  amount?: number;
  deletedAt: string;
  deletedBy?: string;
  parentEntityName?: string;
  payload: any;
}

export interface CloudTokensState {
  sheetsToken?: string;
  sheetsExpiresAt?: number;
  sheetsEmail?: string;
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  spreadsheetUrl?: string;
  driveToken?: string;
  driveExpiresAt?: number;
  driveEmail?: string;
  driveFolderId?: string;
  lastSyncedAt?: string;
}

export interface ExportedItem {
  id: string;
  title: string;
  category: 'invoice' | 'report' | 'blueprint' | 'receipt' | 'backup';
  format: 'jpg' | 'pdf' | 'csv' | 'json';
  createdAt: string;
  fileName: string;
  fileSize?: string;
  dataUrl?: string;
  description?: string;
  recordCount?: number;
  totalAmount?: number;
  customerName?: string;
}

export type ExportFontFamily = 'helvetica' | 'times' | 'courier';
export type ExportPaperSize = 'a4' | 'letter' | 'legal' | 'a5' | 'b5' | '80mm' | '58mm';
export type ExportOrientation = 'portrait' | 'landscape';

export interface ExportThemePreset {
  id: string;
  name: string;
  headerBgColor: string;
  headerTextColor: string;
  headerSubtitleColor: string;
  tableHeaderBgColor: string;
  tableHeaderTextColor: string;
  accentColor: string;
  description?: string;
}

export interface ExportDocumentConfig {
  presetId?: string;
  headerBgColor: string;
  headerTextColor: string;
  headerSubtitleColor: string;
  tableHeaderBgColor: string;
  tableHeaderTextColor: string;
  accentColor: string;
  fontFamily: ExportFontFamily;
  fontSize: 'compact' | 'normal' | 'large';
  paperSize: ExportPaperSize;
  orientation: ExportOrientation;
  showLogo: boolean;
  showDate: boolean;
  showStripedRows: boolean;
  showBorders: boolean;
  showSignatureLine: boolean;
  showAccentBar: boolean;
  companyName?: string;
  subtitle?: string;
  customNote?: string;
}

export interface ExportTablePayload {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  filename: string;
  companyName?: string;
  subtitle?: string;
  balanceFooterText?: string;
  defaultFormat?: 'pdf' | 'jpg' | 'both';
  initialOrientation?: ExportOrientation;
  initialPaperSize?: ExportPaperSize;
}
