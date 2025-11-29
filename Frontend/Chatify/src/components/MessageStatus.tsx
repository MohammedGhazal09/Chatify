import type { MessageStatus as MessageStatusType } from '../types/chat';

interface MessageStatusProps {
  status: MessageStatusType;
  isOwnMessage: boolean;
}

// Single check icon
const SingleCheck = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Double check icon
const DoubleCheck = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="18 6 7 17 2 12" />
    <polyline points="22 6 11 17" />
  </svg>
);

export const MessageStatus = ({ status, isOwnMessage }: MessageStatusProps) => {
  // Only show status on own messages
  if (!isOwnMessage) {
    return null;
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'sent':
        return <SingleCheck className="text-slate-400" />;
      case 'delivered':
        return <DoubleCheck className="text-slate-400" />;
      case 'read':
        return <DoubleCheck className="text-blue-500" />;
      default:
        return <SingleCheck className="text-slate-400" />;
    }
  };

  return (
    <span className="inline-flex items-center ml-1" title={status}>
      {getStatusIcon()}
    </span>
  );
};

export default MessageStatus;
