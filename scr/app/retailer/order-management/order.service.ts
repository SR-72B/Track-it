// src/app/retailer/order-management/order.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';

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

  updateOrderStatus(order: Order, status: Order['status'], message: string): Promise<void> {
    const batch = this.firestore.firestore.batch();
    
    // Update the order
    const orderRef = this.firestore.collection('orders').doc(order.id).ref;
    batch.update(orderRef, { 
      status, 
      updatedAt: new Date() 
    });
    
    // Create an order update
    const updateId = this.firestore.createId();
    const updateRef = this.firestore.collection('orderUpdates').doc(updateId).ref;
    const update: OrderUpdate = {
      id: updateId,
      orderId: order.id,
      status,
      message,
      createdAt: new Date(),
      seenByCustomer: false
    };
    batch.set(updateRef, update);
    
    return batch.commit();
  }

  getOrderUpdates(orderId: string): Observable<OrderUpdate[]> {
    return this.firestore.collection<OrderUpdate>('orderUpdates', ref => 
      ref.where('orderId', '==', orderId).orderBy('createdAt', 'desc')
    ).valueChanges();
  }

  cancelOrder(order: Order, reason: string): Promise<void> {
    return this.updateOrderStatus(order, 'cancelled', reason);
  }

  getOrderWithUpdates(orderId: string): Observable<{order: Order, updates: OrderUpdate[]}> {
    return combineLatest([
      this.getOrder(orderId),
      this.getOrderUpdates(orderId)
    ]).pipe(
      map(([order, updates]) => ({order, updates}))
    );
  }
}