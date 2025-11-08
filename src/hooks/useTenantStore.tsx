import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Store {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
}

interface UserRole {
  id: string;
  user_id: string;
  tenant_id: string;
  role: "owner" | "manager" | "cashier" | "accountant" | "auditor";
  store_id: string | null;
}

interface TenantStoreContextType {
  currentStore: Store | null;
  stores: Store[];
  userRoles: UserRole[];
  tenantId: string | null;
  switchStore: (storeId: string) => void;
  hasRole: (role: string) => boolean;
  isLoading: boolean;
}

const TenantStoreContext = createContext<TenantStoreContextType | undefined>(undefined);

export const TenantStoreProvider = ({ children }: { children: ReactNode }) => {
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadTenantData();
  }, []);

  const loadTenantData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Get user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.id);

      if (rolesError) throw rolesError;

      setUserRoles(roles || []);
      
      if (roles && roles.length > 0) {
        const tenant = roles[0].tenant_id;
        setTenantId(tenant);

        // Get stores for tenant
        const { data: storesData, error: storesError } = await supabase
          .from("stores")
          .select("*")
          .eq("tenant_id", tenant)
          .eq("is_active", true);

        if (storesError) throw storesError;

        setStores(storesData || []);

        // Set current store from localStorage or first store
        const savedStoreId = localStorage.getItem("currentStoreId");
        const initialStore = savedStoreId
          ? storesData?.find(s => s.id === savedStoreId)
          : storesData?.[0];

        setCurrentStore(initialStore || null);
      }
    } catch (error: any) {
      console.error("Error loading tenant data:", error);
      toast({
        title: "Error loading tenant data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const switchStore = (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (store) {
      setCurrentStore(store);
      localStorage.setItem("currentStoreId", storeId);
      toast({
        title: "Store switched",
        description: `Now working in ${store.name}`,
      });
    }
  };

  const hasRole = (role: string) => {
    return userRoles.some(r => r.role === role);
  };

  return (
    <TenantStoreContext.Provider
      value={{
        currentStore,
        stores,
        userRoles,
        tenantId,
        switchStore,
        hasRole,
        isLoading,
      }}
    >
      {children}
    </TenantStoreContext.Provider>
  );
};

export const useTenantStore = () => {
  const context = useContext(TenantStoreContext);
  if (context === undefined) {
    throw new Error("useTenantStore must be used within a TenantStoreProvider");
  }
  return context;
};
