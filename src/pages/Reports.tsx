import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, TrendingDown, Calendar, AlertTriangle } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { Progress } from "@/components/ui/progress";

interface BatchReport {
  id: string;
  batch_number: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  manufacturing_date: string | null;
  expiry_date: string;
  quantity: number;
  remaining_quantity: number;
  purchase_price: number;
  created_at: string;
}

interface TurnoverMetrics {
  batch_id: string;
  batch_number: string;
  product_name: string;
  initial_quantity: number;
  sold_quantity: number;
  turnover_rate: number;
  days_active: number;
  avg_daily_sales: number;
}

const Reports = () => {
  const [batches, setBatches] = useState<BatchReport[]>([]);
  const [turnoverData, setTurnoverData] = useState<TurnoverMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBatches: 0,
    expiringBatches: 0,
    expiredBatches: 0,
    totalInventoryValue: 0,
  });

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all active batches
      const { data: batchData, error } = await supabase
        .from("product_batches")
        .select(`
          id,
          batch_number,
          manufacturing_date,
          expiry_date,
          quantity,
          remaining_quantity,
          purchase_price,
          created_at,
          product_id,
          products!inner (
            id,
            name,
            sku
          )
        `)
        .eq("is_active", true)
        .order("expiry_date", { ascending: true });

      if (error) throw error;

      const formattedBatches: BatchReport[] = (batchData || []).map((batch: any) => ({
        id: batch.id,
        batch_number: batch.batch_number,
        product_id: batch.products.id,
        product_name: batch.products.name,
        product_sku: batch.products.sku,
        manufacturing_date: batch.manufacturing_date,
        expiry_date: batch.expiry_date,
        quantity: batch.quantity,
        remaining_quantity: batch.remaining_quantity,
        purchase_price: batch.purchase_price,
        created_at: batch.created_at,
      }));

      setBatches(formattedBatches);

      // Calculate stats
      const today = new Date();
      const expiringCount = formattedBatches.filter(b => {
        const daysUntilExpiry = differenceInDays(new Date(b.expiry_date), today);
        return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
      }).length;

      const expiredCount = formattedBatches.filter(b => {
        return differenceInDays(new Date(b.expiry_date), today) < 0;
      }).length;

      const totalValue = formattedBatches.reduce((sum, b) => 
        sum + (b.remaining_quantity * Number(b.purchase_price)), 0
      );

      setStats({
        totalBatches: formattedBatches.length,
        expiringBatches: expiringCount,
        expiredBatches: expiredCount,
        totalInventoryValue: totalValue,
      });

      // Calculate turnover metrics
      const turnover: TurnoverMetrics[] = formattedBatches.map(batch => {
        const soldQuantity = batch.quantity - batch.remaining_quantity;
        const daysActive = Math.max(1, differenceInDays(today, new Date(batch.created_at)));
        const avgDailySales = soldQuantity / daysActive;
        const turnoverRate = batch.quantity > 0 ? (soldQuantity / batch.quantity) * 100 : 0;

        return {
          batch_id: batch.id,
          batch_number: batch.batch_number,
          product_name: batch.product_name,
          initial_quantity: batch.quantity,
          sold_quantity: soldQuantity,
          turnover_rate: turnoverRate,
          days_active: daysActive,
          avg_daily_sales: avgDailySales,
        };
      }).sort((a, b) => b.turnover_rate - a.turnover_rate);

      setTurnoverData(turnover);
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const getBatchStatus = (expiryDate: string) => {
    const daysUntilExpiry = differenceInDays(new Date(expiryDate), new Date());
    if (daysUntilExpiry < 0) return { label: "Expired", variant: "destructive" as const };
    if (daysUntilExpiry <= 30) return { label: "Expiring Soon", variant: "secondary" as const };
    return { label: "Active", variant: "default" as const };
  };

  const getStockLevel = (remaining: number, total: number) => {
    const percentage = (remaining / total) * 100;
    if (percentage <= 20) return "critical";
    if (percentage <= 50) return "low";
    return "good";
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
        <h1 className="text-3xl font-bold">Batch Stock Reports</h1>
        <p className="text-muted-foreground">Inventory analytics and turnover metrics</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Batches</CardTitle>
            <Package className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBatches}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Soon</CardTitle>
            <Calendar className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiringBatches}</div>
            <p className="text-xs text-muted-foreground">Within 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expired Batches</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiredBatches}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Value</CardTitle>
            <TrendingDown className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalInventoryValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">At purchase price</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different reports */}
      <Tabs defaultValue="inventory" className="space-y-6">
        <TabsList>
          <TabsTrigger value="inventory">Inventory Levels</TabsTrigger>
          <TabsTrigger value="expiry">Expiry Timeline</TabsTrigger>
          <TabsTrigger value="turnover">Stock Turnover</TabsTrigger>
        </TabsList>

        {/* Inventory Levels Tab */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Current Inventory Levels</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch Number</TableHead>
                    <TableHead>Stock Level</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Original</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const stockLevel = getStockLevel(batch.remaining_quantity, batch.quantity);
                    const percentage = (batch.remaining_quantity / batch.quantity) * 100;
                    const status = getBatchStatus(batch.expiry_date);

                    return (
                      <TableRow key={batch.id}>
                        <TableCell>
                          <div className="font-medium">{batch.product_name}</div>
                          <div className="text-xs text-muted-foreground">{batch.product_sku}</div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{batch.batch_number}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={percentage} className="h-2" />
                            <span className={`text-xs ${
                              stockLevel === "critical" ? "text-destructive" :
                              stockLevel === "low" ? "text-warning" : "text-success"
                            }`}>
                              {percentage.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{batch.remaining_quantity}</TableCell>
                        <TableCell className="text-muted-foreground">{batch.quantity}</TableCell>
                        <TableCell>₹{(batch.remaining_quantity * Number(batch.purchase_price)).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expiry Timeline Tab */}
        <TabsContent value="expiry">
          <Card>
            <CardHeader>
              <CardTitle>Expiry Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch Number</TableHead>
                    <TableHead>Manufacturing Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Days Until Expiry</TableHead>
                    <TableHead>Remaining Stock</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const daysUntilExpiry = differenceInDays(new Date(batch.expiry_date), new Date());
                    const status = getBatchStatus(batch.expiry_date);

                    return (
                      <TableRow key={batch.id}>
                        <TableCell>
                          <div className="font-medium">{batch.product_name}</div>
                          <div className="text-xs text-muted-foreground">{batch.product_sku}</div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{batch.batch_number}</TableCell>
                        <TableCell>
                          {batch.manufacturing_date ? format(new Date(batch.manufacturing_date), "dd MMM yyyy") : "N/A"}
                        </TableCell>
                        <TableCell>{format(new Date(batch.expiry_date), "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <span className={
                            daysUntilExpiry < 0 ? "text-destructive" :
                            daysUntilExpiry <= 30 ? "text-warning" : "text-success"
                          }>
                            {daysUntilExpiry} days
                          </span>
                        </TableCell>
                        <TableCell>{batch.remaining_quantity}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock Turnover Tab */}
        <TabsContent value="turnover">
          <Card>
            <CardHeader>
              <CardTitle>Stock Turnover Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch Number</TableHead>
                    <TableHead>Initial Stock</TableHead>
                    <TableHead>Sold</TableHead>
                    <TableHead>Turnover Rate</TableHead>
                    <TableHead>Days Active</TableHead>
                    <TableHead>Avg Daily Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {turnoverData.map((item) => (
                    <TableRow key={item.batch_id}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="font-mono text-sm">{item.batch_number}</TableCell>
                      <TableCell>{item.initial_quantity}</TableCell>
                      <TableCell>{item.sold_quantity}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={item.turnover_rate} className="h-2" />
                          <span className="text-xs font-medium">{item.turnover_rate.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{item.days_active}</TableCell>
                      <TableCell>
                        <span className={
                          item.avg_daily_sales > 5 ? "text-success" :
                          item.avg_daily_sales > 1 ? "text-warning" : "text-muted-foreground"
                        }>
                          {item.avg_daily_sales.toFixed(2)} units/day
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
