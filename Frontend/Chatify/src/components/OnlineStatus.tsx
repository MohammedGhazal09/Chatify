interface OnlineStatusProps {
  isOnline: boolean;
  lastSeen?: string;
  showDot?: boolean;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Format lastSeen into a human-readable string
const formatLastSeen = (lastSeen: string): string => {
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // If less than a minute ago
  if (diffMins < 1) {
    return 'Last seen just now';
  }

  // If less than an hour ago
  if (diffMins < 60) {
    return `Last seen ${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  }

  // If today
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return `Last seen today at ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  // If yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `Last seen yesterday at ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  // If within the last week
  if (diffDays < 7) {
    const dayName = date.toLocaleDateString([], { weekday: 'long' });
    return `Last seen ${dayName} at ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  // Otherwise, show full date
  return `Last seen ${date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })}`;
};

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

export const OnlineStatus = ({
  isOnline,
  lastSeen,
  showDot = true,
  showText = false,
  size = 'md',
}: OnlineStatusProps) => {
  if (showDot && !showText) {
    return (
      <span
        className={`inline-block ${sizeClasses[size]} rounded-full border-2 border-slate-900 ${
          isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-500'
        }`}
        title={isOnline ? 'Online' : lastSeen ? formatLastSeen(lastSeen) : 'Offline'}
      />
    );
  }

  if (showText) {
    return (
      <span className="text-xs text-slate-400">
        {isOnline ? (
          <span className="flex items-center gap-1">
            {showDot && (
              <span className={`inline-block ${sizeClasses[size]} rounded-full bg-green-500`} />
            )}
            Online
          </span>
        ) : lastSeen ? (
          formatLastSeen(lastSeen)
        ) : (
          'Offline'
        )}
      </span>
    );
  }

  return null;
};

// Dot indicator component for avatar overlay
export const OnlineDot = ({ isOnline, size = 'md' }: { isOnline: boolean; size?: 'sm' | 'md' | 'lg' }) => {
  if (!isOnline) return null;

  return (
    <span
      className={`absolute bottom-0 right-0 ${sizeClasses[size]} rounded-full bg-green-500 border-2 border-slate-900`}
      style={{ animation: 'pulse 2s infinite' }}
    />
  );
};

export default OnlineStatus;
