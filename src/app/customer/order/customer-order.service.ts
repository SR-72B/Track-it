// src/app/customer/order/customer-order.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, combineLatest, from, of } from 'rxjs';
import { map, switchMap, first, last, catchError } from 'rxjs/operators';
import { AuthService, User } from '../../auth/auth.service';
import { OrderForm } from '../../retailer/form-builder/form-builder.service';
import { Order, OrderUpdate, FieldData, FormData } from '../../retailer/order-management/order.service';

@Injectable({
  providedIn: 'root'
})
export class CustomerOrderService {
  constructor(
    private firestore: AngularFirestore,
    private storage: AngularFireStorage,
    private authService: AuthService
  ) {}

  getActiveForms(): Observable<OrderForm[]> {
    return this.firestore.collection<OrderForm>('orderForms', ref => 
      ref.where('active', '==', true)
    ).valueChanges({ idField: 'id' })
    .pipe(
      catchError(error => {
        console.error('Error fetching active forms:', error);
        return of([]);
      })
    );
  }

  getOrderForm(formId: string): Observable<OrderForm | undefined> {
    return this.firestore.collection('orderForms').doc<OrderForm>(formId).valueChanges()
      .pipe(
        catchError(error => {
          console.error(`Error fetching order form ${formId}:`, error);
          return of(undefined);
        })
      );
  }

  getCustomerOrders(customerId: string): Observable<Order[]> {
    return this.firestore.collection<Order>('orders', ref => 
      ref.where('customerId', '==', customerId).orderBy('createdAt', 'desc')
    ).valueChanges({ idField: 'id' })
    .pipe(
      map(orders => this.normalizeOrdersFields(orders)),
      catchError(error => {
        console.error('Error fetching customer orders:', error);
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

  async submitOrder(formId: string, formData: FormData, files: File[] = []): Promise<string> {
    const user = await this.authService.currentUser$.pipe(first()).toPromise();
    if (!user) throw new Error('User not authenticated');
    
    const form = await this.getOrderForm(formId).pipe(first()).toPromise();
    if (!form) throw new Error('Form configuration not found');
    
    const fileUrls: string[] = [];
    if (files.length > 0) {
      for (const file of files) {
        const path = `orders/${user.uid}/${Date.now()}_${file.name}`;
        const fileRef = this.storage.ref(path);
        const task = this.storage.upload(path, file);
        
        const url = await task.snapshotChanges().pipe(
          last(),
          switchMap(() => fileRef.getDownloadURL())
        ).toPromise();
        fileUrls.push(url);
      }
    }
    
    const orderId = this.firestore.createId();
    const now = new Date();
    
    const cancellationDeadline = new Date();
    cancellationDeadline.setHours(cancellationDeadline.getHours() + 24);
    
    const order: Order = {
      id: orderId,
      formId,
      retailerId: form.retailerId,
      customerId: user.uid,
      customerName: user.displayName || 'Anonymous',
      customerEmail: user.email,
      customerPhone: user.phoneNumber || '',
      purchaseOrder: (formData as any).purchaseOrder || '',
      formData: this.normalizeFormData(formData),
      fileUrls,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      cancellationDeadline
    };
    
    const updateId = this.firestore.createId();
    const update: OrderUpdate = {
      id: updateId,
      orderId,
      status: 'pending',
      message: 'Order received and is pending review by the retailer.',
      createdAt: now,
      seenByCustomer: true
    };
    
    const batch = this.firestore.firestore.batch();
    batch.set(this.firestore.collection('orders').doc(orderId).ref, order);
    batch.set(this.firestore.collection('orderUpdates').doc(updateId).ref, update);
    
    await batch.commit();
    
    return orderId;
  }

  cancelOrder(orderId: string, reason: string): Observable<void> {
    return this.getOrder(orderId).pipe(
      first(),
      switchMap(order => {
        if (!order) {
          throw new Error('Order not found or you do not have permission to view it.');
        }

        const now = new Date();
        let deadline: Date;

        // Handle Firestore Timestamp conversion safely
        const deadlineInput = order.cancellationDeadline as any;
        if (deadlineInput && typeof deadlineInput.seconds === 'number') {
          deadline = new Date(deadlineInput.seconds * 1000 + (deadlineInput.nanoseconds || 0) / 1000000);
        } else if (deadlineInput instanceof Date) {
          deadline = deadlineInput;
        } else {
          deadline = new Date(deadlineInput);
        }
        
        if (isNaN(deadline.getTime()) || now > deadline) {
          throw new Error('Cancellation deadline has passed or is invalid');
        }
        
        const batch = this.firestore.firestore.batch();
        
        const orderRef = this.firestore.collection('orders').doc(order.id).ref;
        batch.update(orderRef, { 
          status: 'cancelled', 
          updatedAt: now 
        });
        
        const updateId = this.firestore.createId();
        const updateRef = this.firestore.collection('orderUpdates').doc(updateId).ref;
        const update: OrderUpdate = {
          id: updateId,
          orderId: order.id,
          status: 'cancelled',
          message: `Order cancelled by customer. Reason: ${reason}`,
          createdAt: now,
          seenByCustomer: true
        };
        batch.set(updateRef, update);
        
        return from(batch.commit());
      }),
      catchError(error => {
        console.error('Error cancelling order:', error);
        throw error;
      })
    );
  }

  markUpdatesSeen(orderId: string): Observable<void> {
    return this.getOrderUpdates(orderId).pipe(
      first(),
      switchMap((updates: OrderUpdate[]) => {
        const batch = this.firestore.firestore.batch();
        const unseenUpdates = updates.filter(update => !update.seenByCustomer);
        
        unseenUpdates.forEach(update => {
          const updateRef = this.firestore.collection('orderUpdates').doc(update.id).ref;
          batch.update(updateRef, { seenByCustomer: true });
        });
        
        if (unseenUpdates.length > 0) {
          return from(batch.commit());
        } else {
          return of(undefined);
        }
      }),
      catchError(error => {
        console.error('Error marking updates as seen:', error);
        return of(undefined);
      })
    );
  }

  // Helper method to normalize order fields to ensure proper typing
  private normalizeOrderFields(order: Order): Order {
    // Ensure formData exists and is properly typed
    if (!order.formData) {
      order.formData = {};
    } else {
      order.formData = this.normalizeFormData(order.formData);
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

  // Helper method to normalize form data
  private normalizeFormData(formData: any): FormData {
    if (!formData || typeof formData !== 'object') {
      return {};
    }

    const normalized: FormData = {};
    Object.entries(formData).forEach(([key, value]) => {
      normalized[String(key)] = value as string | number | boolean | null;
    });

    return normalized;
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
