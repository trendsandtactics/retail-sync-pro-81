import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Trash2, ShoppingCart, Printer } from "lucide-react";
import { useTenantStore } from "@/hooks/useTenantStore";

interface Product {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  hsn_code: string | null;
  selling_price: number;
  tax_rate: number;
  stock_quantity: number;
}

interface CartItem extends Product {
  quantity: number;
  itemTotal: number;
  itemTax: number;
}

const POS = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [receiptDialog, setReceiptDialog] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const { toast } = useToast();
  const { currentStore, tenantId } = useTenantStore();

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .gt("stock_quantity", 0);

    if (!error && data) {
      setProducts(data);
    }
  };

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.id === product.id);
    
    if (existing) {
      if (existing.quantity >= product.stock_quantity) {
        toast({
          title: "Insufficient stock",
          description: `Only ${product.stock_quantity} units available`,
          variant: "destructive",
        });
        return;
      }
      
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                itemTotal: (item.quantity + 1) * item.selling_price,
                itemTax: ((item.quantity + 1) * item.selling_price * item.tax_rate) / 100,
              }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          ...product,
          quantity: 1,
          itemTotal: product.selling_price,
          itemTax: (product.selling_price * product.tax_rate) / 100,
        },
      ]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (quantity > product.stock_quantity) {
      toast({
        title: "Insufficient stock",
        description: `Only ${product.stock_quantity} units available`,
        variant: "destructive",
      });
      return;
    }

    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(
      cart.map((item) =>
        item.id === productId
          ? {
              ...item,
              quantity,
              itemTotal: quantity * item.selling_price,
              itemTax: (quantity * item.selling_price * item.tax_rate) / 100,
            }
          : item
      )
    );
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);
    const tax = cart.reduce((sum, item) => sum + item.itemTax, 0);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Add items to cart before completing sale",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !tenantId || !currentStore) {
      toast({
        title: "Error",
        description: "Please select a store first",
        variant: "destructive",
      });
      return;
    }

    const { subtotal, tax, total } = calculateTotals();
    const invoiceNumber = `INV-${Date.now()}`;

    // Create sale
    const { data: saleData, error: saleError } = await supabase
      .from("sales")
      .insert([
        {
          user_id: user.id,
          tenant_id: tenantId,
          store_id: currentStore.id,
          invoice_number: invoiceNumber,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          subtotal,
          tax_amount: tax,
          total_amount: total,
          payment_method: paymentMethod,
          payment_status: "completed",
        },
      ])
      .select()
      .single();

    if (saleError) {
      toast({
        title: "Error creating sale",
        description: saleError.message,
        variant: "destructive",
      });
      return;
    }

    // Create sale items
    const saleItems = cart.map((item) => ({
      sale_id: saleData.id,
      product_id: item.id,
      product_name: item.name,
      product_sku: item.sku,
      hsn_code: item.hsn_code,
      quantity: item.quantity,
      unit_price: item.selling_price,
      tax_rate: item.tax_rate,
      tax_amount: item.itemTax,
      total_amount: item.itemTotal + item.itemTax,
    }));

    const { error: itemsError } = await supabase
      .from("sale_items")
      .insert(saleItems);

    if (itemsError) {
      toast({
        title: "Error adding sale items",
        description: itemsError.message,
        variant: "destructive",
      });
      return;
    }

    // Update product stock
    for (const item of cart) {
      const { error: stockError } = await supabase
        .from("products")
        .update({ stock_quantity: item.stock_quantity - item.quantity })
        .eq("id", item.id);

      if (stockError) {
        console.error("Error updating stock:", stockError);
      }
    }

    setLastInvoice({ ...saleData, items: cart });
    setReceiptDialog(true);
    
    // Clear cart and customer info
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    loadProducts();

    toast({
      title: "Sale completed successfully",
      description: `Invoice: ${invoiceNumber}`,
    });
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { subtotal, tax, total } = calculateTotals();

  return (
    <div className="flex h-full">
      {/* Left Panel - Product Search */}
      <div className="flex-1 border-r p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">Products</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, SKU, or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid gap-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="cursor-pointer transition-all hover:shadow-md"
              onClick={() => addToCart(product)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{product.sku}</p>
                    <p className="text-xs text-muted-foreground">Stock: {product.stock_quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">₹{product.selling_price}</p>
                    <p className="text-xs text-muted-foreground">{product.tax_rate}% GST</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className="w-[450px] flex flex-col bg-card">
        <div className="border-b p-6">
          <h2 className="text-2xl font-bold flex items-center">
            <ShoppingCart className="mr-2 h-6 w-6" />
            Cart
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-muted-foreground">
              <p>Cart is empty<br />Add products to start billing</p>
            </div>
          ) : (
            <>
              {cart.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">₹{item.selling_price} × {item.quantity}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max={item.stock_quantity}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                      <span className="text-sm font-semibold ml-auto">
                        ₹{(item.itemTotal + item.itemTax).toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>

        <div className="border-t p-6 space-y-4">
          <div className="space-y-2">
            <Label>Customer Name (Optional)</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
            />
          </div>

          <div className="space-y-2">
            <Label>Customer Phone (Optional)</Label>
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone number"
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>GST:</span>
              <span>₹{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total:</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={completeSale}
            disabled={cart.length === 0}
          >
            Complete Sale
          </Button>
        </div>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={receiptDialog} onOpenChange={setReceiptDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Printer className="mr-2 h-5 w-5" />
              Sale Completed
            </DialogTitle>
          </DialogHeader>
          {lastInvoice && (
            <div className="space-y-4">
              <div className="text-center border-b pb-4">
                <h3 className="text-lg font-bold">RetailPro POS</h3>
                <p className="text-sm text-muted-foreground">Tax Invoice</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Invoice No:</span>
                  <span className="font-semibold">{lastInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(lastInvoice.created_at).toLocaleString()}</span>
                </div>
                {lastInvoice.customer_name && (
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span>{lastInvoice.customer_name}</span>
                  </div>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastInvoice.items.map((item: CartItem) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">{item.name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">₹{(item.itemTotal + item.itemTax).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="space-y-1 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>₹{lastInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>GST:</span>
                  <span>₹{lastInvoice.tax_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>₹{lastInvoice.total_amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-center text-sm text-muted-foreground border-t pt-4">
                <p>Thank you for your business!</p>
              </div>

              <Button className="w-full" onClick={() => setReceiptDialog(false)}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POS;
