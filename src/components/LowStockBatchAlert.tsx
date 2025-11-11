import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface LowStockBatch {
  batch_id: string;
  batch_number: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  remaining_quantity: number;
  min_batch_stock_level: number;
  expiry_date: string;
}

export const LowStockBatchAlert = () => {
  const [lowStockBatches, setLowStockBatches] = useState<LowStockBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLowStockBatches();
  }, []);

  const loadLowStockBatches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("product_batches")
        .select(`
          id,
          batch_number,
          remaining_quantity,
          expiry_date,
          product_id,
          products!inner (
            id,
            name,
            sku,
            min_batch_stock_level
          )
        `)
        .eq("is_active", true)
        .gt("remaining_quantity", 0);

      if (error) throw error;

      // Filter batches where remaining_quantity <= min_batch_stock_level
      const lowStock = data
        ?.filter((batch: any) => {
          const threshold = batch.products.min_batch_stock_level || 5;
          return batch.remaining_quantity <= threshold;
        })
        .map((batch: any) => ({
          batch_id: batch.id,
          batch_number: batch.batch_number,
          product_id: batch.products.id,
          product_name: batch.products.name,
          product_sku: batch.products.sku,
          remaining_quantity: batch.remaining_quantity,
          min_batch_stock_level: batch.products.min_batch_stock_level || 5,
          expiry_date: batch.expiry_date,
        })) || [];

      setLowStockBatches(lowStock);
    } catch (error) {
      console.error("Error loading low stock batches:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;
  if (lowStockBatches.length === 0) return null;

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Low Stock Batches ({lowStockBatches.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {lowStockBatches.map((batch) => (
          <Alert key={batch.batch_id} variant="destructive">
            <AlertTitle className="text-sm font-medium">
              {batch.product_name} ({batch.product_sku})
            </AlertTitle>
            <AlertDescription className="text-xs mt-1">
              <div className="flex items-center justify-between">
                <span>Batch: {batch.batch_number}</span>
                <Badge variant="destructive" className="text-xs">
                  {batch.remaining_quantity} remaining
                </Badge>
              </div>
              <div className="text-muted-foreground mt-1">
                Threshold: {batch.min_batch_stock_level} | Expires: {new Date(batch.expiry_date).toLocaleDateString()}
              </div>
            </AlertDescription>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
};
