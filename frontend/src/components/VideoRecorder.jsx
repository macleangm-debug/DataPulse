import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Video,
  Square,
  Play,
  Pause,
  Trash2,
  AlertCircle,
  Clock,
  FlipHorizontal,
  Maximize
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function VideoRecorder({
  value,
  onChange,
  maxDuration = 120, // 2 minutes default
  required = false,
  label = 'Video Recording'
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [videoURL, setVideoURL] = useState(value?.url || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' | 'environment'
  const [stream, setStream] = useState(null);

  const mediaRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const timerRef = useRef(null);
  const previewRef = useRef(null);
  const playbackRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording, stream]);

  const startPreview = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true
      });
      
      setStream(mediaStream);
      if (previewRef.current) {
        previewRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      handleError(err);
    }
  };

  const stopPreview = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      
      // Get fresh stream if not available
      let mediaStream = stream;
      if (!mediaStream) {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true
        });
        setStream(mediaStream);
        if (previewRef.current) {
          previewRef.current.srcObject = mediaStream;
        }
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(videoChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(videoBlob);
        setVideoURL(url);
        onChange({ blob: videoBlob, url, duration, mimeType });
        stopPreview();
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(d => {
          if (d >= maxDuration) {
            stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);

    } catch (err) {
      handleError(err);
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

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    if (stream && !isRecording) {
      stopPreview();
      setTimeout(async () => {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: newMode },
            audio: true
          });
          setStream(mediaStream);
          if (previewRef.current) {
            previewRef.current.srcObject = mediaStream;
          }
        } catch (err) {
          handleError(err);
        }
      }, 100);
    }
  };

  const deleteRecording = () => {
    if (videoURL) {
      URL.revokeObjectURL(videoURL);
    }
    setVideoURL(null);
    setDuration(0);
    onChange(null);
  };

  const togglePlayback = () => {
    if (playbackRef.current) {
      if (isPlaying) {
        playbackRef.current.pause();
      } else {
        playbackRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleError = (err) => {
    if (err.name === 'NotAllowedError') {
      setError('Camera access denied. Please allow camera access.');
    } else if (err.name === 'NotFoundError') {
      setError('No camera found. Please connect a camera.');
    } else if (err.name === 'NotReadableError') {
      setError('Camera is in use by another application.');
    } else {
      setError('Failed to access camera. Please try again.');
    }
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />
            <span className="font-medium text-white">{label}</span>
            {required && <span className="text-red-500 text-xs">*</span>}
          </div>
          {videoURL && (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              Recorded
            </Badge>
          )}
        </div>

        {/* Preview / Recording UI */}
        {!videoURL && (
          <div className="space-y-4">
            {/* Video Preview */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              {stream ? (
                <video
                  ref={previewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Video className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Camera preview</p>
                  </div>
                </div>
              )}

              {/* Recording Indicator */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-3 h-3 rounded-full bg-red-500"
                  />
                  <span className="text-white font-mono text-sm">{formatDuration(duration)}</span>
                </div>
              )}

              {/* Camera Switch */}
              {stream && !isRecording && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70"
                  onClick={switchCamera}
                >
                  <FlipHorizontal className="w-4 h-4 text-white" />
                </Button>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              {!stream ? (
                <Button onClick={startPreview} className="flex-1" data-testid="start-camera-btn">
                  <Video className="w-4 h-4 mr-2" />
                  Start Camera
                </Button>
              ) : !isRecording ? (
                <>
                  <Button onClick={startRecording} className="flex-1" data-testid="start-video-btn">
                    <Video className="w-4 h-4 mr-2" />
                    Start Recording
                  </Button>
                  <Button variant="ghost" onClick={stopPreview}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="destructive" onClick={stopRecording} className="flex-1" data-testid="stop-video-btn">
                  <Square className="w-4 h-4 mr-2" />
                  Stop Recording
                </Button>
              )}
            </div>

            {/* Duration Progress */}
            {isRecording && (
              <div className="space-y-1">
                <Progress value={(duration / maxDuration) * 100} className="h-1" />
                <p className="text-xs text-gray-500 text-center">
                  {formatDuration(duration)} / {formatDuration(maxDuration)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Playback UI */}
        {videoURL && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Video Player */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={playbackRef}
                src={videoURL}
                className="w-full h-full object-cover"
                onEnded={() => setIsPlaying(false)}
              />
              
              {/* Play Button Overlay */}
              {!isPlaying && (
                <div
                  className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/30"
                  onClick={togglePlayback}
                >
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-8 h-8 text-white" />
                  </div>
                </div>
              )}

              {/* Duration Badge */}
              <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm rounded px-2 py-1">
                <span className="text-white text-xs font-mono">{formatDuration(duration)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  deleteRecording();
                  startPreview();
                }}
                className="flex-1"
              >
                <Video className="w-4 h-4 mr-2" />
                Re-record
              </Button>
              <Button variant="ghost" onClick={deleteRecording}>
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
        {!videoURL && !stream && !error && (
          <p className="text-xs text-gray-500">
            Maximum duration: {formatDuration(maxDuration)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Simple display for recorded video
export function VideoDisplay({ value, label }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  if (!value?.url) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Video className="w-4 h-4" />
        <span className="text-sm">No video</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden max-w-xs">
        <video
          ref={videoRef}
          src={value.url}
          className="w-full h-full object-cover"
          onEnded={() => setIsPlaying(false)}
        />
        {!isPlaying && (
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/30"
            onClick={() => {
              videoRef.current?.play();
              setIsPlaying(true);
            }}
          >
            <Play className="w-8 h-8 text-white" />
          </div>
        )}
      </div>
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
        <Video className="w-3 h-3 mr-1" />
        {label || 'Video'}
      </Badge>
    </div>
  );
}
