import type { ReactNode } from 'react';

interface ChatShellProps {
  isSidebarOpen: boolean;
  onCloseSidebar: () => void;
  sidebar: ReactNode;
  conversation: ReactNode;
  overlays?: ReactNode;
}

const ChatShell = ({ isSidebarOpen, onCloseSidebar, sidebar, conversation, overlays }: ChatShellProps) => {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-50">
      <button
        type="button"
        aria-label="Close chat list"
        className={`chat-overlay ${isSidebarOpen ? 'show' : ''}`}
        onClick={onCloseSidebar}
      />
      {sidebar}
      <section className="flex min-w-0 flex-1 flex-col">
        {conversation}
      </section>
      {overlays}
    </div>
  );
};

export default ChatShell;
