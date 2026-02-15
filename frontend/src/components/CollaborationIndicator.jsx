import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  MessageCircle,
  Send,
  X,
  Circle
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { ScrollArea } from './ui/scroll-area';

const API_URL = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://');

// Generate random color for user avatar
const getUserColor = (userId) => {
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
};

// User avatar with presence indicator
const UserAvatar = ({ user, size = 'sm' }) => {
  const initials = user.user_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  const sizeClass = size === 'sm' ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm';
  
  return (
    <div className="relative">
      <Avatar className={sizeClass} style={{ backgroundColor: getUserColor(user.user_id) }}>
        <AvatarFallback className="text-white" style={{ backgroundColor: getUserColor(user.user_id) }}>
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-background" />
    </div>
  );
};

// Cursor overlay component
export function CollaborationCursors({ cursors, currentUserId }) {
  return (
    <>
      {Object.entries(cursors)
        .filter(([userId]) => userId !== currentUserId)
        .map(([userId, cursor]) => (
          <motion.div
            key={userId}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="fixed pointer-events-none z-50"
            style={{
              left: cursor.position?.x || 0,
              top: cursor.position?.y || 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5.65376 12.4563L3.0072 2.85954L13.5962 5.45951L8.84819 9.01849L5.65376 12.4563Z"
                fill={getUserColor(userId)}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <span
              className="absolute left-4 top-4 text-xs text-white px-1 rounded whitespace-nowrap"
              style={{ backgroundColor: getUserColor(userId) }}
            >
              {cursor.user_name}
            </span>
          </motion.div>
        ))}
    </>
  );
}

// Field lock indicator
export function FieldLockIndicator({ lockedBy, currentUserId }) {
  if (!lockedBy || lockedBy.user_id === currentUserId) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute -top-6 left-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
      style={{ backgroundColor: getUserColor(lockedBy.user_id) }}
    >
      <Circle className="w-2 h-2 fill-current" />
      <span className="text-white">{lockedBy.user_name} is editing</span>
    </motion.div>
  );
}

// Main collaboration indicator component
export function CollaborationIndicator({ 
  roomType, 
  roomId, 
  userId, 
  userName,
  onUsersChange,
  onCursorsChange
}) {
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    if (!API_URL || !roomType || !roomId) return;

    const wsUrl = `${API_URL}/api/collaboration/ws/${roomType}/${roomId}?user_id=${userId}&user_name=${encodeURIComponent(userName)}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('Collaboration connected');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
      };

      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  }, [roomType, roomId, userId, userName]);

  const handleMessage = (data) => {
    switch (data.type) {
      case 'room_state':
        setUsers(data.users || []);
        onUsersChange?.(data.users || []);
        onCursorsChange?.(data.cursors || {});
        break;
      
      case 'user_joined':
        setUsers(prev => [...prev, { user_id: data.user_id, user_name: data.user_name }]);
        break;
      
      case 'user_left':
        setUsers(prev => prev.filter(u => u.user_id !== data.user_id));
        break;
      
      case 'cursor_update':
        onCursorsChange?.(prev => ({ ...prev, [data.user_id]: data }));
        break;
      
      case 'chat_message':
        setMessages(prev => [...prev, data]);
        break;
      
      default:
        break;
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !wsRef.current) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'chat',
      message: newMessage.trim()
    }));
    setNewMessage('');
  };

  const sendCursorPosition = useCallback((position) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'cursor_move',
        position
      }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // Track mouse position
  useEffect(() => {
    const handleMouseMove = (e) => {
      sendCursorPosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [sendCursorPosition]);

  const otherUsers = users.filter(u => u.user_id !== userId);

  if (!connected && otherUsers.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 z-40" data-testid="collaboration-indicator">
      {/* User Avatars */}
      <AnimatePresence>
        {otherUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg border border-border"
          >
            <div className="flex -space-x-2">
              {otherUsers.slice(0, 3).map((user) => (
                <UserAvatar key={user.user_id} user={user} />
              ))}
            </div>
            {otherUsers.length > 0 && (
              <span className="text-xs text-gray-400">
                {otherUsers.length} {otherUsers.length === 1 ? 'person' : 'people'} viewing
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Button */}
      <Popover open={chatOpen} onOpenChange={setChatOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant={connected ? 'default' : 'outline'}
            className="rounded-full h-10 w-10 shadow-lg"
          >
            <MessageCircle className="w-5 h-5" />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">
                {messages.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex flex-col h-80">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">Team Chat</span>
              </div>
              <Badge variant={connected ? 'default' : 'secondary'} className="text-xs">
                {connected ? 'Connected' : 'Offline'}
              </Badge>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">
                    No messages yet. Start the conversation!
                  </p>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.user_id === userId ? 'flex-row-reverse' : ''}`}>
                      <UserAvatar user={{ user_id: msg.user_id, user_name: msg.user_name }} />
                      <div className={`flex-1 ${msg.user_id === userId ? 'text-right' : ''}`}>
                        <p className="text-xs text-gray-400">{msg.user_name}</p>
                        <p className="text-sm text-white bg-card/50 rounded-lg p-2 inline-block">
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className="text-sm"
                />
                <Button size="icon" onClick={sendMessage} disabled={!connected}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Hook for using collaboration in forms
export function useCollaboration(roomType, roomId, userId, userName) {
  const [users, setUsers] = useState([]);
  const [cursors, setCursors] = useState({});
  const [locks, setLocks] = useState({});
  const wsRef = useRef(null);

  const acquireLock = useCallback((fieldId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'field_focus',
        field_id: fieldId
      }));
    }
  }, []);

  const releaseLock = useCallback((fieldId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'field_blur',
        field_id: fieldId
      }));
    }
  }, []);

  const sendFieldChange = useCallback((fieldId, value) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'field_change',
        field_id: fieldId,
        value
      }));
    }
  }, []);

  return {
    users,
    cursors,
    locks,
    acquireLock,
    releaseLock,
    sendFieldChange
  };
}
