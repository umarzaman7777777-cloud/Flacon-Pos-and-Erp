/**
 * Falcon Rod Maker POS - Batch ID & Tracking Number Generator
 *
 * Provides deterministic and segmented batch IDs and tracking numbers
 * for transaction orders and their individual line items.
 * Ensures that multi-item orders are clearly segmented by batch in the
 * transaction metadata.
 */

export interface BatchItemInput {
  name?: string;
  size?: string;
  color?: string;
  qty?: number;
  price?: number;
  batchId?: string;
  trackingNumber?: string;
}

export interface BatchTrackingMetadata {
  /** Master Order Batch ID (e.g. "BATCH-20261007-0005") */
  batchId: string;
  /** Master Order Tracking Number (e.g. "TRK-20261007-0005") */
  trackingNumber: string;
  /** Comma-separated list of batch IDs for all items (e.g. "BATCH-0005-01, BATCH-0005-02") */
  itemBatches: string;
  /** Comma-separated list of tracking numbers for all items (e.g. "TRK-0005-01, TRK-0005-02") */
  itemTrackingNumbers: string;
  /** Individual batch IDs array for 1:1 positional indexing */
  batchesList: string[];
  /** Individual tracking numbers array for 1:1 positional indexing */
  trackingList: string[];
}

/**
 * Generates an isolated line-item batch identifier.
 * Format: BATCH-{orderId}-{lineIndex} (e.g., "BATCH-0005-01")
 */
export function generateLineBatchId(orderId: string, lineIndex: number): string {
  const cleanId = String(orderId || '0001').padStart(4, '0');
  const cleanIndex = String(lineIndex + 1).padStart(2, '0');
  return `BATCH-${cleanId}-${cleanIndex}`;
}

/**
 * Generates an isolated line-item tracking number.
 * Format: TRK-{orderId}-{lineIndex} (e.g., "TRK-0005-01")
 */
export function generateLineTrackingNumber(orderId: string, lineIndex: number): string {
  const cleanId = String(orderId || '0001').padStart(4, '0');
  const cleanIndex = String(lineIndex + 1).padStart(2, '0');
  return `TRK-${cleanId}-${cleanIndex}`;
}

/**
 * Generates batch and tracking metadata for a complete transaction and its item list.
 * Multi-item orders are clearly segmented by batch in both array and delimited string formats.
 */
export function generateBatchTrackingMetadata(
  orderId: string,
  items: BatchItemInput[] = [],
  orderDate?: string
): BatchTrackingMetadata {
  const dateCompact = (orderDate || new Date().toISOString().slice(0, 10)).replace(/[^0-9]/g, '');
  const cleanId = String(orderId || '0001').padStart(4, '0');

  // Master Transaction Batch ID & Tracking Number
  const masterBatchId = `BATCH-${dateCompact}-${cleanId}`;
  const masterTrackingNumber = `TRK-${dateCompact}-${cleanId}`;

  // If no items provided, generate defaults
  if (!items || items.length === 0) {
    const singleBatch = generateLineBatchId(cleanId, 0);
    const singleTrack = generateLineTrackingNumber(cleanId, 0);
    return {
      batchId: masterBatchId,
      trackingNumber: masterTrackingNumber,
      itemBatches: singleBatch,
      itemTrackingNumbers: singleTrack,
      batchesList: [singleBatch],
      trackingList: [singleTrack]
    };
  }

  // Segment each item by batch in the items list
  const batchesList = items.map((item, index) => {
    if (item.batchId && typeof item.batchId === 'string' && item.batchId.trim()) {
      return item.batchId.trim();
    }
    return generateLineBatchId(cleanId, index);
  });

  const trackingList = items.map((item, index) => {
    if (item.trackingNumber && typeof item.trackingNumber === 'string' && item.trackingNumber.trim()) {
      return item.trackingNumber.trim();
    }
    return generateLineTrackingNumber(cleanId, index);
  });

  return {
    batchId: masterBatchId,
    trackingNumber: masterTrackingNumber,
    itemBatches: batchesList.join(', '),
    itemTrackingNumbers: trackingList.join(', '),
    batchesList,
    trackingList
  };
}
