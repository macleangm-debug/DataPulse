import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Camera,
  Mic,
  Video,
  FileText,
  X,
  Check,
  AlertCircle,
  Loader2,
  Image,
  Play,
  Pause,
  Trash2
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// File size limits
const FILE_LIMITS = {
  photo: 10 * 1024 * 1024,    // 10MB
  audio: 25 * 1024 * 1024,    // 25MB
  video: 50 * 1024 * 1024,    // 50MB
  document: 25 * 1024 * 1024  // 25MB
};

// Allowed MIME types
const ALLOWED_TYPES = {
  photo: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  document: ['application/pdf']
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getMediaTypeIcon = (type) => {
  switch (type) {
    case 'photo': return Image;
    case 'audio': return Mic;
    case 'video': return Video;
    case 'document': return FileText;
    default: return Upload;
  }
};

// Single file upload component
export function MediaUpload({ 
  mediaType = 'photo',
  onUpload,
  onRemove,
  value,
  disabled = false,
  showCapture = true,
  fieldId,
  submissionId
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const captureInputRef = useRef(null);

  const validateFile = (file) => {
    if (!ALLOWED_TYPES[mediaType]?.includes(file.type)) {
      setError(`Invalid file type. Allowed: ${ALLOWED_TYPES[mediaType].join(', ')}`);
      return false;
    }
    
    if (file.size > FILE_LIMITS[mediaType]) {
      const maxMB = FILE_LIMITS[mediaType] / (1024 * 1024);
      setError(`File too large. Maximum: ${maxMB}MB`);
      return false;
    }
    
    setError(null);
    return true;
  };

  const uploadFile = async (file) => {
    if (!validateFile(file)) return;

    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', mediaType);
    formData.append('user_id', localStorage.getItem('user_id') || 'anonymous');
    if (fieldId) formData.append('field_id', fieldId);
    if (submissionId) formData.append('submission_id', submissionId);

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      const response = await new Promise((resolve, reject) => {
        xhr.open('POST', `${API_URL}/api/media/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.responseText));
          }
        };
        
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(formData);
      });

      setProgress(100);
      toast.success('File uploaded successfully');
      
      if (onUpload) {
        onUpload({
          ...response,
          preview: URL.createObjectURL(file)
        });
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload failed. Please try again.');
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [mediaType]);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleRemove = () => {
    if (onRemove) onRemove();
    setError(null);
  };

  const Icon = getMediaTypeIcon(mediaType);
  const maxMB = FILE_LIMITS[mediaType] / (1024 * 1024);

  // If we have a value, show the preview
  if (value) {
    return (
      <Card className="relative">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {mediaType === 'photo' && value.preview ? (
              <img 
                src={value.preview || value.url} 
                alt="Preview" 
                className="w-20 h-20 object-cover rounded-lg"
              />
            ) : (
              <div className="w-20 h-20 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon className="w-8 h-8 text-primary" />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">
                {value.original_name || value.filename || 'Uploaded file'}
              </p>
              <p className="text-sm text-gray-400">
                {formatFileSize(value.size || 0)}
              </p>
              <Badge variant="outline" className="mt-2 bg-green-500/10 text-green-500 border-green-500/30">
                <Check className="w-3 h-3 mr-1" />
                Uploaded
              </Badge>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRemove}
              disabled={disabled}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${error ? 'border-red-500 bg-red-500/5' : 'border-border hover:border-primary/50 hover:bg-primary/5'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        {uploading ? (
          <div className="space-y-3">
            <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
            <Progress value={progress} className="w-full max-w-xs mx-auto" />
            <p className="text-sm text-gray-400">Uploading... {progress}%</p>
          </div>
        ) : (
          <>
            <Icon className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-300 mb-1">
              Drop {mediaType} here or click to browse
            </p>
            <p className="text-xs text-gray-500">
              Max size: {maxMB}MB
            </p>
          </>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES[mediaType]?.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* Capture button for mobile */}
      {showCapture && mediaType === 'photo' && (
        <>
          <input
            ref={captureInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => captureInputRef.current?.click()}
            disabled={disabled || uploading}
          >
            <Camera className="w-4 h-4 mr-2" />
            Take Photo
          </Button>
        </>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}

// Multi-file upload component
export function MultiMediaUpload({
  mediaType = 'photo',
  maxFiles = 10,
  onUpload,
  value = [],
  disabled = false,
  fieldId,
  submissionId
}) {
  const [files, setFiles] = useState(value);

  const handleUpload = (fileData) => {
    if (files.length >= maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }
    
    const newFiles = [...files, fileData];
    setFiles(newFiles);
    if (onUpload) onUpload(newFiles);
  };

  const handleRemove = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    if (onUpload) onUpload(newFiles);
  };

  return (
    <div className="space-y-4">
      {/* File list */}
      <AnimatePresence>
        {files.map((file, index) => (
          <motion.div
            key={file.id || index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            <MediaUpload
              mediaType={mediaType}
              value={file}
              onRemove={() => handleRemove(index)}
              disabled={disabled}
              showCapture={false}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add more button */}
      {files.length < maxFiles && (
        <MediaUpload
          mediaType={mediaType}
          onUpload={handleUpload}
          disabled={disabled}
          fieldId={fieldId}
          submissionId={submissionId}
        />
      )}

      {/* File count */}
      <p className="text-xs text-gray-400 text-center">
        {files.length} / {maxFiles} files
      </p>
    </div>
  );
}

// Audio recorder component
export function AudioRecorder({ onRecorded, maxDuration = 300 }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        if (onRecorded) {
          onRecorded({ blob, url, duration });
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => {
          if (d >= maxDuration) {
            stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);
    } catch (err) {
      toast.error('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-center gap-4">
          {isRecording ? (
            <Button variant="destructive" onClick={stopRecording}>
              <Pause className="w-4 h-4 mr-2" />
              Stop Recording
            </Button>
          ) : (
            <Button onClick={startRecording}>
              <Mic className="w-4 h-4 mr-2" />
              Start Recording
            </Button>
          )}
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center justify-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white font-mono">{formatDuration(duration)}</span>
            <span className="text-gray-400 text-sm">/ {formatDuration(maxDuration)}</span>
          </div>
        )}

        {/* Audio preview */}
        {audioUrl && !isRecording && (
          <audio controls className="w-full">
            <source src={audioUrl} type="audio/webm" />
          </audio>
        )}
      </CardContent>
    </Card>
  );
}

// Export limits for display
export const UPLOAD_LIMITS = FILE_LIMITS;
export const ACCEPTED_TYPES = ALLOWED_TYPES;
