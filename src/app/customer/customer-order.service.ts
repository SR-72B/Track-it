// src/app/customer/order/customer-order.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, combineLatest, from, of } from 'rxjs';
import { map, switchMap, first, last } from 'rxjs/operators';
import { AuthService, User } from '../auth/auth.service'; // Adjust the import path as necessary';
import { OrderForm } from '../retailer/form-builder/form-builder.service';
import { Order, OrderUpdate } from '../retailer/order-management/order.service';

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
    ).valueChanges({ idField: 'id' });
  }

  getOrderForm(formId: string): Observable<OrderForm | undefined> {
    return this.firestore.collection('orderForms').doc<OrderForm>(formId).valueChanges();
  }

  getCustomerOrders(customerId: string): Observable<Order[]> {
    return this.firestore.collection<Order>('orders', ref => 
      ref.where('customerId', '==', customerId).orderBy('createdAt', 'desc')
    ).valueChanges({ idField: 'id' });
  }

  getOrder(orderId: string): Observable<Order | undefined> {
    return this.firestore.collection('orders').doc<Order>(orderId).valueChanges({ idField: 'id' });
  }

  getOrderUpdates(orderId: string): Observable<OrderUpdate[]> {
    return this.firestore.collection<OrderUpdate>('orderUpdates', ref => 
      ref.where('orderId', '==', orderId).orderBy('createdAt', 'desc')
    ).valueChanges({ idField: 'id' });
  }

  getOrderWithUpdates(orderId: string): Observable<{order: Order, updates: OrderUpdate[]}> {
    return combineLatest([
      this.getOrder(orderId),
      this.getOrderUpdates(orderId)
    ]).pipe(
      map(([order, updates]) => {
        if (!order) throw new Error('Order not found in combined stream');
        return { order, updates };
      })
    );
  }

  async submitOrder(formId: string, formData: any, files: File[] = []): Promise<string> {
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
      purchaseOrder: formData.purchaseOrder || '',
      formData,
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

        // =========================================================================================
        // !!! FIX APPLIED HERE !!!
        // Data from Firestore is a Timestamp object, not a JS Date object.
        // We cast it to 'any' to access the 'seconds' property and convert it to a Date.
        // =========================================================================================
        const deadlineTimestamp = order.cancellationDeadline as any;
        const deadline = new Date(deadlineTimestamp.seconds * 1000);
        
        if (now > deadline) {
          throw new Error('Cancellation deadline has passed');
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
      })
    );
  }
}