import { useState, useRef, useCallback, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { AzureSpeechService, createAzureSpeechService } from './azure-speech';
import { VoiceChatSession, UIMessageWithCompleted } from '../index';
import { customModelProvider } from '../../models';

interface UseAzureVoiceChatProps {
  tools?: any[];
  systemPrompt?: string;
}

export function useAzureVoiceChat({
  tools = [],
  systemPrompt = "You are a helpful voice assistant.",
}: UseAzureVoiceChatProps = {}): VoiceChatSession {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const speechServiceRef = useRef<AzureSpeechService | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Get the Azure OpenAI model
  const model = customModelProvider.getModel({
    provider: 'azure',
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'o3-mini'
  });

  const {
    messages: chatMessages,
    append,
    setMessages,
    isLoading: isChatLoading,
  } = useChat({
    api: '/api/chat',
    body: {
      model: {
        provider: 'azure',
        model: process.env.AZURE_OPENAI_DEPLOYMENT || 'o3-mini'
      },
      tools,
      systemPrompt,
    },
    onFinish: async (message) => {
      // Convert response to speech using Azure TTS
      if (speechServiceRef.current && message.content) {
        setIsAssistantSpeaking(true);
        try {
          await speechServiceRef.current.synthesizeSpeech(message.content);
        } catch (error) {
          console.error('TTS Error:', error);
          setError(error as Error);
        } finally {
          setIsAssistantSpeaking(false);
        }
      }
    },
    onError: (error) => {
      setError(error);
      setIsLoading(false);
    },
  });

  // Convert chat messages to UI messages with completed status
  const messages: UIMessageWithCompleted[] = chatMessages.map(msg => ({
    ...msg,
    completed: !isChatLoading || msg.role !== 'assistant'
  }));

  const start = useCallback(async () => {
    try {
      setError(null);
      
      // Initialize Azure Speech Service
      speechServiceRef.current = createAzureSpeechService();
      if (!speechServiceRef.current) {
        throw new Error('Failed to initialize Azure Speech Services');
      }

      setIsActive(true);
      
      // Add initial system message if needed
      if (messages.length === 0) {
        setMessages([{
          id: 'system',
          role: 'system',
          content: systemPrompt,
        }]);
      }

    } catch (error) {
      console.error('Failed to start voice chat:', error);
      setError(error as Error);
    }
  }, [systemPrompt, messages.length, setMessages]);

  const stop = useCallback(async () => {
    try {
      // Stop any ongoing speech recognition
      if (speechServiceRef.current) {
        await speechServiceRef.current.stopContinuousRecognition();
        speechServiceRef.current.dispose();
        speechServiceRef.current = null;
      }

      // Stop any playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      setIsActive(false);
      setIsListening(false);
      setIsUserSpeaking(false);
      setIsAssistantSpeaking(false);
      setIsLoading(false);
      setError(null);
    } catch (error) {
      console.error('Error stopping voice chat:', error);
      setError(error as Error);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!speechServiceRef.current || isListening) return;

    try {
      setIsListening(true);
      setIsUserSpeaking(false);
      setError(null);

      await speechServiceRef.current.startContinuousRecognition(
        // onRecognized - when speech is fully recognized
        async (text: string) => {
          if (text.trim()) {
            setIsUserSpeaking(false);
            setIsLoading(true);
            
            // Send the recognized text to the chat
            await append({
              role: 'user',
              content: text.trim(),
            });
            
            setIsLoading(false);
          }
        },
        // onRecognizing - while speech is being recognized
        (text: string) => {
          if (text.trim()) {
            setIsUserSpeaking(true);
          }
        },
        // onError
        (error: string) => {
          console.error('Speech recognition error:', error);
          setError(new Error(error));
          setIsListening(false);
          setIsUserSpeaking(false);
        }
      );
    } catch (error) {
      console.error('Failed to start listening:', error);
      setError(error as Error);
      setIsListening(false);
    }
  }, [isListening, append]);

  const stopListening = useCallback(async () => {
    if (!speechServiceRef.current || !isListening) return;

    try {
      await speechServiceRef.current.stopContinuousRecognition();
      setIsListening(false);
      setIsUserSpeaking(false);
    } catch (error) {
      console.error('Failed to stop listening:', error);
      setError(error as Error);
    }
  }, [isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (speechServiceRef.current) {
        speechServiceRef.current.dispose();
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

  return {
    isActive,
    isListening,
    isUserSpeaking,
    isAssistantSpeaking,
    isLoading: isLoading || isChatLoading,
    messages,
    error,
    start,
    stop,
    startListening,
    stopListening,
  };
}