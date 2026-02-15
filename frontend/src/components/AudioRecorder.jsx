import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Download,
  AlertCircle,
  Clock
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

// Format duration in mm:ss
const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function AudioRecorder({
  value,
  onChange,
  maxDuration = 300, // 5 minutes default
  required = false,
  label = 'Audio Recording'
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioURL, setAudioURL] = useState(value || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [error, setError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  // Audio level visualization
  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255 * 100);
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup audio analyzer for visualization
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        onChange({ blob: audioBlob, url, duration });
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(d => {
          if (d >= maxDuration) {
            stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);

      // Start visualization
      updateAudioLevel();

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError('Failed to start recording. Please try again.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setAudioLevel(0);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setDuration(d => d + 1);
        }, 1000);
        updateAudioLevel();
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        setAudioLevel(0);
      }
      setIsPaused(!isPaused);
    }
  };

  const deleteRecording = () => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    setAudioURL(null);
    setDuration(0);
    setPlaybackTime(0);
    onChange(null);
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Audio playback event handlers
  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      
      const handleTimeUpdate = () => setPlaybackTime(audio.currentTime);
      const handleEnded = () => {
        setIsPlaying(false);
        setPlaybackTime(0);
      };
      
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      
      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [audioURL]);

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            <span className="font-medium text-white">{label}</span>
            {required && <span className="text-red-500 text-xs">*</span>}
          </div>
          {audioURL && (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              Recorded
            </Badge>
          )}
        </div>

        {/* Recording UI */}
        {!audioURL && (
          <div className="space-y-4">
            {/* Record Button */}
            {!isRecording ? (
              <Button
                onClick={startRecording}
                className="w-full h-16"
                data-testid="start-recording-btn"
              >
                <Mic className="w-6 h-6 mr-2" />
                Start Recording
              </Button>
            ) : (
              <div className="space-y-4">
                {/* Recording Indicator */}
                <div className="flex items-center justify-center gap-4 p-4 bg-red-500/10 rounded-lg">
                  <motion.div
                    animate={{ scale: isPaused ? 1 : [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-4 h-4 rounded-full bg-red-500"
                  />
                  <span className="text-2xl font-mono text-white">{formatDuration(duration)}</span>
                  <span className="text-sm text-gray-400">/ {formatDuration(maxDuration)}</span>
                </div>

                {/* Audio Level Meter */}
                <div className="space-y-1">
                  <Progress value={audioLevel} className="h-2" />
                  <p className="text-xs text-gray-500 text-center">Audio Level</p>
                </div>

                {/* Recording Controls */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={pauseRecording}
                    className="flex-1"
                  >
                    {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={stopRecording}
                    className="flex-1"
                    data-testid="stop-recording-btn"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                </div>
              </div>
            )}

            {/* Duration Progress */}
            {isRecording && (
              <Progress value={(duration / maxDuration) * 100} className="h-1" />
            )}
          </div>
        )}

        {/* Playback UI */}
        {audioURL && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <audio ref={audioRef} src={audioURL} />

            {/* Playback Controls */}
            <div className="flex items-center gap-3 p-3 bg-card/50 rounded-lg">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlayback}
                data-testid="playback-btn"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </Button>

              <div className="flex-1">
                <Progress value={(playbackTime / duration) * 100} className="h-2" />
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                <span className="font-mono">
                  {formatDuration(playbackTime)} / {formatDuration(duration)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={startRecording}
                className="flex-1"
              >
                <Mic className="w-4 h-4 mr-2" />
                Re-record
              </Button>
              <Button
                variant="ghost"
                onClick={deleteRecording}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg text-red-500">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Hints */}
        {!audioURL && !isRecording && !error && (
          <p className="text-xs text-gray-500">
            Maximum duration: {formatDuration(maxDuration)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Simple display for recorded audio
export function AudioDisplay({ value, label }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  if (!value?.url) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Mic className="w-4 h-4" />
        <span className="text-sm">No recording</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <audio ref={audioRef} src={value.url} onEnded={() => setIsPlaying(false)} />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (isPlaying) {
            audioRef.current?.pause();
          } else {
            audioRef.current?.play();
          }
          setIsPlaying(!isPlaying);
        }}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
        <Mic className="w-3 h-3 mr-1" />
        {label || 'Audio'}
      </Badge>
      {value.duration && (
        <span className="text-xs text-gray-400 font-mono">
          {formatDuration(value.duration)}
        </span>
      )}
    </div>
  );
}
