// src/app/shared/models/order.model.ts

// Define proper field data interface for form data
export interface FieldData {
  key: string;
  value: string | number | boolean | null;
  label?: string;
  type?: string;
}

// Define form data as a strongly typed object
export interface FormData {
  [key: string]: string | number | boolean | null;
}

export interface Order {
  id: string;
  formId: string;
  retailerId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  purchaseOrder?: string;
  formData: FormData; // Properly typed form data instead of any
  fields?: FieldData[]; // Alternative field structure
  customFields?: FieldData[]; // Additional custom fields
  metadata?: FieldData[]; // Metadata fields
  fileUrls?: string[];
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | string; // Added string for flexibility
  notes?: string;
  createdAt: any; // Firestore Timestamp or Date
  updatedAt: any; // Firestore Timestamp or Date
  cancellationDeadline?: any; // Firestore Timestamp or Date
  totalAmount?: number; // Optional total amount
}

export interface OrderUpdate {
  id: string;
  orderId: string;
  status: Order['status'];
  message: string;
  createdAt: any; // Firestore Timestamp or Date
  seenByCustomer: boolean;
  updatedBy?: string; // UID of user who made the update
  updatedByName?: string; // Name of user who made the update
}

// Helper type for order with typed fields
export interface OrderWithTypedFields extends Order {
  fields: FieldData[];
  customFields: FieldData[];
  metadata: FieldData[];
}

// Order status type for better type safety
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

// Order filter interface for queries
export interface OrderFilter {
  status?: OrderStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  customerId?: string;
  retailerId?: string;
}
