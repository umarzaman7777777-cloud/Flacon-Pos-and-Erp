import React, { useState } from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  Truck,
  Layers,
  UserCheck,
  Calendar,
  Search,
  Filter,
  Download,
  Eye,
  ShieldCheck,
  Building,
  ArrowUpDown,
  ExternalLink,
  Lock,
  Plus
} from 'lucide-react';
import { Transaction, RawSupplier, AppLanguage } from '../types';
import { fmt, downloadCSV, exportTablePDF } from '../utils/helpers';
import {
  UnifiedGateReceipt,
  getAllGateReceipts,
  getNextGateSequence,
  formatGateSequence
} from '../utils/gateSequenceManager';
import { GatePassViewerModal } from './GatePassViewerModal';

interface UnifiedGateReceiptsModalProps {
  transactions: Transaction[];
  rawSuppliers: RawSupplier[];
  language: AppLanguage;
  companyName: string;
  onClose: () => void;
  onOpenGatePassUploadForTxn?: (txn: Transaction) => void;
}

export const UnifiedGateReceiptsModal: React.FC<UnifiedGateReceiptsModalProps> = ({
  transactions,
  rawSuppliers,
  language,
  companyName,
  onClose,
  onOpenGatePassUploadForTxn
}) => {
  const [filterType, setFilterType] = useState<'all' | 'factory_customer' | 'raw_material_supplier'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<UnifiedGateReceipt | null>(null);

  // Retrieve unified list sorted by gate sequence
  const allReceipts = getAllGateReceipts(transactions, rawSuppliers);
  const nextSeq = getNextGateSequence(transactions, rawSuppliers);

  const filteredReceipts = allReceipts.filter(r => {
    if (filterType !== 'all' && r.sourceType !== filterType) {
      return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        r.gateSequenceNo.toLowerCase().includes(q) ||
        r.partyName.toLowerCase().includes(q) ||
        r.receivedBy.toLowerCase().includes(q) ||
        r.orderRef.toLowerCase().includes(q) ||
        (r.gatePassNo && r.gatePassNo.toLowerCase().includes(q)) ||
        r.summary.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const factoryCount = allReceipts.filter(r => r.sourceType === 'factory_customer').length;
  const rawCount = allReceipts.filter(r => r.sourceType === 'raw_material_supplier').length;

  const handleExportCSV = () => {
    const headers = [
      'Gate Sequence #',
      'Source Type',
      'Order Ref',
      'Party / Supplier / Customer',
      'Date & Time',
      'Received By Staff',
      'Gate Post',
      'Gate Pass #',
      'Vehicle',
      'File Type'
    ];
    const rows = filteredReceipts.map(r => [
      r.gateSequenceNo,
      r.sourceType === 'factory_customer' ? 'Factory / Customer' : 'Raw Material Supplier',
      r.orderRef,
      r.partyName,
      `${r.date} ${r.time}`,
      r.receivedBy,
      r.gatePost || 'Main Gate',
      r.gatePassNo || '—',
      r.vehicleNo || 'Self',
      r.fileType.toUpperCase()
    ]);
    downloadCSV('Unified_Gate_Receipts_Sequence', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['Seq #', 'Type', 'Party', 'Received By', 'Gate Post', 'Date', 'Pass #'];
    const rows = filteredReceipts.map(r => [
      r.gateSequenceNo,
      r.sourceType === 'factory_customer' ? 'Customer' : 'Raw Material',
      r.partyName,
      r.receivedBy,
      r.gatePost || 'Gate',
      r.date,
      r.gatePassNo || '—'
    ]);
    exportTablePDF(
      'Unified Gate Receipts & Sequence Ledger',
      headers,
      rows,
      'Gate_Receipts_Ledger',
      'landscape',
      companyName,
      'Order Sequence & Gate Receiving Registry',
      `Total Logged: ${allReceipts.length} | Next Sequence: ${formatGateSequence(nextSeq)}`
    );
  };

  return (
    <div
      id="unified-gate-receipts-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-6 overflow-hidden font-mono"
    >
      <div
        id="unified-gate-receipts-modal-content"
        className="w-full max-w-5xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--steel-line)] flex items-center justify-between bg-[var(--panel-raised)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif font-black text-base sm:text-lg text-[var(--text)] font-sans">
                  Gate Order Sequence & Receipts Registry
                </h3>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold font-mono uppercase">
                  Next: {formatGateSequence(nextSeq)}
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                Saved in chronological gate sequence · Confirms who is receiving every order at the gate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-[var(--text)] bg-[var(--panel)] transition"
              title="Export CSV"
            >
              <Download size={13} />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-[var(--text)] bg-[var(--panel)] transition"
              title="Export PDF"
            >
              <FileText size={13} />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              type="button"
              id="unified-receipts-close-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] transition bg-[var(--panel)]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter & Metric Summary Strip */}
        <div className="px-4 py-3 bg-[var(--panel-raised)]/60 border-b border-[var(--steel-line)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Source Tabs */}
          <div className="flex items-center gap-1 bg-[var(--panel)] p-1 rounded-xl border border-[var(--steel-line)] text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                filterType === 'all'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              <span>All Receipts</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                {allReceipts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('factory_customer')}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                filterType === 'factory_customer'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              <Truck size={13} />
              <span>Factories / Customers</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                {factoryCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('raw_material_supplier')}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                filterType === 'raw_material_supplier'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              <Layers size={13} />
              <span>Raw Suppliers</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                {rawCount}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search sequence, party, receiver..."
              className="w-full bg-[var(--panel)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[var(--text)] focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Receipts List / Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredReceipts.length === 0 ? (
            <div className="p-12 text-center text-[var(--text-dim)] space-y-2 font-mono">
              <ShieldCheck size={36} className="mx-auto text-amber-400 opacity-60 mb-2" />
              <div className="text-sm font-bold text-[var(--text)]">No gate receipts recorded matching filter</div>
              <p className="text-xs max-w-md mx-auto">
                When gate passes or receipts are uploaded for sales dispatch or raw materials inwards, they are saved in sequence with the receiving personnel&apos;s name.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--steel-line)] text-[10px] uppercase text-[var(--text-dim)] font-bold">
                    <th className="py-2.5 px-3">Gate Sequence #</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Order / Reference</th>
                    <th className="py-2.5 px-3">Customer / Supplier</th>
                    <th className="py-2.5 px-3">Received By (Gate Staff)</th>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Gate Pass File</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--steel-line)]/50">
                  {filteredReceipts.map(r => (
                    <tr
                      key={`${r.sourceType}-${r.id}`}
                      className="hover:bg-[var(--panel-raised)]/70 transition group"
                    >
                      {/* Gate Sequence # */}
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-amber-400 text-xs px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                          {r.gateSequenceNo}
                        </span>
                      </td>

                      {/* Source Type */}
                      <td className="py-3 px-3">
                        {r.sourceType === 'factory_customer' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <Truck size={10} />
                            <span>Customer</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                            <Layers size={10} />
                            <span>Raw Supplier</span>
                          </span>
                        )}
                      </td>

                      {/* Order Ref */}
                      <td className="py-3 px-3 font-semibold text-[var(--text)]">
                        <div>{r.orderRef}</div>
                        <div className="text-[10px] text-[var(--text-dim)] truncate max-w-xs">{r.summary}</div>
                      </td>

                      {/* Party */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-[var(--text)]">{r.partyName}</div>
                        {r.totalAmount ? (
                          <div className="text-[10px] text-[var(--yellow)] font-bold">{fmt(r.totalAmount)}</div>
                        ) : null}
                      </td>

                      {/* Received By */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                          <UserCheck size={13} className="shrink-0" />
                          <span>{r.receivedBy}</span>
                        </div>
                        <div className="text-[10px] text-[var(--text-dim)]">{r.gatePost || 'Main Gate'}</div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-[var(--text-dim)] text-[11px]">
                        <div>{r.date}</div>
                        <div className="text-[10px]">{r.time}</div>
                      </td>

                      {/* Pass file format */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          {r.fileType === 'pdf' ? (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-bold uppercase flex items-center gap-1">
                              <FileText size={11} /> PDF
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase flex items-center gap-1">
                              <ImageIcon size={11} /> JPG
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--text-dim)] truncate max-w-[100px]">
                            {r.gatePassNo || 'GP'}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(r)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--panel)] hover:bg-[var(--panel-raised)] border border-[var(--steel-line)] hover:border-[var(--yellow)] text-xs text-[var(--text)] transition flex items-center gap-1 ml-auto"
                        >
                          <Eye size={12} />
                          <span>View Pass</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-3 border-t border-[var(--steel-line)] bg-[var(--panel-raised)] flex items-center justify-between text-xs text-[var(--text-dim)] shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Strict Gate Compliance: All orders logged by sequential gate receiving staff</span>
          </div>

          <span className="font-mono text-[11px] text-[var(--text)]">
            Showing {filteredReceipts.length} of {allReceipts.length} receipts
          </span>
        </div>
      </div>

      {/* Embedded Single Receipt Viewer Modal */}
      {selectedReceipt && (
        <GatePassViewerModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
};
