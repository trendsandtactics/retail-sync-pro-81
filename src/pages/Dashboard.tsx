import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, ShoppingCart, Package, TrendingUp } from "lucide-react";
import { LowStockBatchAlert } from "@/components/LowStockBatchAlert";

interface Stats {
  totalSales: number;
  todaySales: number;
  totalProducts: number;
  lowStockProducts: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalSales: 0,
    todaySales: 0,
    totalProducts: 0,
    lowStockProducts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get total sales
    const { data: totalSalesData } = await supabase
      .from("sales")
      .select("total_amount")
      .eq("user_id", user.id);

    const totalSales = totalSalesData?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;

    // Get today's sales
    const { data: todaySalesData } = await supabase
      .from("sales")
      .select("total_amount")
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString());

    const todaySales = todaySalesData?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;

    // Get products count
    const { count: productsCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true);

    // Get low stock products (where stock is at or below min level)
    const { data: allProducts } = await supabase
      .from("products")
      .select("stock_quantity, min_stock_level")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const lowStockCount = allProducts?.filter(
      p => p.stock_quantity <= p.min_stock_level
    ).length || 0;

    setStats({
      totalSales,
      todaySales,
      totalProducts: productsCount || 0,
      lowStockProducts: lowStockCount || 0,
    });
    setLoading(false);
  };

  const statCards = [
    {
      title: "Total Sales",
      value: `₹${stats.totalSales.toFixed(2)}`,
      icon: IndianRupee,
      color: "text-success",
    },
    {
      title: "Today's Sales",
      value: `₹${stats.todaySales.toFixed(2)}`,
      icon: TrendingUp,
      color: "text-accent",
    },
    {
      title: "Total Products",
      value: stats.totalProducts.toString(),
      icon: Package,
      color: "text-primary",
    },
    {
      title: "Low Stock Alert",
      value: stats.lowStockProducts.toString(),
      icon: ShoppingCart,
      color: "text-warning",
    },
  ];

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
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your POS system</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <LowStockBatchAlert />
      </div>
    </div>
  );
};

export default Dashboard;
