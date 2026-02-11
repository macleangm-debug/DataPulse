import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Mic, MicOff, Loader2, Volume2, X, Check } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Voice-to-Text Input Component
 * Allows users to speak answers instead of typing
 */
export function VoiceToTextInput({
  value = '',
  onChange,
  onTranscriptionComplete,
  label,
  placeholder = 'Click the microphone to start speaking...',
  language = 'en',
  disabled = false,
  maxDuration = 60, // seconds
  showWaveform = true
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcript, setTranscript] = useState(value);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);

  const getAuthHeaders = useCallback(() => {
    let token = localStorage.getItem('access_token');
    if (!token) {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          token = parsed?.state?.token || null;
        } catch (e) {}
      }
    }
    if (!token) token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio analyzer for waveform
      if (showWaveform) {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        
        // Start visualizing
        const visualize = () => {
          if (!analyserRef.current) return;
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(avg / 255);
          animationRef.current = requestAnimationFrame(visualize);
        };
        visualize();
      }
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        setAudioLevel(0);
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;
    
    setIsTranscribing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('language', language);
      
      const response = await fetch(`${API_URL}/api/ai/transcribe`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        setTranscript(result.text);
        onChange(result.text);
        if (onTranscriptionComplete) {
          onTranscriptionComplete(result);
        }
        toast.success('Transcription complete!');
      } else {
        throw new Error('Transcription failed');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Failed to transcribe audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3" data-testid="voice-to-text-input">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}
      
      <Card className="bg-card/50 border-border">
        <CardContent className="pt-4">
          {/* Recording Controls */}
          <div className="flex items-center justify-center gap-4">
            {!isRecording && !audioBlob && (
              <Button
                onClick={startRecording}
                disabled={disabled}
                size="lg"
                className="rounded-full w-16 h-16"
                variant="default"
              >
                <Mic className="h-6 w-6" />
              </Button>
            )}
            
            {isRecording && (
              <div className="flex items-center gap-4">
                {/* Waveform visualization */}
                {showWaveform && (
                  <div className="flex items-center gap-1 h-8">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-red-500 rounded-full transition-all duration-100"
                        style={{
                          height: `${Math.max(4, audioLevel * 32 * (0.5 + Math.random() * 0.5))}px`
                        }}
                      />
                    ))}
                  </div>
                )}
                
                <Badge variant="destructive" className="animate-pulse">
                  Recording {formatTime(recordingTime)}
                </Badge>
                
                <Button
                  onClick={stopRecording}
                  size="lg"
                  className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600"
                >
                  <MicOff className="h-6 w-6" />
                </Button>
              </div>
            )}
            
            {audioBlob && !isRecording && (
              <div className="flex items-center gap-3">
                <Badge variant="outline">
                  Recording: {formatTime(recordingTime)}
                </Badge>
                
                <Button
                  onClick={transcribeAudio}
                  disabled={isTranscribing}
                  className="gap-2"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Transcribe
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={clearRecording}
                  variant="outline"
                  size="icon"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          {/* Instructions */}
          {!isRecording && !audioBlob && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              {placeholder}
            </p>
          )}
          
          {/* Transcript Display */}
          {transcript && (
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Transcription</span>
              </div>
              <p className="text-sm">{transcript}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * AI Sentiment Display Component
 * Shows sentiment analysis results
 */
export function SentimentDisplay({ sentiment, emotions, keyPhrases, confidence }) {
  if (!sentiment) return null;
  
  const sentimentColors = {
    positive: 'bg-green-500/20 text-green-400 border-green-500/30',
    negative: 'bg-red-500/20 text-red-400 border-red-500/30',
    neutral: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    mixed: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
  };
  
  return (
    <div className="space-y-3 p-3 bg-card/50 rounded-lg border border-border" data-testid="sentiment-display">
      <div className="flex items-center justify-between">
        <Badge className={sentimentColors[sentiment]}>
          {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {Math.round(confidence * 100)}% confidence
        </span>
      </div>
      
      {emotions && Object.keys(emotions).length > 0 && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Emotions Detected</span>
          <div className="flex flex-wrap gap-1">
            {Object.entries(emotions)
              .filter(([_, score]) => score > 0.2)
              .sort((a, b) => b[1] - a[1])
              .map(([emotion, score]) => (
                <Badge key={emotion} variant="outline" className="text-xs">
                  {emotion}: {Math.round(score * 100)}%
                </Badge>
              ))}
          </div>
        </div>
      )}
      
      {keyPhrases && keyPhrases.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Key Phrases</span>
          <div className="flex flex-wrap gap-1">
            {keyPhrases.map((phrase, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {phrase}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AI Quality Score Badge
 * Shows data quality score with color coding
 */
export function QualityScoreBadge({ score, issueCount = 0, onClick }) {
  const getScoreColor = (s) => {
    if (s >= 90) return 'bg-green-500/20 text-green-400';
    if (s >= 70) return 'bg-yellow-500/20 text-yellow-400';
    if (s >= 50) return 'bg-orange-500/20 text-orange-400';
    return 'bg-red-500/20 text-red-400';
  };
  
  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-colors ${getScoreColor(score)} hover:opacity-80`}
      onClick={onClick}
      data-testid="quality-score-badge"
    >
      <span className="font-semibold">{score}%</span>
      {issueCount > 0 && (
        <span className="text-xs opacity-80">({issueCount} issues)</span>
      )}
    </div>
  );
}

export default VoiceToTextInput;
