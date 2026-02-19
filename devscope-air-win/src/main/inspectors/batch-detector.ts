/**
 * DevScope - Batch Tool Detector (LEGACY COMPATIBILITY)
 * 
 * This module now re-exports from the unified cross-platform batch scanner.
 * The old PowerShell-based approach has been replaced.
 */

export {
  unifiedBatchCheck as batchCheckTools,
  invalidateUnifiedBatchCache as invalidateBatchCache,
  toolExists as toolExistsInBatch,
  getVersion as getVersionFromBatch,
  type BatchToolResult,
  type BatchResults
} from './unified-batch-scanner'
