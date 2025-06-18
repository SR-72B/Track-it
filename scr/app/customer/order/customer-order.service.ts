// src/app/customer/order/customer-order.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, combineLatest, from, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import { OrderForm } from '../../retailer/form-builder/form-builder.service';
import { Order, OrderUpdate } from '../../retailer/order-management/order.service';

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
    ).valueChanges();
  }

  getOrderForm(formId: string): Observable<OrderForm> {
    return this.firestore.collection('orderForms').doc<OrderForm>(formId).valueChanges()
      .pipe(
        map(form => {
          if (!form) throw new Error('Form not found');
          return form;
        })
      );
  }

  getCustomerOrders(customerId: string): Observable<Order[]> {
    return this.firestore.collection<Order>('orders', ref => 
      ref.where('customerId', '==', customerId).orderBy('createdAt', 'desc')
    ).valueChanges();
  }

  getOrder(orderId: string): Observable<Order> {
    return this.firestore.collection('orders').doc<Order>(orderId).valueChanges()
      .pipe(
        map(order => {
          if (!order) throw new Error('Order not found');
          return order;
        })
      );
  }

  getOrderUpdates(orderId: string): Observable<OrderUpdate[]> {
    return this.firestore.collection<OrderUpdate>('orderUpdates', ref => 
      ref.where('orderId', '==', orderId).orderBy('createdAt', 'desc')
    ).valueChanges();
  }

  getOrderWithUpdates(orderId: string): Observable<{order: Order, updates: OrderUpdate[]}> {
    return combineLatest([
      this.getOrder(orderId),
      this.getOrderUpdates(orderId)
    ]).pipe(
      map(([order, updates]) => ({order, updates}))
    );
  }

  async submitOrder(formId: string, formData: any, files: File[] = []): Promise<string> {
    // Get the current user
    const user = await this.authService.currentUser$.pipe(first()).toPromise();
    if (!user) throw new Error('User not authenticated');
    
    // Get the form to identify the retailer
    const form = await this.getOrderForm(formId).pipe(first()).toPromise();
    
    // Upload files if any
    const fileUrls: string[] = [];
    
    if (files.length > 0) {
      for (const file of files) {
        const path = `orders/${user.uid}/${Date.now()}_${file.name}`;
        const fileRef = this.storage.ref(path);
        const task = this.storage.upload(path, file);
        
        // Wait for the upload to complete
        await task.snapshotChanges().pipe(
          last(),
          switchMap(() => fileRef.getDownloadURL())
        ).toPromise().then(url => {
          fileUrls.push(url);
        });
      }
    }
    
    // Create the order
    const orderId = this.firestore.createId();
    const now = new Date();
    
    // Calculate cancellation deadline based on retailer's policy
    // For this example, we'll set it to 24 hours from now
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
    
    // Create an initial order update
    const updateId = this.firestore.createId();
    const update: OrderUpdate = {
      id: updateId,
      orderId,
      status: 'pending',
      message: 'Order received and is pending review by the retailer.',
      createdAt: now,
      seenByCustomer: true
    };
    
    // Use a batch write to create both documents
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
        // Check if past the cancellation deadline
        const now = new Date();
        const deadline = new Date(order.cancellationDeadline.seconds ? 
          order.cancellationDeadline.seconds * 1000 : 
          order.cancellationDeadline);
        
        if (now > deadline) {
          throw new Error('Cancellation deadline has passed');
        }
        
        // Update order status
        const batch = this.firestore.firestore.batch();
        
        // Update the order
        const orderRef = this.firestore.collection('orders').doc(order.id).ref;
        batch.update(orderRef, { 
          status: 'cancelled', 
          updatedAt: now 
        });
        
        // Create an order update
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
      switchMap(updates => {
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
