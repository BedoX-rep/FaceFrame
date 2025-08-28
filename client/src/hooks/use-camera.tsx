import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export interface UseCameraOptions {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
}

export function useCamera(options: UseCameraOptions = {}) {
  const {
    facingMode = "user",
    width = 1280,
    height = 960,
  } = options;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Get available camera devices
  const getDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === "videoinput");
      setDevices(videoDevices);
      
      if (videoDevices.length > 0 && !currentDeviceId) {
        setCurrentDeviceId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error("Failed to enumerate devices:", err);
      setError("Failed to access camera devices");
    }
  }, [currentDeviceId]);

  // Start camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId || currentDeviceId || undefined,
          facingMode: !deviceId ? facingMode : undefined,
          width: { ideal: width },
          height: { ideal: height },
        },
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setStream(mediaStream);
      setIsActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Update current device ID
      const videoTrack = mediaStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      if (settings.deviceId) {
        setCurrentDeviceId(settings.deviceId);
      }

      await getDevices();
    } catch (err) {
      console.error("Failed to start camera:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown camera error";
      setError(errorMessage);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions or upload a photo instead.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentDeviceId, facingMode, width, height, toast, getDevices]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsActive(false);
      setError(null);
    }
  }, [stream]);

  // Switch between cameras
  const switchCamera = useCallback(async () => {
    if (devices.length <= 1) return;

    const currentIndex = devices.findIndex(device => device.deviceId === currentDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];

    stopCamera();
    await startCamera(nextDevice.deviceId);
  }, [devices, currentDeviceId, stopCamera, startCamera]);

  // Capture photo from video stream
  const capturePhoto = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !canvasRef.current || !isActive) {
        resolve(null);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        resolve(null);
        return;
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to canvas
      context.drawImage(video, 0, 0);

      // Convert canvas to blob and create file
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `captured-photo-${Date.now()}.jpg`, { 
            type: 'image/jpeg' 
          });
          resolve(file);
        } else {
          resolve(null);
        }
      }, 'image/jpeg', 0.9);
    });
  }, [isActive]);

  // Check camera permissions
  const checkPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return permission.state === 'granted';
    } catch (err) {
      // Fallback: try to access camera directly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Initialize devices on mount
  useEffect(() => {
    getDevices();
  }, [getDevices]);

  return {
    // State
    stream,
    isActive,
    isLoading,
    error,
    devices,
    currentDeviceId,
    
    // Refs
    videoRef,
    canvasRef,
    
    // Actions
    startCamera,
    stopCamera,
    switchCamera,
    capturePhoto,
    checkPermissions,
    
    // Utils
    hasMultipleCameras: devices.length > 1,
    supportsCamera: !!navigator.mediaDevices?.getUserMedia,
  };
}
