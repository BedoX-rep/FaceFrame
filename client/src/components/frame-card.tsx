import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Frame } from "@shared/schema";

interface FrameCardProps {
  frame: Frame;
  onTryOn?: (frame: Frame) => void;
  onViewDetails?: (frame: Frame) => void;
  isSelected?: boolean;
}

export function FrameCard({ frame, onTryOn, onViewDetails, isSelected = false }: FrameCardProps) {
  const getStockBadgeVariant = (status: string) => {
    switch (status) {
      case "in_stock":
        return "default";
      case "low_stock":
        return "secondary";
      case "out_of_stock":
        return "destructive";
      case "order_only":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStockLabel = (status: string, count: number | null) => {
    switch (status) {
      case "in_stock":
        return "In Stock";
      case "low_stock":
        return `${count} Left`;
      case "out_of_stock":
        return "Out of Stock";
      case "order_only":
        return "Order Only";
      default:
        return status;
    }
  };

  return (
    <Card 
      className={cn(
        "overflow-hidden hover:shadow-md transition-shadow",
        isSelected && "ring-2 ring-primary"
      )}
      data-testid={`card-frame-${frame.id}`}
    >
      <div className="aspect-square bg-muted flex items-center justify-center relative">
        <img
          src={frame.imageUrl}
          alt={`${frame.name} - ${frame.style} frame`}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3e%3crect width='200' height='200' fill='%23f3f4f6'/%3e%3ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236b7280' font-size='14'%3eFrame Image%3c/text%3e%3c/svg%3e";
          }}
          data-testid={`img-frame-${frame.id}`}
        />

        {/* Stock Badge */}
        <div className="absolute top-2 right-2">
          <Badge 
            variant={getStockBadgeVariant(frame.stockStatus)}
            className="text-xs"
            data-testid={`badge-stock-${frame.id}`}
          >
            {getStockLabel(frame.stockStatus, frame.stockCount)}
          </Badge>
        </div>

        {/* Try On Button */}
        {onTryOn && (
          <Button
            onClick={() => onTryOn(frame)}
            size="sm"
            className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg"
            data-testid={`button-try-on-${frame.id}`}
          >
            <Eye className="w-4 h-4" />
          </Button>
        )}
      </div>

      <CardContent className="p-4">
        <div className="space-y-2">
          <h3 
            className="font-semibold text-foreground"
            data-testid={`text-frame-name-${frame.id}`}
          >
            {frame.name}
          </h3>
          <p 
            className="text-sm text-muted-foreground"
            data-testid={`text-frame-details-${frame.id}`}
          >
            {frame.style} • {frame.color} • {frame.size}
          </p>
          <div className="flex justify-between items-center">
            <span 
              className="text-lg font-bold text-primary"
              data-testid={`text-frame-price-${frame.id}`}
            >
              ${frame.price}
            </span>
            {onViewDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewDetails(frame)}
                className="text-accent hover:text-accent/80 font-medium"
                data-testid={`button-view-details-${frame.id}`}
              >
                View Details
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
