import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

export interface AzureSpeechConfig {
  subscriptionKey: string;
  region: string;
  language?: string;
  voiceName?: string;
}

export class AzureSpeechService {
  private speechConfig: SpeechSDK.SpeechConfig;
  private audioConfig: SpeechSDK.AudioConfig;
  private recognizer: SpeechSDK.SpeechRecognizer | null = null;
  private synthesizer: SpeechSDK.SpeechSynthesizer | null = null;

  constructor(config: AzureSpeechConfig) {
    this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      config.subscriptionKey,
      config.region
    );

    // Set language and voice
    this.speechConfig.speechRecognitionLanguage = config.language || 'en-US';
    this.speechConfig.speechSynthesisVoiceName = config.voiceName || 'en-US-AriaNeural';

    // Configure audio
    this.audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  }

  // Speech-to-Text
  async startContinuousRecognition(
    onRecognized: (text: string) => void,
    onRecognizing?: (text: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    if (this.recognizer) {
      await this.stopContinuousRecognition();
    }

    this.recognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, this.audioConfig);

    this.recognizer.recognized = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        onRecognized(e.result.text);
      }
    };

    if (onRecognizing) {
      this.recognizer.recognizing = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
          onRecognizing(e.result.text);
        }
      };
    }

    this.recognizer.canceled = (s, e) => {
      if (onError) {
        onError(`Recognition canceled: ${e.errorDetails}`);
      }
    };

    this.recognizer.sessionStopped = (s, e) => {
      console.log('Recognition session stopped');
    };

    this.recognizer.startContinuousRecognitionAsync();
  }

  async stopContinuousRecognition(): Promise<void> {
    if (this.recognizer) {
      await new Promise<void>((resolve) => {
        this.recognizer!.stopContinuousRecognitionAsync(
          () => {
            this.recognizer!.close();
            this.recognizer = null;
            resolve();
          },
          (error) => {
            console.error('Error stopping recognition:', error);
            this.recognizer!.close();
            this.recognizer = null;
            resolve();
          }
        );
      });
    }
  }

  // Text-to-Speech
  async synthesizeSpeech(
    text: string,
    onAudioData?: (audioData: ArrayBuffer) => void
  ): Promise<void> {
    if (!this.synthesizer) {
      const audioConfig = SpeechSDK.AudioConfig.fromSpeakerOutput();
      this.synthesizer = new SpeechSDK.SpeechSynthesizer(this.speechConfig, audioConfig);
    }

    return new Promise((resolve, reject) => {
      this.synthesizer!.speakTextAsync(
        text,
        (result) => {
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            if (onAudioData) {
              onAudioData(result.audioData);
            }
            resolve();
          } else {
            reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
          }
        },
        (error) => {
          reject(new Error(`Speech synthesis error: ${error}`));
        }
      );
    });
  }

  // Single recognition for commands
  async recognizeOnce(): Promise<string> {
    const recognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, this.audioConfig);

    return new Promise((resolve, reject) => {
      recognizer.recognizeOnceAsync(
        (result) => {
          recognizer.close();
          if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            resolve(result.text);
          } else {
            reject(new Error(`Recognition failed: ${result.errorDetails}`));
          }
        },
        (error) => {
          recognizer.close();
          reject(new Error(`Recognition error: ${error}`));
        }
      );
    });
  }

  dispose(): void {
    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = null;
    }
    if (this.synthesizer) {
      this.synthesizer.close();
      this.synthesizer = null;
    }
  }
}

// Factory function to create Azure Speech Service
export function createAzureSpeechService(): AzureSpeechService | null {
  const subscriptionKey = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;

  if (!subscriptionKey || !region) {
    console.warn('Azure Speech Services not configured');
    return null;
  }

  return new AzureSpeechService({
    subscriptionKey,
    region,
    language: 'en-US',
    voiceName: 'en-US-AriaNeural'
  });
}