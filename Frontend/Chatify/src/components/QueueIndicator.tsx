import { memo } from 'react';
import { useQueueStatus } from '../hooks/useQueueStatus';

/**
 * Visual indicator showing active network requests
 * Only appears when requests are in queue or processing
 */
const QueueIndicator = memo(() => {
  const status = useQueueStatus();

  // Don't show if queue is empty
  if (!status.isActive) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 shadow-lg z-50 flex items-center gap-2">
      {/* Spinner */}
      <div className="animate-spin h-3 w-3 border-2 border-emerald-500 border-t-transparent rounded-full" />
      
      {/* Status text */}
      <span>
        {status.main.active > 0 && (
          <span className="text-emerald-400">{status.main.active} active</span>
        )}
        {status.main.active > 0 && status.main.queued > 0 && ' • '}
        {status.main.queued > 0 && (
          <span className="text-slate-400">{status.main.queued} queued</span>
        )}
      </span>

      {/* Paused indicator */}
      {status.main.isPaused && (
        <span className="text-yellow-400 ml-1">⏸</span>
      )}
    </div>
  );
});

QueueIndicator.displayName = 'QueueIndicator';

export default QueueIndicator;
