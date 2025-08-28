import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, RotateCcw, User } from "lucide-react";

interface CameraInterfaceProps {
  onPhotoCapture: (file: File) => void;
  isCapturing?: boolean;
}

export function CameraInterface({ onPhotoCapture, isCapturing = false }: CameraInterfaceProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const startCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });
      
      setStream(mediaStream);
      setIsCameraActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Failed to start camera:", error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions or upload a photo instead.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' });
        onPhotoCapture(file);
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  }, [onPhotoCapture, stopCamera]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      onPhotoCapture(file);
    }
  }, [onPhotoCapture, toast]);

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
        {/* Camera stream or placeholder */}
        {isCameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            data-testid="camera-video"
          />
        ) : (
          <div className="text-muted-foreground text-center" data-testid="camera-placeholder">
            <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Camera will appear here</p>
            {!isCameraActive && (
              <Button
                onClick={startCamera}
                disabled={isLoading}
                className="mt-4"
                data-testid="button-start-camera"
              >
                {isLoading ? "Starting Camera..." : "Start Camera"}
              </Button>
            )}
          </div>
        )}

        {/* Face guide overlay */}
        {isCameraActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-80 border-2 border-accent border-dashed rounded-full opacity-60">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-accent text-center">
                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">Position your face here</p>
              </div>
            </div>
          </div>
        )}

        {/* Camera controls */}
        {isCameraActive && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <Button
              onClick={capturePhoto}
              disabled={isCapturing}
              size="lg"
              className="w-16 h-16 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground relative overflow-hidden"
              data-testid="button-capture-photo"
            >
              <div className="w-12 h-12 bg-white rounded-full relative">
                <div className="absolute inset-2 bg-accent rounded-full animate-pulse"></div>
              </div>
            </Button>
          </div>
        )}

        {/* Switch camera button */}
        {isCameraActive && (
          <Button
            onClick={stopCamera}
            variant="secondary"
            size="sm"
            className="absolute top-4 right-4 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 text-white"
            data-testid="button-stop-camera"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Upload alternative */}
      <div className="p-6 border-t border-border">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Or upload a photo from your device</p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="secondary"
            disabled={isCapturing}
            data-testid="button-upload-file"
          >
            <Upload className="w-4 h-4 mr-2" />
            Choose File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            data-testid="input-file-upload"
          />
        </div>
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
    </Card>
  );
}
