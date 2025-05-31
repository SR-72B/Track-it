// src/app/communication/communication.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService, User } from '../auth/auth.service';
import { BehaviorSubject, Observable, from, of } from 'rxjs'; // Added 'of' here
import { map, switchMap, tap } from 'rxjs/operators';

// Chat Message Interface
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  timestamp: any; // Can be Date or Firebase Timestamp
  read: boolean;
}

// Updated Video Call Interface
export interface VideoCall {
  id: string;
  initiatorId: string;
  initiatorName?: string;
  receiverId: string;
  receiverName?: string;
  status: 'pending' | 'accepted' | 'declined' | 'ended';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: any;
  updatedAt?: any;
}

// Notification interface
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'message' | 'call' | 'order' | 'status';
  relatedId?: string;
  timestamp: any;
  read: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
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

  // --- Chat methods ---
  sendMessage(receiverId: string, content: string | null): Observable<string> {
    const user = this.currentUserSubject.value;
    if (!user) return from(Promise.reject(new Error('Not authenticated for sending message')));
    if (!content) return from(Promise.reject(new Error('Cannot send an empty message')));

    const messageId = this.firestore.createId();
    const now = new Date();

    const message: ChatMessage = {
      id: messageId,
      senderId: user.uid,
      senderName: user.displayName || 'User',
      receiverId: receiverId,
      content: content,
      timestamp: now,
      read: false
    };

    return from(
      this.firestore.collection('messages').doc(messageId).set(message)
      .then(() => {
        const notificationId = this.firestore.createId();
        const notification: Notification = {
          id: notificationId,
          userId: receiverId,
          title: `New message from ${user.displayName || 'User'}`,
          body: content.length > 50 ? content.substring(0, 47) + '...' : content,
          type: 'message',
          relatedId: messageId,
          timestamp: now,
          read: false
        };
        return this.firestore.collection('notifications').doc(notificationId).set(notification);
      })
      .then(() => messageId)
    );
  }

  getMessages(otherUserId: string): Observable<ChatMessage[]> {
    const user = this.currentUserSubject.value;
    if (!user) return of([]); // 'of' is used here

    return this.firestore.collection<ChatMessage>('messages', ref =>
      ref.where('senderId', 'in', [user.uid, otherUserId])
         .where('receiverId', 'in', [user.uid, otherUserId])
         .orderBy('timestamp', 'asc')
    ).valueChanges().pipe(
      map(messages => messages.filter(
        msg => (msg.senderId === user.uid && msg.receiverId === otherUserId) ||
               (msg.senderId === otherUserId && msg.receiverId === user.uid)
      ))
    );
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

  // --- Video call methods ---
  initiateVideoCall(receiverId: string, receiverName?: string): Observable<string> {
    const user = this.currentUserSubject.value;
    if (!user) return from(Promise.reject(new Error('Not authenticated to initiate call')));

    const callId = this.firestore.createId();
    const now = new Date();

    const call: VideoCall = {
      id: callId,
      initiatorId: user.uid,
      initiatorName: user.displayName || 'User',
      receiverId: receiverId,
      receiverName: receiverName || 'Participant',
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    return from(
      this.firestore.collection('videoCalls').doc(callId).set(call)
      .then(() => {
        const notificationId = this.firestore.createId();
        const notification: Notification = {
          id: notificationId,
          userId: receiverId,
          title: 'Incoming Video Call',
          body: `${user.displayName || 'User'} is calling you`,
          type: 'call',
          relatedId: callId,
          timestamp: now,
          read: false
        };
        return this.firestore.collection('notifications').doc(notificationId).set(notification);
      })
      .then(() => callId)
    );
  }

  getVideoCall(callId: string): Observable<VideoCall | null> {
    return this.firestore.doc<VideoCall>(`videoCalls/${callId}`).valueChanges() as Observable<VideoCall | null>;
  }

  updateCallStatus(callId: string, status: VideoCall['status']): Observable<void> {
    const updates: Partial<VideoCall> = {
        status,
        updatedAt: new Date()
    };
    return from(this.firestore.doc(`videoCalls/${callId}`).update(updates));
  }

  async sendOffer(callId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const callRef = this.firestore.doc(`videoCalls/${callId}`);
    return callRef.update({ offer, status: 'pending', updatedAt: new Date() });
  }

  async sendAnswer(callId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const callRef = this.firestore.doc(`videoCalls/${callId}`);
    return callRef.update({ answer, updatedAt: new Date() });
  }

  async sendIceCandidate(callId: string, currentUserId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const callDoc = await this.firestore.doc<VideoCall>(`videoCalls/${callId}`).get().toPromise();
    if (!callDoc || !callDoc.exists) {
        throw new Error('Call document not found for sending ICE candidate.');
    }
    const callData = callDoc.data() as VideoCall;
    const otherUserId = currentUserId === callData.initiatorId ? callData.receiverId : callData.initiatorId;

    const candidatesCollectionPath = `videoCalls/${callId}/iceCandidatesFor_${otherUserId}`;
    const candidatesCollection = this.firestore.collection(candidatesCollectionPath);
    return candidatesCollection.add({ ...candidate, createdAt: new Date() })
        .then(() => console.log(`ICE candidate sent to ${candidatesCollectionPath}`))
        .catch(err => console.error(`Error sending ICE candidate to ${candidatesCollectionPath}`, err));
  }

  getIceCandidates(callId: string, currentUserId: string): Observable<RTCIceCandidateInit[]> {
    const candidatesCollectionPath = `videoCalls/${callId}/iceCandidatesFor_${currentUserId}`;
    console.log(`Listening for ICE candidates at: ${candidatesCollectionPath}`);
    return this.firestore.collection<RTCIceCandidateInit>(candidatesCollectionPath, ref =>
      ref.orderBy('createdAt', 'asc')
    ).valueChanges({ idField: 'candidateId' })
    .pipe(
      tap(candidates => console.log(`Received ${candidates.length} ICE candidates from ${candidatesCollectionPath}`, candidates)),
    );
  }

  // --- Notification methods ---
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

    return from(
      this.firestore.collection('notifications').doc(notificationId).set(notification)
      .then(() => notificationId)
    );
  }
}