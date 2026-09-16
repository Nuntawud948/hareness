import { useEffect, useState } from 'react';

export interface SSEPushMessage {
  id: string;
  platform: 'line' | 'telegram';
  targetId: string;
  messageContent: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string | null;
  sourceTrigger: string;
  createdAt: string;
}

export function useSSE(endpoint = '/api/push/watch') {
  const [messages, setMessages] = useState<SSEPushMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(endpoint);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'push_message' && payload.data) {
          setMessages((prev) => [payload.data, ...prev]);
        }
      } catch (err) {
        console.error('Failed to parse SSE event data:', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [endpoint]);

  return { messages, isConnected, setMessages };
}
