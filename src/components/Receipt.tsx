import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Printer } from "lucide-react";
import { useTenantStore } from "@/hooks/useTenantStore";

interface ReceiptItem {
  id: string;
  name: string;
  sku: string;
  hsn_code: string | null;
  quantity: number;
  selling_price: number;
  tax_rate: number;
  itemTotal: number;
  itemTax: number;
  batch_number?: string;
  expiry_date?: string;
}

interface ReceiptProps {
  invoice: {
    invoice_number: string;
    customer_name?: string;
    customer_phone?: string;
    customer_gstin?: string;
    payment_method: string;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    created_at: string;
    items: ReceiptItem[];
  };
  onPrint?: () => void;
}

export const Receipt = ({ invoice, onPrint }: ReceiptProps) => {
  const { currentStore } = useTenantStore();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open('', '', 'width=800,height=600');
      if (printWindow) {
        const content = printRef.current.innerHTML;
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Invoice ${invoice.invoice_number}</title>
              <style>
                @media print {
                  body { 
                    margin: 0; 
                    padding: 20px;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                  }
                  .no-print { display: none; }
                  table { width: 100%; border-collapse: collapse; }
                  th, td { padding: 8px; text-align: left; border-bottom: 1px dashed #ddd; }
                  .text-right { text-align: right; }
                  .text-center { text-center: center; }
                  .font-bold { font-weight: bold; }
                  .text-lg { font-size: 16px; }
                  .text-sm { font-size: 11px; }
                  .text-xs { font-size: 10px; }
                  .mb-1 { margin-bottom: 4px; }
                  .mb-2 { margin-bottom: 8px; }
                  .mb-4 { margin-bottom: 16px; }
                  .mt-4 { margin-top: 16px; }
                  .border-t { border-top: 2px solid #000; padding-top: 8px; }
                  .border-b { border-bottom: 2px solid #000; padding-bottom: 8px; }
                }
                @page { margin: 10mm; }
              </style>
            </head>
            <body>${content}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
        onPrint?.();
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex justify-end mb-4">
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Receipt
        </Button>
      </div>

      <div ref={printRef} className="bg-white text-black p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4 border-b pb-4">
          <h1 className="text-lg font-bold mb-1">{currentStore?.name || "Store Name"}</h1>
          {currentStore?.address && <p className="text-sm mb-1">{currentStore.address}</p>}
          {currentStore?.phone && <p className="text-sm mb-1">Phone: {currentStore.phone}</p>}
          {currentStore?.email && <p className="text-sm mb-1">Email: {currentStore.email}</p>}
          {currentStore?.gstin && <p className="text-sm">GSTIN: {currentStore.gstin}</p>}
        </div>

        {/* Invoice Details */}
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <div>
              <p className="font-bold">Invoice No:</p>
              <p className="text-sm">{invoice.invoice_number}</p>
            </div>
            <div className="text-right">
              <p className="font-bold">Date:</p>
              <p className="text-sm">{formatDate(invoice.created_at)}</p>
            </div>
          </div>

          {/* Customer Details */}
          {(invoice.customer_name || invoice.customer_phone || invoice.customer_gstin) && (
            <div className="mt-2 border-t pt-2">
              <p className="font-bold mb-1">Customer Details:</p>
              {invoice.customer_name && <p className="text-sm">Name: {invoice.customer_name}</p>}
              {invoice.customer_phone && <p className="text-sm">Phone: {invoice.customer_phone}</p>}
              {invoice.customer_gstin && <p className="text-sm">GSTIN: {invoice.customer_gstin}</p>}
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-2">Item</th>
                <th className="text-center">Qty</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Tax</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2">
                    <div>
                      <div className="font-bold">{item.name}</div>
                      <div className="text-xs text-gray-600">
                        SKU: {item.sku}
                        {item.hsn_code && ` | HSN: ${item.hsn_code}`}
                      </div>
                      {item.batch_number && (
                        <div className="text-xs text-gray-600">
                          Batch: {item.batch_number}
                          {item.expiry_date && ` | Exp: ${new Date(item.expiry_date).toLocaleDateString('en-IN')}`}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">₹{item.selling_price.toFixed(2)}</td>
                  <td className="text-right">
                    {item.tax_rate}%
                    <div className="text-xs">₹{item.itemTax.toFixed(2)}</div>
                  </td>
                  <td className="text-right font-bold">₹{(item.itemTotal + item.itemTax).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t-2 border-black pt-2 mb-4">
          <div className="flex justify-between mb-1">
            <span>Subtotal:</span>
            <span>₹{invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Tax:</span>
            <span>₹{invoice.tax_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t mt-2 pt-2">
            <span>Total:</span>
            <span>₹{invoice.total_amount.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div className="mb-4 text-sm">
          <p className="font-bold">Payment Method:</p>
          <p className="capitalize">{invoice.payment_method}</p>
        </div>

        {/* Footer */}
        <div className="text-center border-t pt-4 mt-4 text-xs">
          <p className="mb-1">Thank you for your business!</p>
          <p>This is a computer-generated invoice</p>
        </div>
      </div>
    </div>
  );
};
