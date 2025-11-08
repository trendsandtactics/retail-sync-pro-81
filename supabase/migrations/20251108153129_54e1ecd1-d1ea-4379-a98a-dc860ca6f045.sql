-- Create app_role enum for RBAC
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'cashier', 'accountant', 'auditor');

-- Create tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Create stores table
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  gstin TEXT,
  phone TEXT,
  email TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  currency TEXT DEFAULT 'INR',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tenant_id, role, store_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Function to get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Add tenant_id to profiles
ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add tenant_id and store_id to products
ALTER TABLE public.products ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;

-- Add tenant_id and store_id to sales
ALTER TABLE public.sales ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.sales ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;

-- Update RLS policies for tenants
CREATE POLICY "Users can view their tenant"
  ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners can update their tenant"
  ON public.tenants FOR UPDATE
  USING (id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'owner'));

-- Update RLS policies for stores
CREATE POLICY "Users can view stores in their tenant"
  ON public.stores FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners and managers can insert stores"
  ON public.stores FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid()) 
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Owners and managers can update stores"
  ON public.stores FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Owners can delete stores"
  ON public.stores FOR DELETE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner')
  );

-- Update RLS policies for user_roles
CREATE POLICY "Users can view roles in their tenant"
  ON public.user_roles FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners can manage roles"
  ON public.user_roles FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.has_role(auth.uid(), 'owner')
  );

-- Drop old products RLS policies and create new ones with tenant isolation
DROP POLICY IF EXISTS "Users can view own products" ON public.products;
DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
DROP POLICY IF EXISTS "Users can update own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete own products" ON public.products;

CREATE POLICY "Users can view products in their tenant"
  ON public.products FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert products in their tenant"
  ON public.products FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update products in their tenant"
  ON public.products FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "Owners and managers can delete products"
  ON public.products FOR DELETE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  );

-- Drop old sales RLS policies and create new ones with tenant isolation
DROP POLICY IF EXISTS "Users can view own sales" ON public.sales;
DROP POLICY IF EXISTS "Users can insert own sales" ON public.sales;

CREATE POLICY "Users can view sales in their tenant"
  ON public.sales FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert sales in their tenant"
  ON public.sales FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND user_id = auth.uid()
  );

-- Drop old sale_items RLS policies and create new ones
DROP POLICY IF EXISTS "Users can view own sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Users can insert own sale items" ON public.sale_items;

CREATE POLICY "Users can view sale items in their tenant"
  ON public.sale_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE sales.id = sale_items.sale_id
        AND sales.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "Users can insert sale items in their tenant"
  ON public.sale_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE sales.id = sale_items.sale_id
        AND sales.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- Update profiles RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view profiles in their tenant"
  ON public.profiles FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Update tenants trigger
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to create tenant and assign owner role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_with_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
  new_store_id UUID;
BEGIN
  -- Create a new tenant
  INSERT INTO public.tenants (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'My Business') || '''s Tenant')
  RETURNING id INTO new_tenant_id;

  -- Create a default store
  INSERT INTO public.stores (tenant_id, name)
  VALUES (new_tenant_id, 'Main Store')
  RETURNING id INTO new_store_id;

  -- Create profile with tenant
  INSERT INTO public.profiles (id, full_name, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    new_tenant_id
  );

  -- Assign owner role
  INSERT INTO public.user_roles (user_id, tenant_id, role, store_id)
  VALUES (NEW.id, new_tenant_id, 'owner', new_store_id);

  RETURN NEW;
END;
$$;

-- Replace the old trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_with_tenant();