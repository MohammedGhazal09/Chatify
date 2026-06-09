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
    <div className="flex h-[100dvh] w-screen max-w-screen overflow-hidden bg-[#101113] text-[#F4F7F6]">
      <button
        type="button"
        aria-label="Close chat list"
        className={`chat-overlay ${isSidebarOpen ? 'show' : ''}`}
        onClick={onCloseSidebar}
      />
      {sidebar}
      <section className="flex min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-[#101113]">
        {conversation}
      </section>
      {overlays}
    </div>
  );
};

export default ChatShell;
