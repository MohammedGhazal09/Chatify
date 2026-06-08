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
    <div className="flex h-screen bg-[#101113] text-[#F4F7F6]">
      <button
        type="button"
        aria-label="Close chat list"
        className={`chat-overlay ${isSidebarOpen ? 'show' : ''}`}
        onClick={onCloseSidebar}
      />
      {sidebar}
      <section className="flex min-w-0 flex-1 flex-col bg-[#101113]">
        {conversation}
      </section>
      {overlays}
    </div>
  );
};

export default ChatShell;
