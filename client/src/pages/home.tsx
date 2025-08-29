import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { StepIndicator } from "@/components/step-indicator";
import { CameraInterface } from "@/components/camera-interface";
import { FrameCard } from "@/components/frame-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Glasses, Brain, CheckCircle, Lightbulb, Redo, Download, ShoppingCart, Calendar } from "lucide-react";
import type { Frame, AnalysisResult } from "@shared/schema";

interface AnalysisResponse {
  sessionId: string;
  analysis: AnalysisResult;
  recommendedFrames: FrameWithTryOn[];
  message?: string;
}

interface FrameWithTryOn extends Frame {
  virtualTryOn?: {
    imageBase64: string;
    description: string;
  } | null;
}

const steps = [
  { label: "Take Photo", description: "Capture your photo" },
  { label: "AI Analysis", description: "Analyze facial features" },
  { label: "Virtual Try-On", description: "See frames on you" },
];

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [recommendedFrames, setRecommendedFrames] = useState<FrameWithTryOn[]>([]);
  const { toast } = useToast();

  const analyzeFaceMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("sessionId", crypto.randomUUID());

      const response = await apiRequest("POST", "/api/analyze-face", formData);
      return response.json() as Promise<AnalysisResponse>;
    },
    onSuccess: (data) => {
      setAnalysisResult(data.analysis);
      setRecommendedFrames(data.recommendedFrames);
      setCurrentStep(3); // Skip to recommendations
      toast({
        title: "Analysis Complete",
        description: `Found ${data.recommendedFrames.length} perfect frames for your ${data.analysis.faceShape} face shape!`,
      });
    },
    onError: (error) => {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze your photo. Please try again with a clearer image.",
        variant: "destructive",
      });
      setCurrentStep(0);
    },
  });

  const handlePhotoCapture = useCallback((file: File) => {
    setCapturedPhoto(file);
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setCurrentStep(1); // Move to confirmation step
  }, []);

  const handleConfirmPhoto = useCallback(() => {
    if (!capturedPhoto) return;
    
    setCurrentStep(2); // Move to AI analysis step
    analyzeFaceMutation.mutate(capturedPhoto);
  }, [capturedPhoto, analyzeFaceMutation]);

  const handleRetakePhoto = useCallback(() => {
    setCapturedPhoto(null);
    setPhotoUrl("");
    setCurrentStep(0);
  }, []);


  const handleStartOver = useCallback(() => {
    setCapturedPhoto(null);
    setPhotoUrl("");
    setAnalysisResult(null);
    setRecommendedFrames([]);
    setCurrentStep(0);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Glasses className="text-primary-foreground text-lg" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Frame Finder</h1>
                <p className="text-sm text-muted-foreground">Perfect frames for your face</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} steps={steps} />

      <main className="container mx-auto px-4 py-8">
        {/* Step 1: Photo Capture */}
        {currentStep === 0 && (
          <div className="max-w-2xl mx-auto" data-testid="step-photo-capture">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-4">Let's Find Your Perfect Frames</h2>
              <p className="text-muted-foreground text-lg">Take a clear photo of your face for AI analysis</p>
            </div>

            <CameraInterface
              onPhotoCapture={handlePhotoCapture}
              isCapturing={analyzeFaceMutation.isPending}
            />

            {/* Tips */}
            <Card className="mt-6 bg-accent/10 border-accent/20">
              <CardContent className="p-4">
                <h3 className="font-semibold text-accent mb-2 flex items-center">
                  <Lightbulb className="mr-2 w-4 h-4" />
                  Photo Tips
                </h3>
                <ul className="text-sm text-accent-foreground space-y-1">
                  <li>• Face the camera directly with good lighting</li>
                  <li>• Remove any existing glasses</li>
                  <li>• Keep a neutral expression</li>
                  <li>• Make sure your entire face is visible</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 1.5: Photo Confirmation */}
        {currentStep === 1 && (
          <div className="max-w-2xl mx-auto" data-testid="step-photo-confirmation">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-4">Is this photo good?</h2>
              <p className="text-muted-foreground text-lg">Make sure your face is clearly visible and well-lit</p>
            </div>

            <Card className="overflow-hidden">
              <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt="Captured photo"
                    className="w-full h-full object-cover"
                    data-testid="img-captured-photo"
                  />
                )}
              </div>

              <div className="p-6 flex justify-center space-x-4">
                <Button
                  onClick={handleRetakePhoto}
                  variant="secondary"
                  data-testid="button-retake-photo"
                >
                  <Redo className="mr-2 w-4 h-4" />
                  Retake Photo
                </Button>
                <Button
                  onClick={handleConfirmPhoto}
                  disabled={!capturedPhoto}
                  data-testid="button-confirm-photo"
                >
                  <CheckCircle className="mr-2 w-4 h-4" />
                  Looks Good
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Step 2: AI Analysis Loading */}
        {currentStep === 2 && (
          <div className="max-w-2xl mx-auto" data-testid="step-ai-analysis">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-4">Analyzing Your Face Shape</h2>
              <p className="text-muted-foreground text-lg">Our AI is determining the best frame styles for you</p>
            </div>

            <Card className="p-8">
              <div className="text-center">
                {/* Loading Animation */}
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 border-4 border-muted rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-4 bg-primary/10 rounded-full flex items-center justify-center">
                    <Brain className="text-primary text-2xl" />
                  </div>
                </div>

                <h3 className="text-xl font-semibold mb-4">AI Analysis in Progress...</h3>

                {/* Progress Steps */}
                <div className="space-y-3 text-left max-w-md mx-auto">
                  <div className="flex items-center text-sm">
                    <div className="w-4 h-4 bg-primary rounded-full mr-3 flex items-center justify-center">
                      <CheckCircle className="text-primary-foreground text-xs w-3 h-3" />
                    </div>
                    <span className="text-muted-foreground">Detecting facial features</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <div className="w-4 h-4 bg-primary rounded-full mr-3 animate-pulse"></div>
                    <span className="text-foreground">Analyzing face shape</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <div className="w-4 h-4 bg-muted rounded-full mr-3"></div>
                    <span className="text-muted-foreground">Generating recommendations</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* AI Analysis Details */}
            <Card className="mt-6 bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <Brain className="text-primary text-sm w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-1">Powered by Google Gemini 2.5 Flash</h4>
                    <p className="text-sm text-muted-foreground">
                      Advanced AI analyzes your facial structure to recommend frames that enhance your natural features
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Virtual Try-On Results */}
        {currentStep === 3 && analysisResult && (
          <div data-testid="step-results">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-4">Your Virtual Try-On Results</h2>
              <p className="text-muted-foreground text-lg">
                Based on your <strong>{analysisResult.faceShape}</strong> face shape
              </p>
            </div>

            {/* AI Analysis Summary */}
            <Card className="p-6 mb-8">
              <div className="flex items-start">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mr-4">
                  <CheckCircle className="text-accent text-xl w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">AI Analysis Results</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Face Shape:</span>
                      <span className="ml-2 font-medium" data-testid="text-face-shape">
                        {analysisResult.faceShape}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Recommended Sizes:</span>
                      <span className="ml-2 font-medium" data-testid="text-recommended-sizes">
                        {analysisResult.recommendedSizes?.join(", ")}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Best Colors:</span>
                      <span className="ml-2 font-medium" data-testid="text-recommended-colors">
                        {analysisResult.recommendedColors?.join(", ")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Virtual Try-On Results - Show all frames with generated images */}
            {recommendedFrames.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {recommendedFrames.map((frame) => (
                  <Card key={frame.id} className="overflow-hidden">
                    {/* Virtual Try-On Image */}
                    <div className="aspect-[4/3] bg-muted flex items-center justify-center relative">
                      {frame.virtualTryOn?.imageBase64 ? (
                        <div className="w-full h-full">
                          <img
                            src={`data:image/jpeg;base64,${frame.virtualTryOn.imageBase64}`}
                            alt={`Virtual try-on with ${frame.name}`}
                            className="w-full h-full object-cover"
                          />
                          {/* AI Generated Badge */}
                          <div className="absolute top-2 left-2">
                            <div className="bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded-full">
                              AI Generated
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-4">
                          <p className="text-muted-foreground mb-2">Virtual try-on unavailable</p>
                          <img
                            src={frame.imageUrl}
                            alt={frame.name}
                            className="w-32 h-32 object-cover rounded-lg mx-auto opacity-60"
                          />
                        </div>
                      )}
                    </div>

                    {/* Frame Details */}
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-foreground">{frame.name}</h3>
                          <p className="text-muted-foreground">{frame.brand}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {frame.style} • {frame.color} • {frame.size}
                          </p>
                        </div>
                        <span className="text-2xl font-bold text-primary">${frame.price}</span>
                      </div>

                      {/* AI Analysis Description */}
                      {frame.virtualTryOn?.description && (
                        <div className="bg-accent/10 rounded-lg p-3 mb-4">
                          <div className="flex items-start">
                            <Brain className="text-accent mr-2 w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-accent mb-1">AI Stylist Analysis</p>
                              <p className="text-sm text-accent-foreground">
                                {frame.virtualTryOn.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Frame Description */}
                      {frame.description && (
                        <p className="text-sm text-muted-foreground mb-4">{frame.description}</p>
                      )}

                      {/* Stock Status */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          {frame.stockStatus === 'in_stock' && (
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          )}
                          {frame.stockStatus === 'low_stock' && (
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          )}
                          {frame.stockStatus === 'out_of_stock' && (
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          )}
                          <span className="text-sm capitalize text-muted-foreground">
                            {frame.stockStatus === 'in_stock' && 'In Stock'}
                            {frame.stockStatus === 'low_stock' && 'Low Stock'}
                            {frame.stockStatus === 'out_of_stock' && 'Out of Stock'}
                            {frame.stockStatus === 'order_only' && 'Order Only'}
                          </span>
                          {frame.stockCount && frame.stockCount > 0 && (
                            <span className="text-sm text-muted-foreground">({frame.stockCount} left)</span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2">
                        <Button className="w-full" disabled={frame.stockStatus === 'out_of_stock'}>
                          <ShoppingCart className="mr-2 w-4 h-4" />
                          Add to Cart - ${frame.price}
                        </Button>
                        
                        {frame.virtualTryOn?.imageBase64 && (
                          <Button variant="outline" className="w-full">
                            <Download className="mr-2 w-4 h-4" />
                            Save Try-On Photo
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  No frames found matching your criteria. Please try again or browse our full collection.
                </p>
                <Button onClick={handleStartOver} className="mt-4">
                  Try Again
                </Button>
              </Card>
            )}

            {/* Action Buttons */}
            {recommendedFrames.length > 0 && (
              <div className="mt-12 text-center space-x-4">
                <Button onClick={handleStartOver} variant="secondary">
                  <Redo className="mr-2 w-4 h-4" />
                  Try Different Photo
                </Button>
                <Button variant="outline">
                  <Calendar className="mr-2 w-4 h-4" />
                  Schedule In-Store Visit
                </Button>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">
            <p className="mb-2">Powered by AI • Secure & Private</p>
            <p className="text-sm">Your photos are processed securely and never stored permanently</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
