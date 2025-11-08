import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Store, ShoppingCart, Package, BarChart3, LogOut, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTenant, useStores, useCurrentStore } from "@/hooks/useTenant";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: tenantData } = useTenant();
  const { data: stores } = useStores();
  const { getCurrentStoreId, setCurrentStoreId } = useCurrentStore();
  const [currentStoreId, setCurrentStoreIdState] = useState<string>("");

  useEffect(() => {
    // Initialize current store from localStorage or use first available store
    const storedStoreId = getCurrentStoreId();
    if (storedStoreId && stores?.some(s => s.id === storedStoreId)) {
      setCurrentStoreIdState(storedStoreId);
    } else if (stores && stores.length > 0) {
      const firstStore = stores[0].id;
      setCurrentStoreIdState(firstStore);
      setCurrentStoreId(firstStore);
    }
  }, [stores]);

  const handleStoreChange = (storeId: string) => {
    setCurrentStoreIdState(storeId);
    setCurrentStoreId(storeId);
    toast({
      title: "Store switched",
      description: stores?.find(s => s.id === storeId)?.name,
    });
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  const navItems = [
    { path: "/dashboard", icon: Store, label: "Dashboard" },
    { path: "/pos", icon: ShoppingCart, label: "POS" },
    { path: "/products", icon: Package, label: "Products" },
    { path: "/sales", icon: BarChart3, label: "Sales" },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 flex-col justify-center border-b px-6">
            <div className="flex items-center">
              <Store className="h-6 w-6 text-primary" />
              <span className="ml-2 text-lg font-semibold">RetailPro</span>
            </div>
            {tenantData && (
              <p className="mt-1 text-xs text-muted-foreground">
                {tenantData.tenants?.name}
              </p>
            )}
          </div>

          {/* Store Switcher */}
          {stores && stores.length > 0 && (
            <div className="border-b p-4">
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                Current Store
              </label>
              <Select value={currentStoreId} onValueChange={handleStoreChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select store">
                    <div className="flex items-center">
                      <Building2 className="mr-2 h-4 w-4" />
                      {stores.find(s => s.id === currentStoreId)?.name}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      <div className="flex items-center">
                        <Building2 className="mr-2 h-4 w-4" />
                        {store.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className="w-full justify-start"
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Sign Out */}
          <div className="border-t p-4">
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="h-full">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
