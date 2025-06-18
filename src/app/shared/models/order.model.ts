// src/app/shared/models/order.model.ts
export interface Order {
    id: string;
    formId: string;
    retailerId: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    purchaseOrder?: string;
    formData: any;
    fileUrls?: string[];
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
    cancellationDeadline?: Date;
  }
  
  export interface OrderUpdate {
    id: string;
    orderId: string;
    status: Order['status'];
    message: string;
    createdAt: Date;
    seenByCustomer: boolean;
  }