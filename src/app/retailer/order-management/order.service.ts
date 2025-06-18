// src/app/retailer/order-management/order.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, combineLatest, of, from } from 'rxjs'; // Added 'from'
import { map, switchMap, catchError } from 'rxjs/operators'; // Added 'catchError'
import { AuthService } from '../../auth/auth.service'; // Assuming path is correct
import firebase from 'firebase/compat/app'; // For serverTimestamp

export interface Order {
  id: string; // Firestore document ID
  formId: string;
  retailerId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string; // Added as optional, used in OrderManagementComponent
  customerPhone?: string; // Made optional as it might not always be present
  purchaseOrder?: string;
  formData: any; // Consider defining a more specific type based on your form fields
  fileUrls?: string[];
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | string; // Allow string for flexibility
  notes?: string;
  createdAt: any; // Firestore Timestamp (or Date if converted on retrieval)
  updatedAt: any; // Firestore Timestamp (or Date if converted on retrieval)
  cancellationDeadline?: any; // Firestore Timestamp or Date
  totalAmount?: number; // Added as optional, used in OrderManagementComponent
  // Add other relevant fields like shippingAddress, items array with details, etc.
  // items?: OrderItem[];
  // shippingAddress?: Address;
}

// Example for OrderItem and Address if you want to structure them
// export interface OrderItem {
//   productId: string;
//   productName: string;
//   quantity: number;
//   price: number;
//   sku?: string;
// }
// export interface Address {
//   street: string;
//   city: string;
//   state: string;
//   postalCode: string;
//   country: string;
// }

export interface OrderUpdate {
  id: string; // Firestore document ID
  orderId: string;
  status: Order['status'];
  message: string;
  createdAt: any; // Firestore Timestamp
  seenByCustomer: boolean;
  updatedBy?: string; // UID of user (e.g., retailer) who made the update
  updatedByName?: string; // Name of user who made the update
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(
    private firestore: AngularFirestore,
    private storage: AngularFireStorage, // Injected but not used in this snippet
    private authService: AuthService // Injected but not used directly in these methods
  ) {}

  getRetailerOrders(retailerId: string): Observable<Order[]> {
    return this.firestore.collection<Order>('orders', ref =>
      ref.where('retailerId', '==', retailerId).orderBy('createdAt', 'desc')
    ).valueChanges({ idField: 'id' }) // Automatically map Firestore doc ID to 'id' field
    .pipe(
      catchError(error => {
        console.error("Error fetching retailer orders:", error);
        return of([]); // Return empty array on error
      })
    );
  }

  getOrder(orderId: string): Observable<Order | undefined> { // Changed to Order | undefined
    return this.firestore.collection('orders').doc<Order>(orderId).valueChanges({ idField: 'id' })
      .pipe(
        map(order => {
          if (!order) {
            console.warn(`Order with ID ${orderId} not found.`);
            return undefined; // Return undefined if not found
          }
          return order;
        }),
        catchError(error => {
          console.error(`Error fetching order ${orderId}:`, error);
          return of(undefined); // Return undefined on error
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
      // Optionally add who updated it
      // updatedBy: this.authService.currentUserSubject.getValue()?.uid,
      // updatedByName: this.authService.currentUserSubject.getValue()?.displayName
    };
    batch.set(updateRef, update);

    return batch.commit();
  }

  getOrderUpdates(orderId: string): Observable<OrderUpdate[]> {
    return this.firestore.collection<OrderUpdate>('orderUpdates', ref =>
      ref.where('orderId', '==', orderId).orderBy('createdAt', 'desc')
    ).valueChanges({ idField: 'id' }) // Automatically map Firestore doc ID to 'id' field
    .pipe(
      catchError(error => {
        console.error(`Error fetching order updates for ${orderId}:`, error);
        return of([]); // Return empty array on error
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
          // If order is undefined (not found or error), we might not want to proceed
          console.warn(`Order ${orderId} not found for getOrderWithUpdates.`);
          return null; // Return null if the main order isn't found
        }
        return { order, updates };
      }),
      catchError(error => {
        console.error(`Error in getOrderWithUpdates for ${orderId}:`, error);
        return of(null); // Return null on combined error
      })
    );
  }
}
