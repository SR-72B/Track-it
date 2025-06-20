// src/app/retailer/order-management/order.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, combineLatest, of, from } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import firebase from 'firebase/compat/app';

// Define proper field data interface
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
  id: string; // Firestore document ID
  formId: string;
  retailerId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  purchaseOrder?: string;
  formData: FormData; // Properly typed form data
  fields?: FieldData[]; // Alternative field structure
  customFields?: FieldData[]; // Additional custom fields
  metadata?: FieldData[]; // Metadata fields
  fileUrls?: string[];
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | string;
  notes?: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  cancellationDeadline?: any; // Firestore Timestamp or Date
  totalAmount?: number;
}

export interface OrderUpdate {
  id: string; // Firestore document ID
  orderId: string;
  status: Order['status'];
  message: string;
  createdAt: any; // Firestore Timestamp
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

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(
    private firestore: AngularFirestore,
    private storage: AngularFireStorage,
    private authService: AuthService
  ) {}

  getRetailerOrders(retailerId: string): Observable<Order[]> {
    return this.firestore.collection<Order>('orders', ref =>
      ref.where('retailerId', '==', retailerId).orderBy('createdAt', 'desc')
    ).valueChanges({ idField: 'id' })
    .pipe(
      map(orders => this.normalizeOrdersFields(orders)),
      catchError(error => {
        console.error("Error fetching retailer orders:", error);
        return of([]);
      })
    );
  }

  getOrder(orderId: string): Observable<Order | undefined> {
    return this.firestore.collection('orders').doc<Order>(orderId).valueChanges({ idField: 'id' })
      .pipe(
        map(order => {
          if (!order) {
            console.warn(`Order with ID ${orderId} not found.`);
            return undefined;
          }
          return this.normalizeOrderFields(order);
        }),
        catchError(error => {
          console.error(`Error fetching order ${orderId}:`, error);
          return of(undefined);
        })
      );
  }

  updateOrderStatus(order: Order, status: Order['status'], message: string): Promise<void> {
    if (!order || !order.id) {
        return Promise.reject(new Error("Order or Order ID is missing."));
    }
    const batch = this.firestore.firestore.batch();
    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();

    const orderRef = this.firestore.collection('orders').doc(order.id).ref;
    batch.update(orderRef, {
      status,
      updatedAt: serverTimestamp
    });

    const updateId = this.firestore.createId();
    const updateRef = this.firestore.collection('orderUpdates').doc(updateId).ref;
    const update: OrderUpdate = {
      id: updateId,
      orderId: order.id,
      status,
      message: message.trim(),
      createdAt: serverTimestamp,
      seenByCustomer: false,
    };
    batch.set(updateRef, update);

    return batch.commit();
  }

  getOrderUpdates(orderId: string): Observable<OrderUpdate[]> {
    return this.firestore.collection<OrderUpdate>('orderUpdates', ref =>
      ref.where('orderId', '==', orderId).orderBy('createdAt', 'desc')
    ).valueChanges({ idField: 'id' })
    .pipe(
      catchError(error => {
        console.error(`Error fetching order updates for ${orderId}:`, error);
        return of([]);
      })
    );
  }

  cancelOrder(order: Order, reason: string): Promise<void> {
    if (!reason || reason.trim() === '') {
        return Promise.reject(new Error("A reason is required to cancel the order."));
    }
    return this.updateOrderStatus(order, 'cancelled', reason.trim());
  }

  getOrderWithUpdates(orderId: string): Observable<{order: Order, updates: OrderUpdate[]} | null> {
    return combineLatest([
      this.getOrder(orderId),
      this.getOrderUpdates(orderId)
    ]).pipe(
      map(([order, updates]) => {
        if (!order) {
          console.warn(`Order ${orderId} not found for getOrderWithUpdates.`);
          return null;
        }
        return { order, updates };
      }),
      catchError(error => {
        console.error(`Error in getOrderWithUpdates for ${orderId}:`, error);
        return of(null);
      })
    );
  }

  // Helper method to normalize order fields to ensure proper typing
  private normalizeOrderFields(order: Order): Order {
    // Ensure formData exists and is properly typed
    if (!order.formData) {
      order.formData = {};
    }

    // Convert any existing field arrays to properly typed arrays
    if ((order as any).fields && Array.isArray((order as any).fields)) {
      order.fields = this.normalizeFieldArray((order as any).fields);
    }

    if ((order as any).customFields && Array.isArray((order as any).customFields)) {
      order.customFields = this.normalizeFieldArray((order as any).customFields);
    }

    if ((order as any).metadata && Array.isArray((order as any).metadata)) {
      order.metadata = this.normalizeFieldArray((order as any).metadata);
    }

    return order;
  }

  // Helper method to normalize multiple orders
  private normalizeOrdersFields(orders: Order[]): Order[] {
    return orders.map(order => this.normalizeOrderFields(order));
  }

  // Helper method to ensure field arrays have proper string keys
  private normalizeFieldArray(fields: any[]): FieldData[] {
    return fields.map(field => ({
      key: String(field.key || ''),
      value: field.value,
      label: field.label,
      type: field.type
    }));
  }

  // Helper method to extract fields from formData as FieldData array
  public getOrderFieldsFromFormData(order: Order): FieldData[] {
    if (!order.formData) return [];
    
    return Object.entries(order.formData).map(([key, value]) => ({
      key: String(key),
      value: value,
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      type: typeof value === 'number' ? 'number' : 
            typeof value === 'boolean' ? 'boolean' : 'text'
    }));
  }
}
