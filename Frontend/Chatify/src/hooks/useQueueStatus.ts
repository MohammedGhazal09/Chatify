import { useState, useEffect, useCallback } from 'react';
import { requestQueue, authQueue, backgroundQueue } from '../utils/requestQueue';

interface QueueStatus {
  queued: number;
  active: number;
  isPaused: boolean;
}

interface AllQueuesStatus {
  main: QueueStatus;
  auth: QueueStatus;
  background: QueueStatus;
  total: number;
  isActive: boolean;
}

/**
 * Hook to monitor request queue status
 * @param pollInterval - How often to check status (ms)
 */
export const useQueueStatus = (pollInterval = 500) => {
  const [status, setStatus] = useState<AllQueuesStatus>({
    main: { queued: 0, active: 0, isPaused: false },
    auth: { queued: 0, active: 0, isPaused: false },
    background: { queued: 0, active: 0, isPaused: false },
    total: 0,
    isActive: false,
  });

  const updateStatus = useCallback(() => {
    const main = requestQueue.getStatus();
    const auth = authQueue.getStatus();
    const background = backgroundQueue.getStatus();
    
    const total = main.queued + main.active + auth.queued + auth.active + background.queued + background.active;
    
    setStatus({
      main,
      auth,
      background,
      total,
      isActive: total > 0,
    });
  }, []);

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, pollInterval);
    return () => clearInterval(interval);
  }, [updateStatus, pollInterval]);

  return status;
};

export default useQueueStatus;
