'use client';

// Client-side exports for React components
export { useAzureVoiceChat as useVoiceChat } from './azure/use-voice-chat.azure';
export { AzureSpeechService, createAzureSpeechService } from './azure/azure-speech';

// Re-export types and interfaces
export type {
  VoiceChatSession,
  VoiceChatHook,
  UIMessageWithCompleted,
} from './index';