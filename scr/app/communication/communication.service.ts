// src/app/communication/communication.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService, User } from '../auth/auth.service';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

// Sendbird chat interface
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

// Video call interface
export interface VideoCall {
  id: string;
  initiatorId: string;
  initiatorName: string;
  recipientId: string;
  recipientName: string;
  status: 'pending' | 'accepted' | 'declined' | 'ended';
  startTime: Date;
  endTime?: Date;
  sessionId: string;
}

// Notification interface
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'message' | 'call' | 'order' | 'status';
  relatedId?: string; // Message ID, Call ID, or Order ID
  timestamp: Date;
  read: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private unreadMessagesCount = new BehaviorSubject<number>(0);
  unreadMessagesCount$ = this.unreadMessagesCount.asObservable();

  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUserSubject.next(user);
      
      if (user) {
        this.updateUnreadMessagesCount(user.uid);
      } else {
        this.unreadMessagesCount.next(0);
      }
    });
  }

  private updateUnreadMessagesCount(userId: string): void {
    this.getUnreadMessages(userId).subscribe(messages => {
      this.unreadMessagesCount.next(messages.length);
    });
  }

  // Chat methods
  sendMessage(recipientId: string, content: string): Observable<string> {
    const user = this.currentUserSubject.value;
    if (!user) return from(Promise.reject(new Error('Not authenticated')));
    
    const messageId = this.firestore.createId();
    const now = new Date();
    
    const message: ChatMessage = {
      id: messageId,
      senderId: user.uid,
      senderName: user.displayName || 'Unknown User',
      receiverId: recipientId,
      content,
      timestamp: now,
      read: false
    };
    
    return from(this.firestore.collection('messages').doc(messageId).set(message)
      .then(() => {
        // Create a notification for the recipient
        const notificationId = this.firestore.createId();
        const notification: Notification = {
          id: notificationId,
          userId: recipientId,
          title: `New message from ${user.displayName || 'Unknown User'}`,
          body: content.length > 50 ? content.substring(0, 50) + '...' : content,
          type: 'message',
          relatedId: messageId,
          timestamp: now,
          read: false
        };
        
        return this.firestore.collection('notifications').doc(notificationId).set(notification)
          .then(() => messageId);
      }));
  }

  getMessages(otherUserId: string): Observable<ChatMessage[]> {
    const user = this.currentUserSubject.value;
    if (!user) return from([]);
    
    return this.firestore.collection<ChatMessage>('messages', ref => 
      ref.where('senderId', 'in', [user.uid, otherUserId])
         .where('receiverId', 'in', [user.uid, otherUserId])
         .orderBy('timestamp', 'asc')
    ).valueChanges();
  }

  getUnreadMessages(userId: string): Observable<ChatMessage[]> {
    return this.firestore.collection<ChatMessage>('messages', ref => 
      ref.where('receiverId', '==', userId)
         .where('read', '==', false)
    ).valueChanges();
  }

  markMessageAsRead(messageId: string): Observable<void> {
    return from(this.firestore.collection('messages').doc(messageId).update({ read: true }));
  }

  // Video call methods
  initiateVideoCall(recipientId: string, recipientName: string): Observable<string> {
    const user = this.currentUserSubject.value;
    if (!user) return from(Promise.reject(new Error('Not authenticated')));
    
    const callId = this.firestore.createId();
    const sessionId = Math.random().toString(36).substring(2, 15);
    const now = new Date();
    
    const call: VideoCall = {
      id: callId,
      initiatorId: user.uid,
      initiatorName: user.displayName || 'Unknown User',
      recipientId,
      recipientName,
      status: 'pending',
      startTime: now,
      sessionId
    };
    
    return from(this.firestore.collection('videoCalls').doc(callId).set(call)
      .then(() => {
        // Create a notification for the recipient
        const notificationId = this.firestore.createId();
        const notification: Notification = {
          id: notificationId,
          userId: recipientId,
          title: 'Incoming Video Call',
          body: `${user.displayName || 'Unknown User'} is calling you`,
          type: 'call',
          relatedId: callId,
          timestamp: now,
          read: false
        };
        
        return this.firestore.collection('notifications').doc(notificationId).set(notification)
          .then(() => callId);
      }));
  }

  getVideoCall(callId: string): Observable<VideoCall> {
    return this.firestore.collection('videoCalls').doc<VideoCall>(callId).valueChanges()
      .pipe(
        map(call => {
          if (!call) throw new Error('Call not found');
          return call;
        })
      );
  }

  updateCallStatus(callId: string, status: VideoCall['status']): Observable<void> {
    const now = new Date();
    const updates: any = { status };
    
    if (status === 'ended') {
      updates.endTime = now;
    }
    
    return from(this.firestore.collection('videoCalls').doc(callId).update(updates));
  }

  // Notification methods
  getNotifications(userId: string): Observable<Notification[]> {
    return this.firestore.collection<Notification>('notifications', ref => 
      ref.where('userId', '==', userId)
         .orderBy('timestamp', 'desc')
    ).valueChanges();
  }

  markNotificationAsRead(notificationId: string): Observable<void> {
    return from(this.firestore.collection('notifications').doc(notificationId).update({ read: true }));
  }

  createOrderStatusNotification(userId: string, orderId: string, status: string, statusMessage: string): Observable<string> {
    const notificationId = this.firestore.createId();
    const now = new Date();
    
    const notification: Notification = {
      id: notificationId,
      userId,
      title: `Order Status Update: ${status.toUpperCase()}`,
      body: statusMessage,
      type: 'status',
      relatedId: orderId,
      timestamp: now,
      read: false
    };
    
    return from(this.firestore.collection('notifications').doc(notificationId).set(notification)
      .then(() => notificationId));
  }
}
