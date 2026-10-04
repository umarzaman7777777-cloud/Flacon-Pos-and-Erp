import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  ShieldAlert,
  Truck,
  Trash2,
  FileCheck,
  Building,
  Calendar,
  Lock,
  Loader2,
  Eye,
  UserCheck,
  Hash,
  Layers
} from 'lucide-react';
import { Transaction, GatePassData, AppLanguage, RawEntry } from '../types';
import { fmt, todayISO } from '../utils/helpers';
import { formatGateSequence } from '../utils/gateSequenceManager';
import { hapticTransactionComplete, hapticWarning } from '../utils/haptics';

interface GatePassUploadModalProps {
  transaction?: Transaction | null;
  rawEntry?: {
    supplierName: string;
    entry: RawEntry;
  } | null;
  language: AppLanguage;
  companyName: string;
  nextGateSequence?: number;
  onClose: () => void;
  onConfirmUpload: (id: string, gatePass: GatePassData, rawSupplierName?: string) => void;
}

export const GatePassUploadModal: React.FC<GatePassUploadModalProps> = ({
  transaction,
  rawEntry,
  language,
  companyName,
  nextGateSequence = 1,
  onClose,
  onConfirmUpload
}) => {
  const isRaw = !transaction && !!rawEntry;
  const targetId = transaction?.id || rawEntry?.entry.id || 'GEN';
  const partyName = transaction ? (transaction.factory || 'Walk-in Customer') : (rawEntry?.supplierName || 'Supplier');
  const orderTitle = transaction ? `Order #${transaction.id}` : `Raw Inward #${rawEntry?.entry.id.slice(-6)}`;
  const orderSummary = transaction ? transaction.itemsSummary : `${rawEntry?.entry.desc || 'Raw material'} (${rawEntry?.entry.stockName || 'Material'})`;

  // Gate Sequence & Receiver
  const assignedSeq = nextGateSequence;
  const assignedSeqFormatted = formatGateSequence(assignedSeq);
  const [gatePassNo, setGatePassNo] = useState(
    transaction ? `GP-${transaction.id}` : `RAW-GP-${rawEntry?.entry.id.slice(-5) || '001'}`
  );
  const [receivedBy, setReceivedBy] = useState(
    transaction?.gateReceivedBy || rawEntry?.entry.receivedBy || 'Gate Officer: M. Tariq'
  );
  const [receiverRole, setReceiverRole] = useState('Gate Officer / Receiver');
  const [gatePost, setGatePost] = useState(isRaw ? 'Raw Material Inward Gate' : 'Main Dispatch Gate 1');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [notes, setNotes] = useState('');

  // File state
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<'pdf' | 'image' | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process selected file (PDF or JPG/PNG image)
  const handleFileProcess = (file: File) => {
    setErrorMessage(null);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage =
      file.type.startsWith('image/') ||
      file.name.toLowerCase().endsWith('.jpg') ||
      file.name.toLowerCase().endsWith('.jpeg') ||
      file.name.toLowerCase().endsWith('.png');

    if (!isPdf && !isImage) {
      setErrorMessage('Strict Policy: Only PDF (.pdf) or JPG/PNG image (.jpg, .jpeg, .png) files are permitted.');
      hapticWarning();
      return;
    }

    // Guard against huge files exceeding memory (> 8MB)
    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage('File size exceeds 8MB limit. Please provide a standard scanned receipt or document.');
      hapticWarning();
      return;
    }

    setIsProcessing(true);

    if (isImage) {
      // Compress and resize image using HTML5 Canvas to keep base64 lean and fast
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.82);
            setFileData(optimizedBase64);
            setFileName(file.name);
            setFileType('image');
            setFileSize(file.size);
            setIsProcessing(false);
          } else {
            // Fallback direct base64
            setFileData(e.target?.result as string);
            setFileName(file.name);
            setFileType('image');
            setFileSize(file.size);
            setIsProcessing(false);
          }
        };
        img.onerror = () => {
          setErrorMessage('Could not load image. Please verify file integrity.');
          setIsProcessing(false);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      // PDF File: read as Data URL
      const reader = new FileReader();
      reader.onload = e => {
        setFileData(e.target?.result as string);
        setFileName(file.name);
        setFileType('pdf');
        setFileSize(file.size);
        setIsProcessing(false);
      };
      reader.onerror = () => {
        setErrorMessage('Failed to read PDF file. Please try again.');
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleRemoveFile = () => {
    setFileData(null);
    setFileName('');
    setFileType(null);
    setFileSize(0);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // STRICT VALIDATION: Gate Pass MUST be uploaded
    if (!fileData || !fileType) {
      setErrorMessage('STRICT ENFORCEMENT: Uploading a physical Gate Pass (PDF or JPG) is mandatory before clearance.');
      hapticWarning();
      return;
    }

    // STRICT VALIDATION: Order must be received by someone
    if (!receivedBy.trim()) {
      setErrorMessage('STRICT REQUIREMENT: Specify who is receiving this order at the gate. Order must be recorded as receiving by someone.');
      hapticWarning();
      return;
    }

    const gatePass: GatePassData = {
      fileData,
      fileName: fileName || `GatePass_${targetId}`,
      fileType,
      fileSize,
      uploadedAt: `${todayISO()} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      gatePassNo: gatePassNo.trim() || `GP-${targetId}`,
      gateSequence: assignedSeq,
      gateSequenceNo: assignedSeqFormatted,
      receivedBy: receivedBy.trim(),
      receiverRole: receiverRole.trim() || 'Gate Officer / Receiver',
      gatePost: gatePost.trim() || 'Main Gate',
      vehicleNo: vehicleNo.trim() || undefined,
      driverName: driverName.trim() || undefined,
      notes: notes.trim() || undefined,
      verified: true,
      receiptType: isRaw ? 'raw_material_supplier' : 'factory_customer',
      partyName,
      orderRefId: targetId
    };

    hapticTransactionComplete();
    onConfirmUpload(targetId, gatePass, rawEntry?.supplierName);
    onClose();
  };

  return (
    <div
      id="gate-pass-upload-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto font-mono"
    >
      <div
        id="gate-pass-upload-modal-content"
        className="w-full max-w-xl bg-[var(--panel)] border border-[var(--steel-line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--steel-line)] flex items-center justify-between bg-[var(--panel-raised)]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isRaw
                ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                : 'bg-amber-500/15 border border-amber-500/30 text-[var(--yellow)]'
            }`}>
              {isRaw ? <Layers size={20} /> : <Truck size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif font-black text-base sm:text-lg text-[var(--text)] font-sans">
                  {isRaw ? 'Raw Material Supplier Gate Entry' : 'Gate Pass Dispatch & Clearance'}
                </h3>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[var(--yellow)] text-[10px] font-bold uppercase tracking-wider font-mono">
                  Seq #{assignedSeqFormatted}
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                {orderTitle} · <strong className="text-[var(--text)]">{partyName}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            id="gate-pass-close-btn"
            onClick={onClose}
            className="p-2 rounded-lg border border-[var(--steel-line)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          {/* Strict Gate Order Sequence & Receiving Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[var(--text)] space-y-2 font-sans">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wide">
                <ShieldAlert size={16} className="shrink-0" />
                <span>Gate Order Sequence Assignment</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-black font-black text-[11px] font-mono shadow-xs">
                {assignedSeqFormatted}
              </span>
            </div>
            <p className="text-xs text-[var(--text-dim)] leading-relaxed font-mono">
              Receipts received from <strong>factories/customers</strong> and <strong>raw materials/suppliers</strong> are logged in chronologically ordered gate sequence. Saving this updates the gate sequence and certifies that this order is actively <strong>received by someone at the gate</strong>.
            </p>
          </div>

          {/* Receiving Officer Certification Box */}
          <div className="p-3.5 rounded-xl bg-[var(--panel-raised)] border border-[var(--steel-line)] space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase">
              <UserCheck size={16} />
              <span>Receiving Verification (Gate Personnel)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
              <div>
                <label className="block text-[10px] uppercase text-[var(--text-dim)] font-bold mb-1">
                  Received By (Staff / Officer Name) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  id="gate-pass-received-by-input"
                  value={receivedBy}
                  onChange={e => setReceivedBy(e.target.value)}
                  placeholder="e.g. M. Tariq (Main Gate Guard) or Storekeeper"
                  className="w-full bg-[var(--panel)] border border-[var(--steel-line)] focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                />
                <span className="text-[9px] text-[var(--text-dim)] mt-0.5 block">Proof that order is actively received by someone</span>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[var(--text-dim)] font-bold mb-1">
                  Gate Post / Location
                </label>
                <input
                  type="text"
                  id="gate-pass-gate-post-input"
                  value={gatePost}
                  onChange={e => setGatePost(e.target.value)}
                  placeholder="e.g. Main Gate 1 / Workshop Inward Bay"
                  className="w-full bg-[var(--panel)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Upload Dropzone Section */}
          <div className="space-y-2">
            <label className="block text-[11px] uppercase text-[var(--text-dim)] font-bold font-mono">
              Official Physical Receipt / Challan File <span className="text-red-400">*</span>
              <span className="text-[10px] text-amber-400 font-normal ml-2">(PDF or JPG/PNG)</span>
            </label>

            {!fileData ? (
              <div
                id="gate-pass-dropzone"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--steel-line)] hover:border-amber-500/80 rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-[var(--panel-raised)]/50 hover:bg-[var(--panel-raised)] group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,image/jpeg,image/png,image/jpg"
                  className="hidden"
                />
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2 text-amber-400">
                    <Loader2 size={28} className="animate-spin" />
                    <span className="font-bold text-xs">Optimizing & Encoding File...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition shrink-0 mb-3">
                      <UploadCloud size={24} />
                    </div>
                    <div className="text-xs font-bold text-[var(--text)]">
                      Click to upload physical receipt or drag & drop here
                    </div>
                    <p className="text-[11px] text-[var(--text-dim)] mt-1">
                      Supports PDF document (.pdf) or clear camera photo (.jpg, .png) up to 8MB
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      fileType === 'pdf'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {fileType === 'pdf' ? <FileText size={18} /> : <ImageIcon size={18} />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text)] flex items-center gap-2">
                        <span>{fileName}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-400">
                          {fileType === 'pdf' ? 'PDF Scanned' : 'JPG Image'}
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)]">
                        {(fileSize / 1024).toFixed(1)} KB · Ready to save in gate sequence
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {fileType === 'image' && (
                      <button
                        type="button"
                        onClick={() => setShowImagePreview(prev => !prev)}
                        className="px-2 py-1 rounded bg-[var(--panel-raised)] border border-[var(--steel-line)] text-[10px] text-[var(--text-dim)] hover:text-[var(--text)] flex items-center gap-1"
                      >
                        <Eye size={11} />
                        <span>{showImagePreview ? 'Hide' : 'Preview'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition"
                      title="Remove file and choose another"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {showImagePreview && fileData && fileType === 'image' && (
                  <div className="p-2 bg-black/40 rounded-lg border border-[var(--steel-line)] flex justify-center">
                    <img
                      src={fileData}
                      alt="Gate Pass Preview"
                      className="max-h-44 object-contain rounded"
                    />
                  </div>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/30 p-2.5 rounded-lg">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Metadata Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[10px] uppercase text-[var(--text-dim)] font-bold mb-1">
                Gate Pass / Challan #
              </label>
              <input
                type="text"
                id="gate-pass-number-input"
                value={gatePassNo}
                onChange={e => setGatePassNo(e.target.value)}
                placeholder="e.g. GP-0004 or CH-8812"
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase text-[var(--text-dim)] font-bold mb-1">
                Vehicle / Transport #
              </label>
              <input
                type="text"
                id="gate-pass-vehicle-input"
                value={vehicleNo}
                onChange={e => setVehicleNo(e.target.value)}
                placeholder="e.g. Suzuki Carry / Goods Adda / LHR-7890"
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase text-[var(--text-dim)] font-bold mb-1">
                Driver / Transport Name
              </label>
              <input
                type="text"
                id="gate-pass-driver-input"
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                placeholder="e.g. Muhammad Aslam"
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase text-[var(--text-dim)] font-bold mb-1">
                Receiving Notes / Remarks
              </label>
              <input
                type="text"
                id="gate-pass-notes-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Inspected and received in good condition"
                className="w-full bg-[var(--panel-raised)] border border-[var(--steel-line)] focus:border-[var(--yellow)] rounded-lg px-3 py-2 text-xs text-[var(--text)] focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[var(--steel-line)] flex items-center justify-between gap-3 font-mono">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--steel-line)] text-xs text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--panel-raised)] transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              id="gate-pass-submit-confirm-btn"
              disabled={isProcessing || !fileData}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold uppercase text-xs transition shadow-lg ${
                isProcessing || !fileData
                  ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed opacity-60'
                  : 'bg-amber-500 hover:bg-amber-400 text-black border border-amber-400 cursor-pointer shadow-amber-500/20 active:scale-95'
              }`}
            >
              <Check size={15} strokeWidth={2.5} />
              <span>Save & Record in Gate Sequence</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

