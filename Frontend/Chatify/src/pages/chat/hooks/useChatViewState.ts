import { useState } from 'react';
import type { Message } from '../../../types/chat';

export interface MessageContextMenuState {
  x: number;
  y: number;
  messageId: string;
  isOwn: boolean;
}

export const useChatViewState = () => {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatUsername, setNewChatUsername] = useState('');
  const [createChatError, setCreateChatError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<MessageContextMenuState | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [messageSearch, setMessageSearch] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  return {
    selectedChatId,
    setSelectedChatId,
    messageInput,
    setMessageInput,
    isNewChatOpen,
    setIsNewChatOpen,
    newChatUsername,
    setNewChatUsername,
    createChatError,
    setCreateChatError,
    isSidebarOpen,
    setIsSidebarOpen,
    isTyping,
    setIsTyping,
    searchQuery,
    setSearchQuery,
    isSettingsOpen,
    setIsSettingsOpen,
    contextMenu,
    setContextMenu,
    showReactionPicker,
    setShowReactionPicker,
    editingMessageId,
    setEditingMessageId,
    editText,
    setEditText,
    showEmojiPicker,
    setShowEmojiPicker,
    replyingTo,
    setReplyingTo,
    messageSearch,
    setMessageSearch,
    showMessageSearch,
    setShowMessageSearch,
    showScrollButton,
    setShowScrollButton,
  };
};
