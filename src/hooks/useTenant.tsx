import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useTenant = () => {
  return useQuery({
    queryKey: ["tenant"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          tenant_id,
          role,
          store_id,
          tenants (
            id,
            name,
            plan,
            settings
          ),
          stores (
            id,
            name,
            address,
            gstin
          )
        `)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });
};

export const useStores = () => {
  return useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });
};

export const useCurrentStore = () => {
  const storageKey = "current_store_id";
  
  const getCurrentStoreId = () => {
    return localStorage.getItem(storageKey);
  };

  const setCurrentStoreId = (storeId: string) => {
    localStorage.setItem(storageKey, storeId);
  };

  return { getCurrentStoreId, setCurrentStoreId };
};
