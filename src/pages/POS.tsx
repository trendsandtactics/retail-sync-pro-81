import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Trash2, ShoppingCart, Printer, AlertTriangle, Keyboard, Eye } from "lucide-react";
import { useTenantStore } from "@/hooks/useTenantStore";
import { Receipt } from "@/components/Receipt";

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
  batch_id?: string;
  batch_number?: string;
  expiry_date?: string;
}

interface Batch {
  id: string;
  batch_number: string;
  expiry_date: string;
  remaining_quantity: number;
  manufacturing_date: string;
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
  const [isFifoMode, setIsFifoMode] = useState(true);
  const [batchDialog, setBatchDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [availableBatches, setAvailableBatches] = useState<Batch[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef<string>("");
  const barcodeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const successSoundRef = useRef<HTMLAudioElement | null>(null);
  const errorSoundRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const { currentStore, tenantId } = useTenantStore();

  // Initialize sound effects
  useEffect(() => {
    // Create success sound (beep)
    const successAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBDGH0fPTgjMGHm7A7+OZUQ4PWqzn7aRZEwU+ltryxnIlBSl+zPLaizsIGGS56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy');
    successSoundRef.current = successAudio;

    // Create error sound (lower pitched beep)
    const errorAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBDGH0fPTgjMGHm7A7+OZUQ4PWqzn7aRZEwU+ltryxnIlBSl+zPLaizsIGGS56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy0H4qBSh9y/LajDsIF2S56+idUQ8MUKXi8LdkHAY5kdXy');
    errorSoundRef.current = errorAudio;

    return () => {
      successSoundRef.current = null;
      errorSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Barcode scanner listener
  useEffect(() => {
    const handleBarcodeScan = (e: KeyboardEvent) => {
      // Clear timer if exists
      if (barcodeTimerRef.current) {
        clearTimeout(barcodeTimerRef.current);
      }

      // If Enter key is pressed, process the barcode
      if (e.key === 'Enter' && barcodeBufferRef.current) {
        e.preventDefault();
        const barcode = barcodeBufferRef.current;
        barcodeBufferRef.current = "";
        
        // Find product by barcode
        const product = products.find(p => p.barcode === barcode);
        
        if (product) {
          // Play success sound
          successSoundRef.current?.play().catch(() => {});
          
          // Add to cart with visual feedback
          addToCart(product);
          
          // Visual confirmation
          toast({
            title: "✓ Scanned Successfully",
            description: `${product.name} added to cart`,
            duration: 2000,
          });
        } else {
          // Play error sound
          errorSoundRef.current?.play().catch(() => {});
          
          // Show error
          toast({
            title: "❌ Product Not Found",
            description: `No product found with barcode: ${barcode}`,
            variant: "destructive",
            duration: 3000,
          });
        }
        return;
      }

      // Accumulate characters (barcode scanners type very fast)
      if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
        
        // Reset buffer after 100ms of inactivity (typical for scanner input)
        barcodeTimerRef.current = setTimeout(() => {
          barcodeBufferRef.current = "";
        }, 100);
      }
    };

    window.addEventListener('keydown', handleBarcodeScan);
    return () => {
      window.removeEventListener('keydown', handleBarcodeScan);
      if (barcodeTimerRef.current) {
        clearTimeout(barcodeTimerRef.current);
      }
    };
  }, [products, cart]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      // Ignore if dialog is open
      if (batchDialog || receiptDialog) {
        return;
      }

      // Enter - Complete sale
      if (e.key === 'Enter') {
        e.preventDefault();
        if (cart.length > 0) {
          completeSale();
        }
        return;
      }

      // Escape - Clear cart
      if (e.key === 'Escape') {
        e.preventDefault();
        if (cart.length > 0) {
          setCart([]);
          toast({
            title: "Cart cleared",
            description: "All items removed from cart",
          });
        }
        return;
      }

      // F1-F12 - Quick product access
      if (e.key.startsWith('F') && e.key.length === 2) {
        e.preventDefault();
        const fNumber = parseInt(e.key.substring(1));
        if (fNumber >= 1 && fNumber <= 12) {
          const productIndex = fNumber - 1;
          if (filteredProducts[productIndex]) {
            addToCart(filteredProducts[productIndex]);
          }
        }
        return;
      }

      // / - Focus search
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // ? - Show shortcuts
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, filteredProducts, batchDialog, receiptDialog]);


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

  const loadBatches = async (productId: string): Promise<Batch[]> => {
    const { data, error } = await supabase
      .from("product_batches")
      .select("*")
      .eq("product_id", productId)
      .eq("is_active", true)
      .gt("remaining_quantity", 0)
      .order("expiry_date", { ascending: true });

    if (!error && data) {
      return data;
    }
    return [];
  };

  const addToCart = async (product: Product) => {
    // Load batches
    const batches = await loadBatches(product.id);
    
    if (batches.length === 0) {
      toast({
        title: "No batches available",
        description: "This product has no available batches",
        variant: "destructive",
      });
      return;
    }

    // Filter out expired batches
    const validBatches = batches.filter(batch => new Date(batch.expiry_date) >= new Date());
    
    if (validBatches.length === 0) {
      toast({
        title: "All batches expired",
        description: "All available batches for this product have expired",
        variant: "destructive",
      });
      return;
    }

    // Manual mode - show batch selection dialog
    if (!isFifoMode) {
      setSelectedProduct(product);
      setAvailableBatches(validBatches);
      setBatchDialog(true);
      return;
    }

    // Auto FIFO mode - automatically select the first valid batch (earliest expiry)
    const selectedBatch = validBatches[0];
    addBatchToCart(product, selectedBatch);
  };

  const addBatchToCart = (product: Product, selectedBatch: Batch) => {
    const daysUntilExpiry = Math.ceil((new Date(selectedBatch.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    // Check if this batch is already in cart
    const existing = cart.find((item) => item.id === product.id && item.batch_id === selectedBatch.id);
    
    if (existing) {
      // Check stock availability
      if (existing.quantity >= selectedBatch.remaining_quantity) {
        toast({
          title: "Insufficient stock",
          description: `Only ${selectedBatch.remaining_quantity} units available in batch ${selectedBatch.batch_number}`,
          variant: "destructive",
        });
        return;
      }
      
      // Increment existing batch quantity
      setCart(
        cart.map((item) =>
          item.id === product.id && item.batch_id === selectedBatch.id
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
      // Add new batch to cart
      setCart([
        ...cart,
        {
          ...product,
          quantity: 1,
          itemTotal: product.selling_price,
          itemTax: (product.selling_price * product.tax_rate) / 100,
          batch_id: selectedBatch.id,
          batch_number: selectedBatch.batch_number,
          expiry_date: selectedBatch.expiry_date,
        },
      ]);
    }

    // Show warning if batch expires within 30 days
    if (daysUntilExpiry <= 30) {
      toast({
        title: "⚠️ Expiry Warning",
        description: `${product.name} - Batch ${selectedBatch.batch_number} expires in ${daysUntilExpiry} days!`,
        variant: "destructive",
      });
    } else {
      // Show which batch was selected
      toast({
        title: isFifoMode ? "Added to cart (Auto FIFO)" : "Added to cart",
        description: `${product.name} - Batch ${selectedBatch.batch_number} (Expires in ${daysUntilExpiry} days)`,
      });
    }
  };

  const removeFromCart = (productId: string, batchId?: string) => {
    setCart(cart.filter((item) => !(item.id === productId && (!batchId || item.batch_id === batchId))));
  };

  const updateQuantity = async (productId: string, quantity: number, batchId?: string) => {
    const cartItem = cart.find((item) => item.id === productId && (!batchId || item.batch_id === batchId));
    if (!cartItem) return;

    // Fetch current batch data to get remaining quantity
    let maxQuantity = cartItem.stock_quantity;
    if (cartItem.batch_id) {
      const { data: batchData } = await supabase
        .from("product_batches")
        .select("remaining_quantity")
        .eq("id", cartItem.batch_id)
        .single();
      
      if (batchData) {
        maxQuantity = batchData.remaining_quantity;
      }
    }

    if (quantity > maxQuantity) {
      toast({
        title: "Insufficient stock",
        description: `Only ${maxQuantity} units available`,
        variant: "destructive",
      });
      return;
    }

    if (quantity <= 0) {
      removeFromCart(productId, batchId);
      return;
    }

    setCart(
      cart.map((item) =>
        item.id === productId && (!batchId || item.batch_id === batchId)
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
      batch_id: item.batch_id,
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

    // Update batch quantities and product stock
    for (const item of cart) {
      if (item.batch_id) {
        // Get current batch quantity
        const { data: batchData } = await supabase
          .from("product_batches")
          .select("remaining_quantity")
          .eq("id", item.batch_id)
          .single();

        if (batchData) {
          const { error: batchError } = await supabase
            .from("product_batches")
            .update({ remaining_quantity: batchData.remaining_quantity - item.quantity })
            .eq("id", item.batch_id);

          if (batchError) {
            console.error("Error updating batch:", batchError);
          }
        }
      }

      // Update total product stock
      const { error: stockError } = await supabase
        .from("products")
        .update({ stock_quantity: item.stock_quantity - item.quantity })
        .eq("id", item.id);

      if (stockError) {
        console.error("Error updating stock:", stockError);
      }
    }

    setLastInvoice({ ...saleData, items: cart });
    setShowPrintPreview(true);
    
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

  const { subtotal, tax, total } = calculateTotals();

  return (
    <div className="flex h-full">
      {/* Left Panel - Product Search */}
      <div className="flex-1 border-r p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Products</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShortcuts(true)}
            >
              <Keyboard className="h-4 w-4 mr-2" />
              Shortcuts
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search by name, SKU, or barcode... (Press / to focus)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid gap-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
          {filteredProducts.slice(0, 12).map((product, index) => (
            <Card
              key={product.id}
              className="cursor-pointer transition-all hover:shadow-md"
              onClick={() => addToCart(product)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{product.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        F{index + 1}
                      </Badge>
                    </div>
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
          {filteredProducts.length > 12 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              +{filteredProducts.length - 12} more products (use search to filter)
            </p>
          )}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className="w-[450px] flex flex-col bg-card">
        <div className="border-b p-6 space-y-4">
          <h2 className="text-2xl font-bold flex items-center">
            <ShoppingCart className="mr-2 h-6 w-6" />
            Cart
          </h2>
          <div className="flex items-center justify-between">
            <Label htmlFor="fifo-mode" className="text-sm font-medium">
              Auto FIFO Mode
            </Label>
            <Switch
              id="fifo-mode"
              checked={isFifoMode}
              onCheckedChange={setIsFifoMode}
            />
          </div>
          {!isFifoMode && (
            <p className="text-xs text-muted-foreground">
              Manual batch selection enabled
            </p>
          )}
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
                        {item.batch_number && (
                          <p className="text-xs text-muted-foreground">Batch: {item.batch_number}</p>
                        )}
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
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0, item.batch_id)}
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


      {/* Batch Selection Dialog */}
      <Dialog open={batchDialog} onOpenChange={setBatchDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Batch for {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {availableBatches.some(batch => {
              const daysUntilExpiry = Math.ceil(
                (new Date(batch.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );
              return daysUntilExpiry <= 30;
            }) && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Some batches expire within 30 days. Please review carefully.
                </AlertDescription>
              </Alert>
            )}
            {availableBatches.map((batch) => {
              const daysUntilExpiry = Math.ceil(
                (new Date(batch.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );
              const isExpiringSoon = daysUntilExpiry <= 30;
              
              return (
                <Card
                  key={batch.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isExpiringSoon ? 'border-destructive border-2' : ''
                  }`}
                  onClick={() => {
                    if (selectedProduct) {
                      addBatchToCart(selectedProduct, batch);
                      setBatchDialog(false);
                      setSelectedProduct(null);
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">Batch: {batch.batch_number}</p>
                          {isExpiringSoon && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Expiring Soon
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Stock: {batch.remaining_quantity} units
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Mfg: {new Date(batch.manufacturing_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          Expires: {new Date(batch.expiry_date).toLocaleDateString()}
                        </p>
                        <p className={`text-xs font-semibold ${
                          isExpiringSoon ? 'text-destructive' : 'text-muted-foreground'
                        }`}>
                          {daysUntilExpiry} days left
                        </p>
                      </div>
                    </div>
                    {isExpiringSoon && (
                      <div className="mt-2 pt-2 border-t border-destructive/20">
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          This batch expires in less than 30 days
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Preview Dialog */}
      <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Print Preview - Invoice {lastInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {lastInvoice && (
            <Receipt 
              invoice={lastInvoice} 
              onPrint={() => setShowPrintPreview(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Quick Actions</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Complete Sale</span>
                  <Badge variant="secondary">Enter</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clear Cart</span>
                  <Badge variant="secondary">Esc</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Focus Search</span>
                  <Badge variant="secondary">/</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Show Shortcuts</span>
                  <Badge variant="secondary">?</Badge>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Quick Product Access</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Add First 12 Products</span>
                  <Badge variant="secondary">F1 - F12</Badge>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Barcode Scanner</h4>
              <div className="space-y-1 text-sm">
                <div className="text-muted-foreground">
                  Simply scan product barcodes to automatically add items to cart
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POS;
