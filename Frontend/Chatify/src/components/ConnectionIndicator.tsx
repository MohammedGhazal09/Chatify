import { useEffect, useState } from 'react';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
}

const ConnectionIndicator = ({ status }: ConnectionIndicatorProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show indicator when not connected
    if (status !== 'connected') {
      setIsVisible(true);
    } else {
      // Hide after a brief moment when reconnected
      const timer = setTimeout(() => setIsVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (!isVisible) return null;

  const config = {
    connected: {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      message: 'Connected',
      icon: '✓',
    },
    connecting: {
      bg: 'bg-yellow-500/20',
      text: 'text-yellow-400',
      message: 'Reconnecting...',
      icon: '⟳',
    },
    disconnected: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      message: 'Disconnected',
      icon: '✕',
    },
  }[status];

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full ${config.bg} ${config.text} text-sm font-medium flex items-center gap-2 animate-fade-in`}>
      <span className={status === 'connecting' ? 'animate-spin' : ''}>{config.icon}</span>
      {config.message}
    </div>
  );
};

export default ConnectionIndicator;
