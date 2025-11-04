import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface Sale {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_method: string;
  created_at: string;
}

interface SaleItem {
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total_amount: number;
}

const Sales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSales(data);
    }
    setLoading(false);
  };

  const loadSaleItems = async (saleId: string) => {
    const { data, error } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", saleId);

    if (!error && data) {
      setSaleItems(data);
    }
  };

  const handleViewDetails = async (sale: Sale) => {
    setSelectedSale(sale);
    await loadSaleItems(sale.id);
  };

  const getPaymentMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      cash: "default",
      upi: "default",
      card: "default",
    };
    return <Badge variant={colors[method] as any}>{method.toUpperCase()}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Sales History</h1>
        <p className="text-muted-foreground">View all transactions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>GST</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">{sale.invoice_number}</TableCell>
                  <TableCell>
                    {sale.customer_name || <span className="text-muted-foreground">Walk-in</span>}
                  </TableCell>
                  <TableCell>{getPaymentMethodBadge(sale.payment_method)}</TableCell>
                  <TableCell>₹{Number(sale.subtotal).toFixed(2)}</TableCell>
                  <TableCell>₹{Number(sale.tax_amount).toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">₹{Number(sale.total_amount).toFixed(2)}</TableCell>
                  <TableCell>
                    {new Date(sale.created_at).toLocaleDateString('en-IN')}
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetails(sale)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Sale Details</DialogTitle>
                        </DialogHeader>
                        {selectedSale && selectedSale.id === sale.id && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Invoice Number</p>
                                <p className="font-semibold">{selectedSale.invoice_number}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Date & Time</p>
                                <p className="font-semibold">
                                  {new Date(selectedSale.created_at).toLocaleString('en-IN')}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Customer</p>
                                <p className="font-semibold">
                                  {selectedSale.customer_name || "Walk-in Customer"}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Payment Method</p>
                                <p className="font-semibold">{selectedSale.payment_method.toUpperCase()}</p>
                              </div>
                            </div>

                            <div>
                              <h3 className="font-semibold mb-3">Items</h3>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">Tax</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {saleItems.map((item, index) => (
                                    <TableRow key={index}>
                                      <TableCell>{item.product_name}</TableCell>
                                      <TableCell>{item.product_sku || "-"}</TableCell>
                                      <TableCell className="text-right">{item.quantity}</TableCell>
                                      <TableCell className="text-right">₹{Number(item.unit_price).toFixed(2)}</TableCell>
                                      <TableCell className="text-right">{item.tax_rate}%</TableCell>
                                      <TableCell className="text-right">₹{Number(item.total_amount).toFixed(2)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>

                            <div className="space-y-2 border-t pt-4">
                              <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span>₹{Number(selectedSale.subtotal).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>GST:</span>
                                <span>₹{Number(selectedSale.tax_amount).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-bold text-lg border-t pt-2">
                                <span>Total:</span>
                                <span>₹{Number(selectedSale.total_amount).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
              {sales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No sales recorded yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Sales;
