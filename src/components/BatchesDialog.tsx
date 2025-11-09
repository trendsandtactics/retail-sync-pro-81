import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTenantStore } from "@/hooks/useTenantStore";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { format, isBefore, addDays } from "date-fns";

interface Batch {
  id: string;
  batch_number: string;
  manufacturing_date: string | null;
  expiry_date: string;
  purchase_price: number;
  quantity: number;
  remaining_quantity: number;
}

interface BatchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
}

export const BatchesDialog = ({ open, onOpenChange, productId, productName }: BatchesDialogProps) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();
  const { currentStore, tenantId } = useTenantStore();

  useEffect(() => {
    if (open) {
      loadBatches();
    }
  }, [open, productId]);

  const loadBatches = async () => {
    const { data, error } = await supabase
      .from("product_batches")
      .select("*")
      .eq("product_id", productId)
      .eq("is_active", true)
      .order("expiry_date", { ascending: true });

    if (error) {
      toast({
        title: "Error loading batches",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setBatches(data || []);
    }
  };

  const handleAddBatch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!tenantId || !currentStore) {
      toast({
        title: "Error",
        description: "Please select a store first",
        variant: "destructive",
      });
      return;
    }

    const quantity = parseInt(formData.get("quantity") as string);
    const batchData = {
      product_id: productId,
      tenant_id: tenantId,
      store_id: currentStore.id,
      batch_number: formData.get("batch_number") as string,
      manufacturing_date: formData.get("manufacturing_date") as string || null,
      expiry_date: formData.get("expiry_date") as string,
      purchase_price: parseFloat(formData.get("purchase_price") as string),
      quantity: quantity,
      remaining_quantity: quantity,
    };

    const { error } = await supabase.from("product_batches").insert([batchData]);

    if (error) {
      toast({
        title: "Error adding batch",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Batch added successfully" });
      loadBatches();
      setShowAddForm(false);
      e.currentTarget.reset();
    }
  };

  const handleDeleteBatch = async (id: string) => {
    const { error } = await supabase
      .from("product_batches")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error deleting batch",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Batch deleted successfully" });
      loadBatches();
    }
  };

  const getBatchStatus = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const warningDate = addDays(today, 30);

    if (isBefore(expiry, today)) {
      return { label: "Expired", variant: "destructive" as const };
    } else if (isBefore(expiry, warningDate)) {
      return { label: "Expiring Soon", variant: "secondary" as const };
    }
    return { label: "Active", variant: "default" as const };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Batches - {productName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add New Batch
            </Button>
          ) : (
            <form onSubmit={handleAddBatch} className="space-y-4 p-4 border rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batch_number">Batch Number *</Label>
                  <Input id="batch_number" name="batch_number" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input id="quantity" name="quantity" type="number" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturing_date">Manufacturing Date</Label>
                  <Input id="manufacturing_date" name="manufacturing_date" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiry_date">Expiry Date *</Label>
                  <Input id="expiry_date" name="expiry_date" type="date" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchase_price">Purchase Price *</Label>
                <Input
                  id="purchase_price"
                  name="purchase_price"
                  type="number"
                  step="0.01"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Add Batch</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch #</TableHead>
                <TableHead>Mfg Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => {
                const status = getBatchStatus(batch.expiry_date);
                return (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.batch_number}</TableCell>
                    <TableCell>
                      {batch.manufacturing_date
                        ? format(new Date(batch.manufacturing_date), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {format(new Date(batch.expiry_date), "dd/MM/yyyy")}
                        {status.variant === "destructive" && (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>₹{batch.purchase_price}</TableCell>
                    <TableCell>
                      {batch.remaining_quantity}/{batch.quantity}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteBatch(batch.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {batches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No batches found. Add your first batch to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};
