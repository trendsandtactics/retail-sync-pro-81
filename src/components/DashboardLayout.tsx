import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Store, ShoppingCart, Package, BarChart3, LogOut, Building2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTenantStore } from "@/hooks/useTenantStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentStore, stores, switchStore, userRoles } = useTenantStore();

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
    { path: "/reports", icon: FileText, label: "Reports" },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center border-b px-6">
            <Store className="h-6 w-6 text-primary" />
            <span className="ml-2 text-lg font-semibold">RetailPro</span>
          </div>

          {/* Store Switcher */}
          {stores.length > 1 && (
            <div className="border-b p-4">
              <Select
                value={currentStore?.id || ""}
                onValueChange={switchStore}
              >
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <SelectValue placeholder="Select store" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* User Role Badge */}
          {userRoles.length > 0 && (
            <div className="px-4 pt-4">
              <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm">
                <span className="font-medium capitalize">{userRoles[0].role}</span>
              </div>
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
