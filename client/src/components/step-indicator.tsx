import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: number;
  steps: { label: string; description: string }[];
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="bg-card border-b border-border">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center">
          <div className="flex items-center space-x-4">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className="flex items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                      index < currentStep
                        ? "bg-accent text-accent-foreground"
                        : index === currentStep
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                    data-testid={`step-indicator-${index + 1}`}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={cn(
                      "ml-2 text-sm font-medium",
                      index <= currentStep ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className="w-8 h-0.5 bg-border ml-4"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
