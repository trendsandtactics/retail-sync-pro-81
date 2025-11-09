-- Create product_batches table for pharmacy batch and expiry tracking
CREATE TABLE public.product_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  batch_number TEXT NOT NULL,
  manufacturing_date DATE,
  expiry_date DATE NOT NULL,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  remaining_quantity INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT unique_batch_per_product UNIQUE(product_id, batch_number, tenant_id)
);

-- Enable RLS
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_batches
CREATE POLICY "Users can view batches in their tenant"
ON public.product_batches
FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert batches in their tenant"
ON public.product_batches
FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update batches in their tenant"
ON public.product_batches
FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners and managers can delete batches"
ON public.product_batches
FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- Add batch_id to sale_items to track which batch was sold
ALTER TABLE public.sale_items
ADD COLUMN batch_id UUID;

-- Trigger for updated_at
CREATE TRIGGER update_product_batches_updated_at
BEFORE UPDATE ON public.product_batches
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster expiry queries
CREATE INDEX idx_product_batches_expiry ON public.product_batches(expiry_date) WHERE is_active = true;
CREATE INDEX idx_product_batches_product ON public.product_batches(product_id) WHERE is_active = true;