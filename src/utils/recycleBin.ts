import { AppState, RecycleBinItem, RecycleBinItemType } from '../types';

/**
 * Generate a unique ID for a recycle bin item
 */
export function createRecycleBinId(): string {
  return `bin_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Helper to wrap any deleted entity into a RecycleBinItem
 */
export function buildRecycleBinItem(params: {
  itemType: RecycleBinItemType;
  originalId: string;
  title: string;
  subtitle?: string;
  amount?: number;
  deletedBy?: string;
  parentEntityName?: string;
  payload: any;
}): RecycleBinItem {
  return {
    id: createRecycleBinId(),
    itemType: params.itemType,
    originalId: params.originalId,
    title: params.title,
    subtitle: params.subtitle,
    amount: params.amount,
    deletedAt: new Date().toISOString(),
    deletedBy: params.deletedBy || 'Admin',
    parentEntityName: params.parentEntityName,
    payload: JSON.parse(JSON.stringify(params.payload))
  };
}

/**
 * Restores an item from the recycle bin back into the active application state
 */
export function restoreItemFromBin(binItem: RecycleBinItem, state: AppState): AppState {
  const currentBin = (state.recycleBin || []).filter(b => b.id !== binItem.id);
  const payload = binItem.payload;

  switch (binItem.itemType) {
    case 'transaction': {
      // Restore the sales transaction
      const txn = payload.transaction || payload;
      const alreadyExists = (state.transactions || []).some(t => t.id === txn.id);
      const updatedTxns = alreadyExists ? state.transactions : [txn, ...(state.transactions || [])];

      // Restore customer payment if present
      let updatedPayments = state.customerPayments || [];
      if (payload.customerPayment) {
        const pay = payload.customerPayment;
        if (!updatedPayments.some(p => p.id === pay.id || (p.txnId && p.txnId === txn.id))) {
          updatedPayments = [pay, ...updatedPayments];
        }
      }

      // Restore customer ledger entries if removed
      let updatedCustomerLedgers = state.customerLedgers || [];
      if (payload.customerLedgerEntries && txn.factory) {
        updatedCustomerLedgers = updatedCustomerLedgers.map(cl => {
          if (cl.name === txn.factory) {
            const existingIds = new Set((cl.entries || []).map(e => e.id));
            const toAdd = payload.customerLedgerEntries.filter((e: any) => !existingIds.has(e.id));
            return {
              ...cl,
              entries: [...(cl.entries || []), ...toAdd]
            };
          }
          return cl;
        });
      }

      return {
        ...state,
        recycleBin: currentBin,
        transactions: updatedTxns,
        customerPayments: updatedPayments,
        customerLedgers: updatedCustomerLedgers
      };
    }

    case 'product': {
      const prod = payload;
      const alreadyExists = (state.products || []).some(p => p.id === prod.id);
      return {
        ...state,
        recycleBin: currentBin,
        products: alreadyExists ? state.products : [...(state.products || []), prod],
        items: alreadyExists ? (state.items || []) : [...(state.items || []), prod]
      };
    }

    case 'factory': {
      const factory = payload.factory || payload;
      const alreadyExists = (state.factories || []).some(f => f.name === factory.name);
      let updatedCustomerLedgers = state.customerLedgers || [];
      if (payload.customerLedger && !updatedCustomerLedgers.some(cl => cl.name === factory.name)) {
        updatedCustomerLedgers = [...updatedCustomerLedgers, payload.customerLedger];
      }

      return {
        ...state,
        recycleBin: currentBin,
        factories: alreadyExists ? state.factories : [...(state.factories || []), factory],
        customerLedgers: updatedCustomerLedgers
      };
    }

    case 'factory_ledger_entry': {
      const entry = payload;
      const targetName = binItem.parentEntityName;
      if (!targetName) return { ...state, recycleBin: currentBin };

      return {
        ...state,
        recycleBin: currentBin,
        customerLedgers: (state.customerLedgers || []).map(cl => {
          if (cl.name === targetName && !(cl.entries || []).some(e => e.id === entry.id)) {
            return {
              ...cl,
              entries: [...(cl.entries || []), entry]
            };
          }
          return cl;
        })
      };
    }

    case 'custom_ledger': {
      const ledger = payload;
      const alreadyExists = (state.customLedgersList || []).some(cl => cl.id === ledger.id);
      return {
        ...state,
        recycleBin: currentBin,
        customLedgersList: alreadyExists ? state.customLedgersList : [...(state.customLedgersList || []), ledger]
      };
    }

    case 'custom_ledger_entry': {
      const entry = payload;
      const ledgerId = binItem.parentEntityName;
      return {
        ...state,
        recycleBin: currentBin,
        customLedgersList: (state.customLedgersList || []).map(cl => {
          if (cl.id === ledgerId && !(cl.entries || []).some(e => e.id === entry.id)) {
            return {
              ...cl,
              entries: [...(cl.entries || []), entry]
            };
          }
          return cl;
        })
      };
    }

    case 'painter': {
      const painter = payload;
      const alreadyExists = (state.painters || []).some(p => p.name === painter.name);
      return {
        ...state,
        recycleBin: currentBin,
        painters: alreadyExists ? state.painters : [...(state.painters || []), painter]
      };
    }

    case 'paint_entry': {
      const entry = payload;
      const painterName = binItem.parentEntityName;
      return {
        ...state,
        recycleBin: currentBin,
        painters: (state.painters || []).map(p => {
          if (p.name === painterName && !(p.entries || []).some(e => e.id === entry.id)) {
            return {
              ...p,
              entries: [...(p.entries || []), entry]
            };
          }
          return p;
        })
      };
    }

    case 'supplier': {
      const supplier = payload;
      const alreadyExists = (state.rawSuppliers || []).some(s => s.name === supplier.name);
      return {
        ...state,
        recycleBin: currentBin,
        rawSuppliers: alreadyExists ? state.rawSuppliers : [...(state.rawSuppliers || []), supplier]
      };
    }

    case 'raw_entry': {
      const entry = payload;
      const supplierName = binItem.parentEntityName;
      return {
        ...state,
        recycleBin: currentBin,
        rawSuppliers: (state.rawSuppliers || []).map(s => {
          if (s.name === supplierName && !(s.entries || []).some(e => e.id === entry.id)) {
            return {
              ...s,
              entries: [...(s.entries || []), entry]
            };
          }
          return s;
        })
      };
    }

    case 'worker': {
      const worker = payload;
      const alreadyExists = (state.workers || []).some(w => w.name === worker.name);
      return {
        ...state,
        recycleBin: currentBin,
        workers: alreadyExists ? state.workers : [...(state.workers || []), worker],
        labourWorkers: alreadyExists ? state.labourWorkers : [...(state.labourWorkers || []), worker]
      };
    }

    case 'labour_entry': {
      const entry = payload;
      const workerName = binItem.parentEntityName;
      return {
        ...state,
        recycleBin: currentBin,
        workers: (state.workers || []).map(w => {
          if (w.name === workerName && !(w.entries || []).some(e => e.id === entry.id)) {
            return {
              ...w,
              entries: [...(w.entries || []), entry]
            };
          }
          return w;
        }),
        labourWorkers: (state.labourWorkers || []).map(w => {
          if (w.name === workerName && !(w.entries || []).some(e => e.id === entry.id)) {
            return {
              ...w,
              entries: [...(w.entries || []), entry]
            };
          }
          return w;
        })
      };
    }

    case 'scrap_buyer': {
      const buyer = payload;
      const alreadyExists = (state.scrapBuyers || []).some(b => b.name === buyer.name);
      return {
        ...state,
        recycleBin: currentBin,
        scrapBuyers: alreadyExists ? state.scrapBuyers : [...(state.scrapBuyers || []), buyer]
      };
    }

    case 'scrap_entry': {
      const entry = payload;
      const buyerName = binItem.parentEntityName;
      return {
        ...state,
        recycleBin: currentBin,
        scrapBuyers: (state.scrapBuyers || []).map(b => {
          if (b.name === buyerName && !(b.entries || []).some(e => e.id === entry.id)) {
            return {
              ...b,
              entries: [...(b.entries || []), entry]
            };
          }
          return b;
        })
      };
    }

    case 'expense': {
      const expense = payload;
      const alreadyExists = (state.expenses || []).some(e => e.id === expense.id);
      return {
        ...state,
        recycleBin: currentBin,
        expenses: alreadyExists ? state.expenses : [expense, ...(state.expenses || [])]
      };
    }

    case 'withdrawal': {
      const withdrawal = payload;
      const alreadyExists = (state.withdrawals || []).some(w => w.id === withdrawal.id);
      return {
        ...state,
        recycleBin: currentBin,
        withdrawals: alreadyExists ? state.withdrawals : [withdrawal, ...(state.withdrawals || [])]
      };
    }

    case 'inquiry': {
      const inquiry = payload;
      const alreadyExists = (state.inquiries || []).some(i => i.id === inquiry.id);
      return {
        ...state,
        recycleBin: currentBin,
        inquiries: alreadyExists ? state.inquiries : [inquiry, ...(state.inquiries || [])]
      };
    }

    default:
      return {
        ...state,
        recycleBin: currentBin
      };
  }
}

/**
 * Permanently deletes a single item from the recycle bin
 */
export function purgeItemFromBin(binItemId: string, state: AppState): AppState {
  return {
    ...state,
    recycleBin: (state.recycleBin || []).filter(b => b.id !== binItemId)
  };
}

/**
 * Empties all items from the recycle bin
 */
export function emptyRecycleBin(state: AppState): AppState {
  return {
    ...state,
    recycleBin: []
  };
}
