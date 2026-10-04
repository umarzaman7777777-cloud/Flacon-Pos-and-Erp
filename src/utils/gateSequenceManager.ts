import { Transaction, RawSupplier, GatePassData } from '../types';

export interface UnifiedGateReceipt {
  id: string;
  sourceType: 'factory_customer' | 'raw_material_supplier';
  orderRef: string;
  partyName: string;
  date: string;
  time: string;
  gateSequence: number;
  gateSequenceNo: string;
  receivedBy: string;
  receiverRole?: string;
  gatePost?: string;
  gatePassNo?: string;
  vehicleNo?: string;
  driverName?: string;
  notes?: string;
  summary: string;
  totalAmount?: number;
  weightIn?: number;
  rawSupplierName?: string;
  fileData: string;
  fileName: string;
  fileType: 'pdf' | 'image';
  fileSize?: number;
  uploadedAt: string;
  verified: boolean;
}

export function formatGateSequence(seq: number): string {
  if (!seq || isNaN(seq) || seq <= 0) return 'GATE-SEQ-001';
  return `GATE-SEQ-${String(seq).padStart(3, '0')}`;
}

export function getNextGateSequence(
  transactions: Transaction[] = [],
  rawSuppliers: RawSupplier[] = []
): number {
  let maxSeq = 0;

  for (const t of transactions) {
    if (typeof t.gateSequence === 'number' && t.gateSequence > maxSeq) {
      maxSeq = t.gateSequence;
    }
    if (t.gatePass && typeof t.gatePass.gateSequence === 'number' && t.gatePass.gateSequence > maxSeq) {
      maxSeq = t.gatePass.gateSequence;
    }
  }

  for (const s of rawSuppliers) {
    if (!s.entries) continue;
    for (const e of s.entries) {
      if (typeof e.gateSequence === 'number' && e.gateSequence > maxSeq) {
        maxSeq = e.gateSequence;
      }
      if (e.gatePass && typeof e.gatePass.gateSequence === 'number' && e.gatePass.gateSequence > maxSeq) {
        maxSeq = e.gatePass.gateSequence;
      }
    }
  }

  return maxSeq + 1;
}

export function getAllGateReceipts(
  transactions: Transaction[] = [],
  rawSuppliers: RawSupplier[] = []
): UnifiedGateReceipt[] {
  const receipts: UnifiedGateReceipt[] = [];

  // 1. Factory / Customer receipts
  let fallbackSeq = 1;
  const solvedTxns = transactions.filter(t => !!t.receiptUrl || !!t.gatePass);

  for (const t of solvedTxns) {
    const gp = t.gatePass;
    const fileData = gp?.fileData || t.receiptUrl || '';
    if (!fileData) continue;

    const isPdf =
      gp?.fileType === 'pdf' ||
      fileData.startsWith('data:application/pdf') ||
      gp?.fileName?.toLowerCase().endsWith('.pdf');

    const seqNum = t.gateSequence || gp?.gateSequence || fallbackSeq++;
    const seqFormatted = t.gateSequenceNo || gp?.gateSequenceNo || formatGateSequence(seqNum);
    const receiver =
      t.gateReceivedBy ||
      gp?.receivedBy ||
      'Gate Officer (Verified)';

    receipts.push({
      id: t.id,
      sourceType: 'factory_customer',
      orderRef: `Order #${t.id}`,
      partyName: t.factory || 'Walk-in Customer',
      date: t.date,
      time: t.time || '12:00',
      gateSequence: seqNum,
      gateSequenceNo: seqFormatted,
      receivedBy: receiver,
      receiverRole: gp?.receiverRole || 'Gate Officer / Receiver',
      gatePost: gp?.gatePost || 'Main Factory Gate',
      gatePassNo: gp?.gatePassNo || `GP-${t.id}`,
      vehicleNo: gp?.vehicleNo,
      driverName: gp?.driverName,
      notes: gp?.notes,
      summary: t.itemsSummary,
      totalAmount: t.total,
      fileData,
      fileName: gp?.fileName || `GatePass_${t.id}.${isPdf ? 'pdf' : 'jpg'}`,
      fileType: isPdf ? 'pdf' : 'image',
      fileSize: gp?.fileSize,
      uploadedAt: gp?.uploadedAt || t.gateReceivedAt || `${t.date} ${t.time}`,
      verified: true
    });
  }

  // 2. Raw Material / Supplier receipts
  for (const s of rawSuppliers) {
    if (!s.entries) continue;
    for (const e of s.entries) {
      if (!e.receiptUrl && !e.gatePass) continue;

      const gp = e.gatePass;
      const fileData = gp?.fileData || e.receiptUrl || '';
      if (!fileData) continue;

      const isPdf =
        gp?.fileType === 'pdf' ||
        fileData.startsWith('data:application/pdf') ||
        gp?.fileName?.toLowerCase().endsWith('.pdf');

      const seqNum = e.gateSequence || gp?.gateSequence || fallbackSeq++;
      const seqFormatted = e.gateSequenceNo || gp?.gateSequenceNo || formatGateSequence(seqNum);
      const receiver =
        e.receivedBy ||
        gp?.receivedBy ||
        'Store Incharge / Gate';

      receipts.push({
        id: e.id,
        sourceType: 'raw_material_supplier',
        orderRef: `Raw Inward #${e.id.slice(-6)}`,
        partyName: s.name,
        rawSupplierName: s.name,
        date: e.date,
        time: e.time || '12:00',
        gateSequence: seqNum,
        gateSequenceNo: seqFormatted,
        receivedBy: receiver,
        receiverRole: gp?.receiverRole || 'Gate Receiving Officer',
        gatePost: gp?.gatePost || 'Raw Material Inward Gate',
        gatePassNo: e.gatePassNo || gp?.gatePassNo || `RAW-GP-${e.id.slice(-5)}`,
        vehicleNo: gp?.vehicleNo,
        driverName: gp?.driverName,
        notes: gp?.notes || e.detail,
        summary: `${e.desc}${e.stockName ? ` (${e.stockName})` : ''}${e.weightIn ? ` - ${e.weightIn} kg` : ''}`,
        totalAmount: e.credit || e.debit || 0,
        weightIn: e.weightIn,
        fileData,
        fileName: gp?.fileName || `SupplierReceipt_${e.id}.${isPdf ? 'pdf' : 'jpg'}`,
        fileType: isPdf ? 'pdf' : 'image',
        fileSize: gp?.fileSize,
        uploadedAt: gp?.uploadedAt || e.gateReceivedAt || `${e.date} ${e.time}`,
        verified: true
      });
    }
  }

  // Sort by gate sequence number ascending (chronological order of receiving at gate)
  return receipts.sort((a, b) => a.gateSequence - b.gateSequence);
}
