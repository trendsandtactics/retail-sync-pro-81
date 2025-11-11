import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Package, AlertTriangle } from "lucide-react";
import { useTenantStore } from "@/hooks/useTenantStore";
import { BatchesDialog } from "@/components/BatchesDialog";
import { addDays, isBefore } from "date-fns";

interface Product {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  hsn_code: string | null;
  selling_price: number;
  mrp: number | null;
  tax_rate: number;
  stock_quantity: number;
  min_stock_level: number;
  min_batch_stock_level: number | null;
}

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [batchesDialogOpen, setBatchesDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [expiryAlerts, setExpiryAlerts] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const { currentStore, tenantId } = useTenantStore();

  useEffect(() => {
    loadProducts();
    loadExpiryAlerts();
  }, []);

  const loadExpiryAlerts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date();
    const warningDate = addDays(today, 30);

    const { data } = await supabase
      .from("product_batches")
      .select("product_id, expiry_date")
      .eq("is_active", true)
      .lte("expiry_date", warningDate.toISOString());

    if (data) {
      const alerts: Record<string, number> = {};
      data.forEach((batch) => {
        const expiry = new Date(batch.expiry_date);
        if (isBefore(expiry, today)) {
          alerts[batch.product_id] = (alerts[batch.product_id] || 0) + 1;
        }
      });
      setExpiryAlerts(alerts);
    }
  };

  const loadProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error loading products",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !tenantId || !currentStore) {
      toast({
        title: "Error",
        description: "Please select a store first",
        variant: "destructive",
      });
      return;
    }

    const productData = {
      user_id: user.id,
      tenant_id: tenantId,
      store_id: currentStore.id,
      sku: formData.get("sku") as string,
      name: formData.get("name") as string,
      barcode: formData.get("barcode") as string || null,
      hsn_code: formData.get("hsn_code") as string || null,
      selling_price: parseFloat(formData.get("selling_price") as string),
      mrp: parseFloat(formData.get("mrp") as string) || null,
      tax_rate: parseFloat(formData.get("tax_rate") as string),
      stock_quantity: parseInt(formData.get("stock_quantity") as string),
      min_stock_level: parseInt(formData.get("min_stock_level") as string),
    };

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id);

      if (error) {
        toast({
          title: "Error updating product",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Product updated successfully" });
        loadProducts();
        setDialogOpen(false);
        setEditingProduct(null);
      }
    } else {
      const { error } = await supabase.from("products").insert([productData]);

      if (error) {
        toast({
          title: "Error creating product",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Product created successfully" });
        loadProducts();
        setDialogOpen(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("products")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error deleting product",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Product deleted successfully" });
      loadProducts();
    }
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product inventory</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingProduct(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input
                    id="sku"
                    name="sku"
                    defaultValue={editingProduct?.sku}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    name="barcode"
                    defaultValue={editingProduct?.barcode || ""}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingProduct?.name}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hsn_code">HSN Code</Label>
                  <Input
                    id="hsn_code"
                    name="hsn_code"
                    defaultValue={editingProduct?.hsn_code || ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_rate">Tax Rate (%) *</Label>
                  <Input
                    id="tax_rate"
                    name="tax_rate"
                    type="number"
                    step="0.01"
                    defaultValue={editingProduct?.tax_rate || 18}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="selling_price">Selling Price *</Label>
                  <Input
                    id="selling_price"
                    name="selling_price"
                    type="number"
                    step="0.01"
                    defaultValue={editingProduct?.selling_price}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mrp">MRP</Label>
                  <Input
                    id="mrp"
                    name="mrp"
                    type="number"
                    step="0.01"
                    defaultValue={editingProduct?.mrp || ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock_quantity">Stock Quantity *</Label>
                  <Input
                    id="stock_quantity"
                    name="stock_quantity"
                    type="number"
                    defaultValue={editingProduct?.stock_quantity || 0}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_stock_level">Min Stock Level *</Label>
                  <Input
                    id="min_stock_level"
                    name="min_stock_level"
                    type="number"
                    defaultValue={editingProduct?.min_stock_level || 10}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_batch_stock_level">Min Batch Stock Level</Label>
                <Input
                  id="min_batch_stock_level"
                  name="min_batch_stock_level"
                  type="number"
                  defaultValue={editingProduct?.min_batch_stock_level || 5}
                  placeholder="Alert when batch stock falls below this level"
                />
              </div>

              <Button type="submit" className="w-full">
                {editingProduct ? "Update Product" : "Create Product"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Batches</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.sku}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.barcode || "-"}</TableCell>
                  <TableCell>{product.hsn_code || "-"}</TableCell>
                  <TableCell>₹{product.selling_price}</TableCell>
                  <TableCell>{product.tax_rate}%</TableCell>
                  <TableCell>
                    <Badge
                      variant={product.stock_quantity <= product.min_stock_level ? "destructive" : "default"}
                    >
                      {product.stock_quantity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedProduct(product);
                        setBatchesDialogOpen(true);
                      }}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Manage
                      {expiryAlerts[product.id] && (
                        <Badge variant="destructive" className="ml-2">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {expiryAlerts[product.id]}
                        </Badge>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingProduct(product);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No products found. Add your first product to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedProduct && (
        <BatchesDialog
          open={batchesDialogOpen}
          onOpenChange={setBatchesDialogOpen}
          productId={selectedProduct.id}
          productName={selectedProduct.name}
        />
      )}
    </div>
  );
};

export default Products;
