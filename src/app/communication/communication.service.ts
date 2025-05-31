// src/app/communication/communication.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService, User } from '../auth/auth.service'; // User interface should ideally include photoURL?
import { Observable, from, of, firstValueFrom, BehaviorSubject } from 'rxjs'; // Added BehaviorSubject
import { map, switchMap, tap, catchError, take } from 'rxjs/operators'; // Added take
import firebase from 'firebase/compat/app';

// Chat Message Interface
export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string | null | undefined;
  receiverId: string;
  content: string;
  timestamp: any;
  read: boolean;
  type?: 'text' | 'image' | 'file';
  fileUrl?: string;
  fileName?: string;
}

// For Chat List
export interface ChatSummary {
  id: string;
  partnerId: string;
  partnerName: string | null | undefined;
  partnerAvatarUrl?: string | null; // Matched to User.photoURL
  lastMessageSnippet?: string;
  lastMessageTimestamp?: any;
  unreadCount: number;
}

// Video Call Interface
export interface VideoCall {
  id: string;
  initiatorId: string;
  initiatorName?: string | null;
  receiverId: string;
  receiverName?: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'ended' | 'ongoing' | 'connecting' | 'failed';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: any;
  updatedAt?: any;
  endedAt?: any;
}

// Notification interface
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'message' | 'call' | 'order' | 'status' | string;
  relatedId?: string;
  timestamp: any;
  read: boolean;
  icon?: string;
  link?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private unreadMessagesCount = new BehaviorSubject<number>(0); // Example
  unreadMessagesCount$ = this.unreadMessagesCount.asObservable();

  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService
  ) {
    // Example: Listen to overall unread messages (might be complex)
    // this.authService.currentUser$.subscribe(user => {
    //   if (user) {
    //     // this.updateUnreadMessagesCount(user.uid);
    //   } else {
    //     this.unreadMessagesCount.next(0);
    //   }
    // });
  }

  private getChatId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join('_');
  }

  async sendMessage(senderId: string, receiverId: string, content: string): Promise<string | null> {
    if (!senderId || !receiverId) {
        console.error('Sender or Receiver ID missing.');
        throw new Error('Sender or Receiver ID missing.');
    }
    if (!content || content.trim() === '') {
        console.error('Cannot send an empty message.');
        throw new Error('Cannot send an empty message.');
    }

    const user = await firstValueFrom(this.authService.currentUser$.pipe(take(1)));

    if (!user || user.uid !== senderId) {
        console.error('User mismatch or not authenticated for sending message.');
        throw new Error('User mismatch or not authenticated.');
    }

    const chatId = this.getChatId(senderId, receiverId);
    const messageId = this.firestore.createId();
    const now = firebase.firestore.FieldValue.serverTimestamp();

    const message: ChatMessage = {
      id: messageId,
      chatId: chatId,
      senderId: senderId,
      senderName: user.displayName,
      receiverId: receiverId,
      content: content.trim(),
      timestamp: now,
      read: false
    };

    const messageRef = this.firestore.collection('chats').doc(chatId).collection('messages').doc(messageId);
    const chatMetaRef = this.firestore.collection('chatMeta').doc(chatId);
    const batch = this.firestore.firestore.batch();

    batch.set(messageRef.ref, message);
    batch.set(chatMetaRef.ref, {
      lastMessage: content.trim(),
      lastMessageTimestamp: now,
      participants: [senderId, receiverId],
      [`unreadCount_${receiverId}`]: firebase.firestore.FieldValue.increment(1),
      [`participant_${senderId}_name`]: user.displayName || 'User',
      // Fetch partner's name to store in chatMeta for chat list display
      // This is an example; you might fetch it before this operation or have it passed.
      // For simplicity, using a placeholder or assuming it might be updated by another process.
      // Ideally, partner's name is known when creating/updating chatMeta.
      // For now, let's assume it's handled or we use a placeholder.
      // [`participant_${receiverId}_name`]: 'Partner Name', // Placeholder
    }, { merge: true });

    const notificationId = this.firestore.createId();
    const notification: Notification = {
      id: notificationId,
      userId: receiverId,
      title: `New message from ${user.displayName || 'User'}`,
      body: content.trim().length > 50 ? content.trim().substring(0, 47) + '...' : content.trim(),
      type: 'message',
      relatedId: chatId,
      timestamp: now,
      read: false,
      icon: 'chatbubble-outline'
    };
    const notificationRef = this.firestore.collection('notifications').doc(notificationId);
    batch.set(notificationRef.ref, notification);

    try {
      await batch.commit();
      return messageId;
    } catch (err) {
      console.error("Error sending message and notification:", err);
      return null;
    }
  }

  getMessagesWithUser(currentUserId: string, partnerId: string): Observable<ChatMessage[]> {
    if (!currentUserId || !partnerId) return of([]);
    const chatId = this.getChatId(currentUserId, partnerId);

    return this.firestore.collection('chats').doc(chatId)
      .collection<ChatMessage>('messages', ref => ref.orderBy('timestamp', 'asc'))
      .valueChanges({ idField: 'id' })
      .pipe(
        tap(messages => {
            // Mark messages as read when fetched by the receiver (currentUserId)
            messages.forEach(msg => {
                if (msg.receiverId === currentUserId && !msg.read) {
                    this.markMessageAsRead(chatId, msg.id, currentUserId).subscribe({
                        error: err => console.warn("Failed to mark message as read automatically:", err)
                    });
                }
            });
        }),
        catchError(err => {
          console.error(`Error fetching messages for chat ${chatId}:`, err);
          return of([]);
        })
      );
  }

  getChatList(userId: string): Observable<ChatSummary[]> {
    return this.firestore.collection<any>('chatMeta', ref =>
      ref.where('participants', 'array-contains', userId)
         .orderBy('lastMessageTimestamp', 'desc')
    ).valueChanges({ idField: 'id' })
    .pipe(
      switchMap(async (chatMetas) => {
        const chatSummaries: ChatSummary[] = [];
        for (const meta of chatMetas) {
          const partnerId = meta.participants.find((pId: string) => pId !== userId);
          if (partnerId) {
            const partnerDetails = await firstValueFrom(this.getPartnerDetails(partnerId));
            chatSummaries.push({
              id: meta.id,
              partnerId: partnerId,
              partnerName: partnerDetails.name,
              partnerAvatarUrl: partnerDetails.avatarUrl,
              lastMessageSnippet: meta.lastMessage,
              lastMessageTimestamp: meta.lastMessageTimestamp,
              unreadCount: meta[`unreadCount_${userId}`] || 0
            });
          }
        }
        return chatSummaries;
      }),
      catchError(err => {
        console.error('Error fetching chat list:', err);
        return of([]);
      })
    );
  }

  getPartnerDetails(partnerId: string): Observable<{ name: string; avatarUrl?: string | null }> {
    if (!partnerId) return of({ name: 'Unknown User', avatarUrl: null });
    return this.firestore.doc<User>(`users/${partnerId}`).valueChanges().pipe(
      map(userDoc => {
        if (userDoc) {
          // Assuming User interface might have photoURL in AuthService
          return { name: userDoc.displayName || 'Chat User', avatarUrl: (userDoc as any).photoURL || null };
        }
        return { name: 'Unknown User', avatarUrl: null };
      }),
      catchError(err => {
        console.error(`Error fetching partner details for ${partnerId}:`, err);
        return of({ name: 'Unknown User', avatarUrl: null });
      })
    );
  }

  markMessageAsRead(chatId: string, messageId: string, currentUserId: string): Observable<void> {
    const messageRef = this.firestore.collection('chats').doc(chatId).collection('messages').doc(messageId);
    const chatMetaRef = this.firestore.collection('chatMeta').doc(chatId);
    const batch = this.firestore.firestore.batch();

    batch.update(messageRef.ref, { read: true });
    // Reset unread count for the current user for this chat
    batch.set(chatMetaRef.ref, { [`unreadCount_${currentUserId}`]: 0 }, { merge: true });

    return from(batch.commit()).pipe(
        catchError(err => {
            console.error("Error marking message as read and updating unread count:", err);
            throw err; // Re-throw for the component to potentially handle
        })
    );
  }

  async initiateVideoCall(initiatorId: string, receiverId: string, initiatorName: string | null | undefined, receiverName?: string): Promise<string | null> {
    if (!initiatorId || !receiverId) {
      console.error('Initiator or Receiver ID missing for video call.');
      throw new Error('Initiator or Receiver ID missing.');
    }
    const callId = this.firestore.createId();
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const call: VideoCall = {
      id: callId,
      initiatorId: initiatorId,
      initiatorName: initiatorName || 'Caller',
      receiverId: receiverId,
      receiverName: receiverName || 'Participant',
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };
    const callDocRef = this.firestore.collection('videoCalls').doc(callId);
    const notificationId = this.firestore.createId();
    const notification: Notification = {
      id: notificationId,
      userId: receiverId,
      title: 'Incoming Video Call',
      body: `${call.initiatorName} is calling you...`,
      type: 'call',
      relatedId: callId,
      timestamp: now,
      read: false,
      icon: 'call-outline'
    };
    const notificationRef = this.firestore.collection('notifications').doc(notificationId);
    const batch = this.firestore.firestore.batch();
    batch.set(callDocRef.ref, call);
    batch.set(notificationRef.ref, notification);
    try {
      await batch.commit();
      return callId;
    } catch (error) {
      console.error("Error initiating video call and sending notification:", error);
      return null;
    }
  }

  getVideoCall(callId: string): Observable<VideoCall | null> {
    return this.firestore.doc<VideoCall>(`videoCalls/${callId}`).valueChanges()
      .pipe(
        map(callData => callData || null),
        catchError(error => {
          console.error(`Error fetching video call ${callId}:`, error);
          return of(null);
        })
      );
  }

  updateCallStatus(callId: string, status: VideoCall['status']): Observable<void> {
    const updates: Partial<VideoCall> = {
      status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (status === 'ended') {
        updates.endedAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    return from(this.firestore.doc(`videoCalls/${callId}`).update(updates));
  }

  async sendOffer(callId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const callRef = this.firestore.doc(`videoCalls/${callId}`);
    return callRef.update({ offer, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }

  async sendAnswer(callId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const callRef = this.firestore.doc(`videoCalls/${callId}`);
    return callRef.update({ answer, status: 'ongoing', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }

  async sendIceCandidate(callId: string, currentUserId: string, candidate: RTCIceCandidateInit): Promise<void> {
    try {
      const callDocSnapshot = await firstValueFrom(this.firestore.doc<VideoCall>(`videoCalls/${callId}`).get());
      if (!callDocSnapshot || !callDocSnapshot.exists) {
        throw new Error('Call document not found for sending ICE candidate.');
      }
      const callData = callDocSnapshot.data() as VideoCall;
      const otherUserId = currentUserId === callData.initiatorId ? callData.receiverId : callData.initiatorId;
      const candidatesCollectionPath = `videoCalls/${callId}/iceCandidatesFor_${otherUserId}`;
      const candidatesCollection = this.firestore.collection(candidatesCollectionPath);
      await candidatesCollection.add({ ...candidate, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    } catch (err) {
      console.error(`Error sending ICE candidate for call ${callId}:`, err);
    }
  }

  getIceCandidates(callId: string, currentUserId: string): Observable<RTCIceCandidateInit[]> {
    const candidatesCollectionPath = `videoCalls/${callId}/iceCandidatesFor_${currentUserId}`;
    return this.firestore.collection<RTCIceCandidateInit>(candidatesCollectionPath, ref =>
      ref.orderBy('createdAt', 'asc')
    ).valueChanges({ idField: 'candidateDocId' })
    .pipe(
      tap(candidates => console.log(`Received ${candidates.length} ICE candidates from ${candidatesCollectionPath}`)),
      catchError(err => {
          console.error(`Error fetching ICE candidates from ${candidatesCollectionPath}:`, err);
          return of([]);
      })
    );
  }

  getNotifications(userId: string): Observable<Notification[]> {
    return this.firestore.collection<Notification>('notifications', ref =>
      ref.where('userId', '==', userId)
         .orderBy('timestamp', 'desc')
    ).valueChanges({ idField: 'id' })
    .pipe(
        catchError(err => {
            console.error(`Error fetching notifications for user ${userId}:`, err);
            return of([]);
        })
    );
  }

  markNotificationAsRead(notificationId: string): Observable<void> {
    return from(this.firestore.collection('notifications').doc(notificationId).update({ read: true })).pipe(
        catchError(err => {
            console.error(`Error marking notification ${notificationId} as read:`, err);
            throw err;
        })
    );
  }

  createOrderStatusNotification(userId: string, orderId: string, status: string, statusMessage: string): Observable<string | null> {
    const notificationId = this.firestore.createId();
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const notification: Notification = {
      id: notificationId,
      userId,
      title: `Order Status Update: ${status.toUpperCase()}`,
      body: statusMessage,
      type: 'status',
      relatedId: orderId,
      timestamp: now,
      read: false,
      icon: 'cube-outline'
    };
    return from(
      this.firestore.collection('notifications').doc(notificationId).set(notification)
      .then(() => notificationId)
    ).pipe(
        catchError(err => {
            console.error("Error creating order status notification:", err);
            return of(null);
        })
    );
  }
}

