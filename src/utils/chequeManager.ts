import {
  AppState,
  ChequeRecord,
  ChequeStatus,
  ChequeStatusLogEntry,
  ChequeType,
  CustomerLedgerEntry,
  RawEntry,
  PaintEntry,
  Inquiry
} from '../types';
import { todayISO, generateId, fmt, dmyToISO } from './helpers';

// Helper to normalize cheque numbers for cross-matching (e.g. "HBL-884912" -> "884912" or "hbl884912")
export function normalizeChequeNo(chq: string): string {
  return chq.replace(/[\s\-_#]/g, '').toLowerCase();
}

/**
 * Parses and returns date difference in calendar days.
 * Positive = days in the future (remaining)
 * Negative = days in the past (overdue)
 */
export function calculateDaysRemaining(chequeDateStr?: string): { daysRemaining: number; isOverdue: boolean } {
  if (!chequeDateStr) return { daysRemaining: 0, isOverdue: false };

  const clean = chequeDateStr.trim();
  let targetYear = 0;
  let targetMonth = 0;
  let targetDay = 0;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(clean);
  const dmyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(clean);

  if (isoMatch) {
    targetYear = parseInt(isoMatch[1], 10);
    targetMonth = parseInt(isoMatch[2], 10) - 1;
    targetDay = parseInt(isoMatch[3], 10);
  } else if (dmyMatch) {
    targetDay = parseInt(dmyMatch[1], 10);
    targetMonth = parseInt(dmyMatch[2], 10) - 1;
    targetYear = parseInt(dmyMatch[3], 10);
  } else {
    const fallback = new Date(clean);
    if (isNaN(fallback.getTime())) return { daysRemaining: 0, isOverdue: false };
    targetYear = fallback.getFullYear();
    targetMonth = fallback.getMonth();
    targetDay = fallback.getDate();
  }

  const targetLocal = new Date(targetYear, targetMonth, targetDay);
  if (isNaN(targetLocal.getTime())) {
    return { daysRemaining: 0, isOverdue: false };
  }

  const todayParts = todayISO().split('-').map(Number);
  const todayLocal = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
  const diffTime = targetLocal.getTime() - todayLocal.getTime();
  const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const isOverdue = daysRemaining < 0;

  return { daysRemaining, isOverdue };
}

/**
 * Extracts and unifies all cheques across Customer Ledgers, Raw Material Suppliers,
 * Painters, Custom Ledgers, and Withdrawals.
 * Automatically identifies cross-linked endorsed cheques (customer cheque given to supplier).
 */
export function extractAllCheques(state: AppState): ChequeRecord[] {
  const chequesMap = new Map<string, ChequeRecord>();

  // 1. Scan Customer Ledgers (Cheques received from Customers/Factories)
  (state.customerLedgers || []).forEach(account => {
    (account.entries || []).forEach(entry => {
      const isCheque =
        entry.chequeNo ||
        entry.method?.toLowerCase().includes('cheque') ||
        entry.desc?.toLowerCase().includes('cheque') ||
        entry.desc?.toLowerCase().includes('chq') ||
        entry.detail?.toLowerCase().includes('cheque') ||
        entry.detail?.toLowerCase().includes('chq');

      if (!isCheque || entry.isReversal || entry.desc?.includes('[CHEQUE-BOUNCED-REVERSAL]')) {
        return;
      }

      const chqNumber = entry.chequeNo || entry.detail?.match(/#?([0-9A-Za-z]+)/)?.[1] || `CHQ-${entry.id}`;
      const amount = entry.credit > 0 ? entry.credit : entry.debit;
      if (amount <= 0) return;

      const chqDate = entry.chequeDate || entry.date || todayISO();
      const rawStatus = (entry.chequeStatus?.toLowerCase() || 'pending') as ChequeStatus;
      const { daysRemaining, isOverdue } = calculateDaysRemaining(chqDate);
      const finalStatus: ChequeStatus =
        rawStatus === 'bounced' ? 'bounced' : rawStatus === 'cleared' ? 'cleared' : rawStatus === 'presented' ? 'presented' : isOverdue ? 'overdue' : 'pending';

      const normKey = normalizeChequeNo(chqNumber);

      const record: ChequeRecord = {
        id: `cheque_cust_${entry.id}`,
        chequeNo: chqNumber,
        bankName: entry.bankName || (entry.detail?.includes('HBL') ? 'HBL' : entry.detail?.includes('Meezan') ? 'Meezan Bank' : 'Bank Cheque'),
        amount,
        issueDate: entry.date,
        chequeDate: chqDate,
        status: finalStatus,
        chequeType: 'customer_received',
        payerParty: account.name,
        payeeParty: state.companyName || 'Falcon Rod Maker',
        customerLedgerName: account.name,
        customerEntryId: entry.id,
        isCrossLinked: false,
        reversalApplied: entry.reversalEntryId !== undefined,
        isOverdue,
        daysRemaining,
        notes: entry.detail || entry.desc
      };

      chequesMap.set(normKey, record);
    });
  });

  // 2. Scan Raw Material Suppliers (Cheques given to raw suppliers: company cheque or customer endorsed)
  (state.rawSuppliers || []).forEach(supplier => {
    (supplier.entries || []).forEach(entry => {
      const isCheque =
        entry.chequeNo ||
        entry.method?.toLowerCase().includes('cheque') ||
        entry.desc?.toLowerCase().includes('cheque') ||
        entry.desc?.toLowerCase().includes('chq') ||
        entry.detail?.toLowerCase().includes('cheque') ||
        entry.detail?.toLowerCase().includes('chq');

      if (!isCheque || entry.isReversal || entry.desc?.includes('[CHEQUE-BOUNCED-REVERSAL]')) {
        return;
      }

      const chqNumber = entry.chequeNo || entry.detail?.match(/#?([0-9A-Za-z]+)/)?.[1] || `CHQ-${entry.id}`;
      const amount = entry.debit > 0 ? entry.debit : entry.credit;
      if (amount <= 0) return;

      const normKey = normalizeChequeNo(chqNumber);
      const existing = chequesMap.get(normKey);

      const chqDate = entry.chequeDate || entry.date || todayISO();
      const rawStatus = (entry.chequeStatus?.toLowerCase() || 'pending') as ChequeStatus;
      const { daysRemaining, isOverdue } = calculateDaysRemaining(chqDate);
      const finalStatus: ChequeStatus =
        rawStatus === 'bounced' ? 'bounced' : rawStatus === 'cleared' ? 'cleared' : rawStatus === 'presented' ? 'presented' : isOverdue ? 'overdue' : 'pending';

      if (existing) {
        // Cross-linked! This cheque was received from a customer AND endorsed to this raw material supplier!
        existing.isCrossLinked = true;
        existing.chequeType = 'endorsed_to_supplier';
        existing.payeeParty = supplier.name;
        existing.supplierName = supplier.name;
        existing.supplierEntryId = entry.id;
        if (finalStatus === 'bounced' || existing.status === 'bounced') {
          existing.status = 'bounced';
        }
      } else {
        // Falcon's own cheque issued to the supplier
        const record: ChequeRecord = {
          id: `cheque_supp_${entry.id}`,
          chequeNo: chqNumber,
          bankName: entry.bankName || 'Company Bank Account',
          amount,
          issueDate: entry.date,
          chequeDate: chqDate,
          status: finalStatus,
          chequeType: 'company_issued',
          payerParty: state.companyName || 'Falcon Rod Maker',
          payeeParty: supplier.name,
          supplierName: supplier.name,
          supplierEntryId: entry.id,
          isCrossLinked: false,
          reversalApplied: entry.reversalEntryId !== undefined,
          isOverdue,
          daysRemaining,
          notes: entry.detail || entry.desc
        };
        chequesMap.set(normKey, record);
      }
    });
  });

  // 3. Scan Painters Ledger
  (state.painters || []).forEach(painter => {
    (painter.entries || []).forEach(entry => {
      const isCheque =
        entry.chequeNo ||
        entry.method?.toLowerCase().includes('cheque') ||
        entry.desc?.toLowerCase().includes('cheque') ||
        entry.desc?.toLowerCase().includes('chq');

      if (!isCheque) return;

      const chqNumber = entry.chequeNo || `CHQ-PNT-${entry.id}`;
      const amount = entry.debit > 0 ? entry.debit : 0;
      if (amount <= 0) return;

      const normKey = normalizeChequeNo(chqNumber);
      const existing = chequesMap.get(normKey);

      if (existing) {
        existing.isCrossLinked = true;
        existing.otherLedgerType = 'paint';
        existing.otherLedgerName = painter.name;
        existing.otherEntryId = entry.id;
      } else {
        const chqDate = entry.chequeDate || entry.date || todayISO();
        const { daysRemaining, isOverdue } = calculateDaysRemaining(chqDate);
        chequesMap.set(normKey, {
          id: `cheque_pnt_${entry.id}`,
          chequeNo: chqNumber,
          bankName: 'Bank Cheque',
          amount,
          issueDate: entry.date,
          chequeDate: chqDate,
          status: (entry.chequeStatus as any) || (isOverdue ? 'overdue' : 'pending'),
          chequeType: 'company_issued',
          payerParty: state.companyName || 'Falcon Rod Maker',
          payeeParty: painter.name,
          otherLedgerType: 'paint',
          otherLedgerName: painter.name,
          otherEntryId: entry.id,
          isCrossLinked: false,
          isOverdue,
          daysRemaining
        });
      }
    });
  });

  // 4. Scan Custom Ledgers (Ancillary Job-Work accounts)
  (state.customLedgersList || []).forEach(ledger => {
    (ledger.entries || []).forEach(entry => {
      const isCheque =
        entry.chequeNo ||
        entry.desc?.toLowerCase().includes('cheque') ||
        entry.desc?.toLowerCase().includes('chq');

      if (!isCheque) return;

      const chqNumber = entry.chequeNo || `CHQ-CUL-${entry.id}`;
      const amount = (entry.credit || 0) > 0 ? (entry.credit || 0) : (entry.debit || 0);
      if (amount <= 0) return;

      const normKey = normalizeChequeNo(chqNumber);
      const existing = chequesMap.get(normKey);

      if (existing) {
        existing.isCrossLinked = true;
        existing.otherLedgerType = 'custom';
        existing.otherLedgerName = ledger.name;
        existing.otherEntryId = entry.id;
      }
    });
  });

  return Array.from(chequesMap.values()).sort((a, b) => {
    // Sort bounced and overdue first, then by clearing date
    if (a.status === 'bounced' && b.status !== 'bounced') return -1;
    if (b.status === 'bounced' && a.status !== 'bounced') return 1;
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (b.status === 'overdue' && a.status !== 'overdue') return 1;
    return new Date(a.chequeDate).getTime() - new Date(b.chequeDate).getTime();
  });
}

/**
 * Updates a cheque's status across all linked ledgers.
 * If status is set to 'bounced':
 * - In Customer/Factory Ledger: Reverses the payment deduction by posting a debit entry
 *   so the customer STILL owes the amount!
 * - In Raw Supplier Ledger: Reverses the payment made to the supplier by posting a credit entry
 *   so Falcon STILL owes the supplier!
 * - In Notifications: Adds a high-urgency dishonour alert.
 */
export function updateChequeStatusAndAutoReverse(
  state: AppState,
  chequeNo: string,
  newStatus: ChequeStatus,
  reasonNotes?: string,
  source: string = 'Cheque Management'
): { newState: AppState; reversedParties: string[]; reversalMessage: string } {
  const normKey = normalizeChequeNo(chequeNo);
  const allCheques = extractAllCheques(state);
  const targetCheque = allCheques.find(c => normalizeChequeNo(c.chequeNo) === normKey);
  const previousStatus: ChequeStatus | 'created' = targetCheque ? targetCheque.status : 'pending';

  const reversedParties: string[] = [];
  const currentDate = todayISO();
  const nowObj = new Date();
  const currentTime = nowObj.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const revId = generateId('rev');

  let updatedCustomerLedgers = [...(state.customerLedgers || [])];
  let updatedRawSuppliers = [...(state.rawSuppliers || [])];
  let updatedPainters = [...(state.painters || [])];
  let updatedInquiries = [...(state.inquiries || [])];

  const amount = targetCheque ? targetCheque.amount : 0;
  const payer = targetCheque ? targetCheque.payerParty : 'Customer';
  const payee = targetCheque ? targetCheque.payeeParty : 'Supplier';

  // 1. Update Customer Ledgers
  updatedCustomerLedgers = updatedCustomerLedgers.map(account => {
    const hasMatchingEntry = account.entries.some(
      e => e.chequeNo && normalizeChequeNo(e.chequeNo) === normKey
    );

    if (!hasMatchingEntry) return account;

    let entries = account.entries.map(e => {
      if (e.chequeNo && normalizeChequeNo(e.chequeNo) === normKey) {
        return {
          ...e,
          chequeStatus: newStatus as any
        };
      }
      return e;
    });

    if (newStatus === 'bounced') {
      const alreadyReversed = entries.some(
        e => e.desc.includes('[CHEQUE-BOUNCED-REVERSAL]') && e.desc.includes(chequeNo)
      );

      if (!alreadyReversed && amount > 0) {
        const reversalEntry: CustomerLedgerEntry = {
          id: `rev_cust_${revId}`,
          date: currentDate,
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          desc: `[CHEQUE-BOUNCED-REVERSAL] Dishonoured Chq #${chequeNo} (${targetCheque?.bankName || 'Bank'}) — Receivable Restored`,
          debit: amount, // Adds back to customer debt so balance is NOT deducted!
          credit: 0,
          method: 'Cheque-Reversal',
          chequeNo,
          chequeStatus: 'bounced',
          isReversal: true,
          detail: reasonNotes || `Cheque #${chequeNo} bounced / dishonoured by bank. Customer balance restored to unpaid.`
        };

        entries = [...entries, reversalEntry];
        reversedParties.push(`Customer: ${account.name}`);
      }
    }

    return {
      ...account,
      entries
    };
  });

  // 2. Update Raw Material Suppliers
  updatedRawSuppliers = updatedRawSuppliers.map(supplier => {
    const hasMatchingEntry = supplier.entries.some(
      e => e.chequeNo && normalizeChequeNo(e.chequeNo) === normKey
    );

    if (!hasMatchingEntry) return supplier;

    let entries = supplier.entries.map(e => {
      if (e.chequeNo && normalizeChequeNo(e.chequeNo) === normKey) {
        return {
          ...e,
          chequeStatus: newStatus
        };
      }
      return e;
    });

    if (newStatus === 'bounced') {
      const alreadyReversed = entries.some(
        e => e.desc.includes('[CHEQUE-BOUNCED-REVERSAL]') && e.desc.includes(chequeNo)
      );

      if (!alreadyReversed && amount > 0) {
        const reversalEntry: RawEntry = {
          id: `rev_supp_${revId}`,
          date: currentDate,
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          desc: `[CHEQUE-BOUNCED-REVERSAL] Endorsed Chq #${chequeNo} from ${payer} Dishonoured — Payable Restored`,
          debit: 0,
          credit: amount, // Adds back to Falcon payable debt to supplier!
          method: 'Cheque-Reversal',
          chequeNo,
          chequeStatus: 'bounced',
          isReversal: true,
          detail: reasonNotes || `Endorsed customer cheque #${chequeNo} bounced. Falcon liability to ${supplier.name} restored.`
        };

        entries = [...entries, reversalEntry];
        reversedParties.push(`Raw Supplier: ${supplier.name}`);
      }
    }

    return {
      ...supplier,
      entries
    };
  });

  // 3. Update Painters Ledger
  updatedPainters = updatedPainters.map(painter => {
    const hasMatchingEntry = painter.entries.some(
      e => e.chequeNo && normalizeChequeNo(e.chequeNo) === normKey
    );

    if (!hasMatchingEntry) return painter;

    let entries = painter.entries.map(e => {
      if (e.chequeNo && normalizeChequeNo(e.chequeNo) === normKey) {
        return {
          ...e,
          chequeStatus: newStatus as any
        };
      }
      return e;
    });

    if (newStatus === 'bounced') {
      const alreadyReversed = entries.some(
        e => e.desc.includes('[CHEQUE-BOUNCED-REVERSAL]') && e.desc.includes(chequeNo)
      );

      if (!alreadyReversed && amount > 0) {
        const reversalEntry: PaintEntry = {
          id: `rev_pnt_${revId}`,
          date: currentDate,
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          desc: `[CHEQUE-BOUNCED-REVERSAL] Chq #${chequeNo} Dishonoured — Payable Restored`,
          debit: 0,
          credit: amount,
          method: 'Cheque-Reversal',
          chequeNo,
          chequeStatus: 'bounced',
          detail: reasonNotes || `Cheque #${chequeNo} bounced. Payable to painter restored.`
        };

        entries = [...entries, reversalEntry];
        reversedParties.push(`Painter: ${painter.name}`);
      }
    }

    return {
      ...painter,
      entries
    };
  });

  // 4. Create Notification / Alert for Dishonoured or Matured Cheque
  if (newStatus === 'bounced') {
    const newInquiry: Inquiry = {
      id: `inq_chq_${Date.now()}`,
      date: currentDate,
      party: payer,
      phone: 'Banking / Cheques',
      urgency: 'urgent',
      detail: `CRITICAL DISHONOUR: Cheque #${chequeNo} (Rs ${fmt(amount)}) from ${payer}${
        targetCheque?.isCrossLinked ? ` endorsed to ${payee}` : ''
      } BOUNCED! Reversals automatically applied: customer receivable restored and supplier payable restored.`,
      resolved: false
    };

    updatedInquiries = [newInquiry, ...updatedInquiries];
  }

  const reversalMessage =
    newStatus === 'bounced'
      ? `Cheque #${chequeNo} marked BOUNCED! Automated cross-reversal applied to: ${reversedParties.join(
          ', '
        ) || 'Ledgers'}. Customer receivable restored and supplier payable restored.`
      : `Cheque #${chequeNo} status updated to ${newStatus.toUpperCase()}.`;

  const auditLogEntry: ChequeStatusLogEntry = {
    id: `chqlog_${generateId('audit')}`,
    chequeNo: targetCheque?.chequeNo || chequeNo,
    normalizedChequeNo: normKey,
    previousStatus,
    newStatus,
    timestamp: nowObj.toISOString(),
    date: currentDate,
    time: currentTime,
    amount,
    bankName: targetCheque?.bankName || 'Bank Cheque',
    payerParty: payer,
    payeeParty: payee,
    chequeType: targetCheque?.chequeType,
    source,
    notes:
      reasonNotes ||
      (newStatus === 'cleared'
        ? 'Cheque cleared and settled in bank account.'
        : newStatus === 'presented'
        ? 'Cheque deposited / presented to bank for clearing.'
        : newStatus === 'pending'
        ? 'Cheque status reset to Pending.'
        : undefined),
    reversedParties: reversedParties.length > 0 ? reversedParties : undefined
  };

  const updatedLogs = [auditLogEntry, ...(state.chequeStatusLogs || [])];

  return {
    newState: {
      ...state,
      customerLedgers: updatedCustomerLedgers,
      rawSuppliers: updatedRawSuppliers,
      painters: updatedPainters,
      inquiries: updatedInquiries,
      chequeStatusLogs: updatedLogs
    },
    reversedParties,
    reversalMessage
  };
}

/**
 * Atomic 1-Click Endorsement: Takes a customer cheque and hands it over to a Raw Material Supplier.
 * Logs credit in customer ledger (reducing customer debt) and logs debit in raw supplier ledger
 * (reducing payable to supplier), cross-linking them with identical chequeNo and metadata!
 */
export function endorseCustomerChequeToSupplier(
  state: AppState,
  params: {
    chequeNo: string;
    bankName: string;
    amount: number;
    chequeDate: string;
    customerName: string;
    supplierName: string;
    notes?: string;
  }
): AppState {
  const currentDate = todayISO();
  const currentTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const entryId = generateId('endorsed');

  // 1. Credit Customer Ledger
  let updatedCustomerLedgers = [...(state.customerLedgers || [])];
  const customerIdx = updatedCustomerLedgers.findIndex(c => c.name === params.customerName);

  const customerEntry: CustomerLedgerEntry = {
    id: `chq_c_${entryId}`,
    date: currentDate,
    time: currentTime,
    desc: `Cheque Received #${params.chequeNo} (${params.bankName}) · Endorsed to ${params.supplierName}`,
    debit: 0,
    credit: params.amount,
    method: 'Cheque',
    bankName: params.bankName,
    chequeNo: params.chequeNo,
    chequeDate: params.chequeDate,
    chequeStatus: 'pending',
    isEndorsedCheque: true,
    endorsedToSupplier: params.supplierName,
    detail: params.notes || `Cheque received from ${params.customerName} and directly endorsed to Raw Material Supplier ${params.supplierName}`
  };

  if (customerIdx >= 0) {
    updatedCustomerLedgers[customerIdx] = {
      ...updatedCustomerLedgers[customerIdx],
      entries: [...updatedCustomerLedgers[customerIdx].entries, customerEntry]
    };
  } else {
    updatedCustomerLedgers.push({
      name: params.customerName,
      entries: [customerEntry]
    });
  }

  // 2. Debit Raw Material Supplier Ledger
  let updatedRawSuppliers = [...(state.rawSuppliers || [])];
  const supplierIdx = updatedRawSuppliers.findIndex(s => s.name === params.supplierName);

  const supplierEntry: RawEntry = {
    id: `chq_s_${entryId}`,
    date: currentDate,
    time: currentTime,
    desc: `Payment via Endorsed Customer Cheque #${params.chequeNo} (${params.bankName}) from ${params.customerName}`,
    debit: params.amount,
    credit: 0,
    method: 'Cheque',
    bankName: params.bankName,
    chequeNo: params.chequeNo,
    chequeDate: params.chequeDate,
    chequeStatus: 'pending',
    isEndorsedCheque: true,
    endorsedFromCustomer: params.customerName,
    paidBy: `Customer Cheque: ${params.customerName}`,
    paidTo: params.supplierName,
    detail: params.notes || `Endorsed 3rd-party cheque received from customer ${params.customerName} given for raw material payment.`
  };

  if (supplierIdx >= 0) {
    updatedRawSuppliers[supplierIdx] = {
      ...updatedRawSuppliers[supplierIdx],
      entries: [...updatedRawSuppliers[supplierIdx].entries, supplierEntry]
    };
  } else {
    updatedRawSuppliers.push({
      name: params.supplierName,
      entries: [supplierEntry]
    });
  }

  const nowObj = new Date();
  const initialAuditEntry: ChequeStatusLogEntry = {
    id: `chqlog_${generateId('audit')}`,
    chequeNo: params.chequeNo,
    normalizedChequeNo: normalizeChequeNo(params.chequeNo),
    previousStatus: 'created',
    newStatus: 'pending',
    timestamp: nowObj.toISOString(),
    date: currentDate,
    time: nowObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    amount: params.amount,
    bankName: params.bankName,
    payerParty: params.customerName,
    payeeParty: params.supplierName,
    chequeType: 'endorsed_to_supplier',
    source: 'Cheque Endorsement',
    notes: params.notes || `Customer cheque #${params.chequeNo} endorsed to ${params.supplierName} (Due ${params.chequeDate})`
  };

  return {
    ...state,
    customerLedgers: updatedCustomerLedgers,
    rawSuppliers: updatedRawSuppliers,
    chequeStatusLogs: [initialAuditEntry, ...(state.chequeStatusLogs || [])]
  };
}

function toSafeAuditISO(rawDate?: string): string {
  if (!rawDate) return `${todayISO()}T09:00:00.000Z`;
  const trimmed = rawDate.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return `${trimmed.slice(0, 10)}T09:00:00.000Z`;
  }
  const iso = dmyToISO(trimmed);
  if (iso) return `${iso}T09:00:00.000Z`;
  return `${todayISO()}T09:00:00.000Z`;
}

/**
 * Builds the complete chronological audit timeline across every cheque by merging
 * explicit persisted status transitions (`state.chequeStatusLogs`) with baseline
 * creation / ledger state records for any pre-existing cheques without explicit logs yet.
 */
export function buildChequeAuditTimeline(state: AppState): ChequeStatusLogEntry[] {
  const persistedLogs = [...(state.chequeStatusLogs || [])];
  const allCheques = extractAllCheques(state);

  const syntheticLogs: ChequeStatusLogEntry[] = [];

  allCheques.forEach(cheque => {
    const norm = normalizeChequeNo(cheque.chequeNo);
    const chequePersisted = persistedLogs.filter(
      l => l.normalizedChequeNo === norm || normalizeChequeNo(l.chequeNo) === norm
    );

    const hasCreationLog = chequePersisted.some(l => l.previousStatus === 'created');
    if (!hasCreationLog) {
      const issueIso = toSafeAuditISO(cheque.issueDate || cheque.chequeDate);
      syntheticLogs.push({
        id: `base_init_${cheque.id}`,
        chequeNo: cheque.chequeNo,
        normalizedChequeNo: norm,
        previousStatus: 'created',
        newStatus: 'pending',
        timestamp: issueIso,
        date: issueIso.slice(0, 10),
        time: '09:00:00',
        amount: cheque.amount,
        bankName: cheque.bankName,
        payerParty: cheque.payerParty,
        payeeParty: cheque.payeeParty,
        chequeType: cheque.chequeType,
        source: 'Ledger Entry',
        notes: cheque.notes || `Cheque logged (Maturity due: ${cheque.chequeDate})`,
        isBaselineRecord: true
      });
    }

    // If current ledger status is already non-pending (e.g. cleared, presented, bounced, overdue)
    // and there is no persisted transition log into that status yet, represent it in the timeline
    if (cheque.status !== 'pending') {
      const hasStatusLog = chequePersisted.some(l => l.newStatus === cheque.status);
      if (!hasStatusLog) {
        const refDate = cheque.status === 'overdue' ? cheque.chequeDate : (cheque.reversalDate || cheque.chequeDate || cheque.issueDate);
        const eventIso = toSafeAuditISO(refDate).replace('T09:00:00', 'T14:30:00');
        syntheticLogs.push({
          id: `base_stat_${cheque.id}_${cheque.status}`,
          chequeNo: cheque.chequeNo,
          normalizedChequeNo: norm,
          previousStatus: 'pending',
          newStatus: cheque.status,
          timestamp: eventIso,
          date: eventIso.slice(0, 10),
          time: cheque.status === 'overdue' ? '00:01:00' : '14:30:00',
          amount: cheque.amount,
          bankName: cheque.bankName,
          payerParty: cheque.payerParty,
          payeeParty: cheque.payeeParty,
          chequeType: cheque.chequeType,
          source: cheque.status === 'overdue' ? 'Auto-Maturity Check' : 'Ledger Record',
          notes:
            cheque.status === 'bounced'
              ? 'Recorded as bounced in ledger records.'
              : cheque.status === 'cleared'
              ? 'Cleared in ledger records.'
              : cheque.status === 'presented'
              ? 'Presented at bank for collection.'
              : `Maturity date (${cheque.chequeDate}) passed without clearance.`,
          isBaselineRecord: true
        });
      }
    }
  });

  return [...persistedLogs, ...syntheticLogs].sort((a, b) => {
    const tA = new Date(a.timestamp).getTime() || 0;
    const tB = new Date(b.timestamp).getTime() || 0;
    return tB - tA;
  });
}
