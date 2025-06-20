// src/app/communication/communication.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService, User } from '../auth/auth.service';
import { Observable, from, of, firstValueFrom, BehaviorSubject, combineLatest } from 'rxjs';
import { map, switchMap, tap, catchError, take, filter } from 'rxjs/operators';
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
  editedAt?: any;
  deleted?: boolean;
}

// For Chat List
export interface ChatSummary {
  id: string;
  partnerId: string;
  partnerName: string | null | undefined;
  partnerAvatarUrl?: string | null;
  lastMessageSnippet?: string;
  lastMessageTimestamp?: any;
  unreadCount: number;
  isOnline?: boolean;
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
  duration?: number; // in seconds
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
  priority?: 'low' | 'normal' | 'high';
}

// Chat metadata interface
export interface ChatMeta {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTimestamp: any;
  [key: string]: any; // For dynamic unreadCount_userId properties
}

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private unreadMessagesCount = new BehaviorSubject<number>(0);
  unreadMessagesCount$ = this.unreadMessagesCount.asObservable();

  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService
  ) {
    this.initializeUnreadCountListener();
  }

  /**
   * Initialize listener for unread messages count
   */
  private initializeUnreadCountListener(): void {
    this.authService.currentUser$.pipe(
      filter(user => !!user),
      switchMap(user => this.getTotalUnreadCount(user!.uid))
    ).subscribe({
      next: (count) => this.unreadMessagesCount.next(count),
      error: (error) => {
        console.error('Error updating unread messages count:', error);
        this.unreadMessagesCount.next(0);
      }
    });
  }

  /**
   * Get total unread messages count for a user
   */
  private getTotalUnreadCount(userId: string): Observable<number> {
    return this.firestore.collection<ChatMeta>('chatMeta', ref =>
      ref.where('participants', 'array-contains', userId)
    ).valueChanges().pipe(
      map(chatMetas => {
        return chatMetas.reduce((total, meta) => {
          return total + (meta[`unreadCount_${userId}`] || 0);
        }, 0);
      }),
      catchError(error => {
        console.error('Error calculating total unread count:', error);
        return of(0);
      })
    );
  }

  /**
   * Generate consistent chat ID from two user IDs
   */
  private getChatId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join('_');
  }

  /**
   * Send a message to another user
   */
  async sendMessage(senderId: string, receiverId: string, content: string, type: 'text' | 'image' | 'file' = 'text', fileUrl?: string, fileName?: string): Promise<string | null> {
    // Validation
    if (!senderId || !receiverId) {
      throw new Error('Sender and Receiver IDs are required.');
    }
    if (!content || content.trim() === '') {
      throw new Error('Message content cannot be empty.');
    }
    if (senderId === receiverId) {
      throw new Error('Cannot send message to yourself.');
    }

    try {
      const user = await firstValueFrom(this.authService.currentUser$.pipe(take(1)));

      if (!user || user.uid !== senderId) {
        throw new Error('User authentication mismatch.');
      }

      const chatId = this.getChatId(senderId, receiverId);
      const messageId = this.firestore.createId();
      const now = firebase.firestore.FieldValue.serverTimestamp();

      // Get receiver details for notification
      const receiverDetails = await firstValueFrom(this.getPartnerDetails(receiverId));

      const message: ChatMessage = {
        id: messageId,
        chatId: chatId,
        senderId: senderId,
        senderName: user.displayName,
        receiverId: receiverId,
        content: content.trim(),
        timestamp: now,
        read: false,
        type: type,
        fileUrl: fileUrl,
        fileName: fileName
      };

      const batch = this.firestore.firestore.batch();

      // Add message
      const messageRef = this.firestore.collection('chats').doc(chatId).collection('messages').doc(messageId);
      batch.set(messageRef.ref, message);

      // Update chat metadata
      const chatMetaRef = this.firestore.collection('chatMeta').doc(chatId);
      const chatMetaUpdate: Partial<ChatMeta> = {
        lastMessage: type === 'text' ? content.trim() : `Sent a ${type}`,
        lastMessageTimestamp: now,
        participants: [senderId, receiverId],
        [`unreadCount_${receiverId}`]: firebase.firestore.FieldValue.increment(1),
        [`participant_${senderId}_name`]: user.displayName || 'User',
        [`participant_${receiverId}_name`]: receiverDetails.name || 'User'
      };
      batch.set(chatMetaRef.ref, chatMetaUpdate, { merge: true });

      // Create notification
      const notificationId = this.firestore.createId();
      const notification: Notification = {
        id: notificationId,
        userId: receiverId,
        title: `New message from ${user.displayName || 'User'}`,
        body: type === 'text' ? 
          (content.trim().length > 50 ? content.trim().substring(0, 47) + '...' : content.trim()) :
          `Sent a ${type}`,
        type: 'message',
        relatedId: chatId,
        timestamp: now,
        read: false,
        icon: 'chatbubble-outline',
        priority: 'normal'
      };
      const notificationRef = this.firestore.collection('notifications').doc(notificationId);
      batch.set(notificationRef.ref, notification);

      await batch.commit();
      return messageId;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * Get messages between current user and another user
   */
  getMessagesWithUser(currentUserId: string, partnerId: string): Observable<ChatMessage[]> {
    if (!currentUserId || !partnerId) {
      return of([]);
    }

    const chatId = this.getChatId(currentUserId, partnerId);

    return this.firestore.collection('chats').doc(chatId)
      .collection<ChatMessage>('messages', ref => ref.orderBy('timestamp', 'asc'))
      .valueChanges({ idField: 'id' })
      .pipe(
        tap(messages => {
          // Auto-mark messages as read when fetched by receiver
          const unreadMessages = messages.filter(msg => 
            msg.receiverId === currentUserId && !msg.read
          );
          
          if (unreadMessages.length > 0) {
            this.markAllMessagesAsRead(chatId, currentUserId).subscribe({
              error: err => console.warn("Failed to mark messages as read:", err)
            });
          }
        }),
        map(messages => messages.filter(msg => !msg.deleted)), // Filter out deleted messages
        catchError(err => {
          console.error(`Error fetching messages for chat ${chatId}:`, err);
          return of([]);
        })
      );
  }

  /**
   * Get chat list for a user
   */
  getChatList(userId: string): Observable<ChatSummary[]> {
    if (!userId) {
      return of([]);
    }

    return this.firestore.collection<ChatMeta>('chatMeta', ref =>
      ref.where('participants', 'array-contains', userId)
         .orderBy('lastMessageTimestamp', 'desc')
    ).valueChanges({ idField: 'id' })
    .pipe(
      switchMap(async (chatMetas) => {
        const chatSummaries: ChatSummary[] = [];
        
        for (const meta of chatMetas) {
          const partnerId = meta.participants.find((pId: string) => pId !== userId);
          if (partnerId) {
            try {
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
            } catch (error) {
              console.warn(`Error getting partner details for ${partnerId}:`, error);
              // Add chat with fallback data
              chatSummaries.push({
                id: meta.id,
                partnerId: partnerId,
                partnerName: 'Unknown User',
                partnerAvatarUrl: null,
                lastMessageSnippet: meta.lastMessage,
                lastMessageTimestamp: meta.lastMessageTimestamp,
                unreadCount: meta[`unreadCount_${userId}`] || 0
              });
            }
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

  /**
   * Get partner details for chat display
   */
  getPartnerDetails(partnerId: string): Observable<{ name: string; avatarUrl?: string | null }> {
    if (!partnerId) {
      return of({ name: 'Unknown User', avatarUrl: null });
    }

    return this.firestore.doc<User>(`users/${partnerId}`).valueChanges().pipe(
      map(userDoc => {
        if (userDoc) {
          return { 
            name: userDoc.displayName || 'Chat User', 
            avatarUrl: userDoc.profileImageUrl || null 
          };
        }
        return { name: 'Unknown User', avatarUrl: null };
      }),
      catchError(err => {
        console.error(`Error fetching partner details for ${partnerId}:`, err);
        return of({ name: 'Unknown User', avatarUrl: null });
      })
    );
  }

  /**
   * Mark all messages in a chat as read for a user
   */
  markAllMessagesAsRead(chatId: string, currentUserId: string): Observable<void> {
    const chatMetaRef = this.firestore.collection('chatMeta').doc(chatId);
    
    return from(chatMetaRef.update({
      [`unreadCount_${currentUserId}`]: 0
    })).pipe(
      catchError(err => {
        console.error("Error marking messages as read:", err);
        throw err;
      })
    );
  }

  /**
   * Mark a specific message as read
   */
  markMessageAsRead(chatId: string, messageId: string, currentUserId: string): Observable<void> {
    const messageRef = this.firestore.collection('chats').doc(chatId).collection('messages').doc(messageId);
    
    return from(messageRef.update({ read: true })).pipe(
      catchError(err => {
        console.error("Error marking message as read:", err);
        throw err;
      })
    );
  }

  /**
   * Delete a message
   */
  deleteMessage(chatId: string, messageId: string, userId: string): Observable<void> {
    const messageRef = this.firestore.collection('chats').doc(chatId).collection('messages').doc(messageId);
    
    return from(messageRef.update({ 
      deleted: true,
      content: 'This message was deleted',
      deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
      deletedBy: userId
    })).pipe(
      catchError(err => {
        console.error("Error deleting message:", err);
        throw err;
      })
    );
  }

  /**
   * Initiate a video call
   */
  async initiateVideoCall(initiatorId: string, receiverId: string, initiatorName?: string, receiverName?: string): Promise<string | null> {
    if (!initiatorId || !receiverId) {
      throw new Error('Initiator and Receiver IDs are required.');
    }
    if (initiatorId === receiverId) {
      throw new Error('Cannot call yourself.');
    }

    try {
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

      const batch = this.firestore.firestore.batch();

      // Create call document
      const callDocRef = this.firestore.collection('videoCalls').doc(callId);
      batch.set(callDocRef.ref, call);

      // Create notification
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
        icon: 'call-outline',
        priority: 'high'
      };
      const notificationRef = this.firestore.collection('notifications').doc(notificationId);
      batch.set(notificationRef.ref, notification);

      await batch.commit();
      return callId;
    } catch (error) {
      console.error("Error initiating video call:", error);
      throw error;
    }
  }

  /**
   * Get video call details
   */
  getVideoCall(callId: string): Observable<VideoCall | null> {
    if (!callId) {
      return of(null);
    }

    return this.firestore.doc<VideoCall>(`videoCalls/${callId}`).valueChanges().pipe(
      map(callData => callData || null),
      catchError(error => {
        console.error(`Error fetching video call ${callId}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Update video call status
   */
  updateCallStatus(callId: string, status: VideoCall['status'], duration?: number): Observable<void> {
    if (!callId) {
      return from(Promise.reject(new Error('Call ID is required')));
    }

    const updates: Partial<VideoCall> = {
      status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (status === 'ended') {
      updates.endedAt = firebase.firestore.FieldValue.serverTimestamp();
      if (duration) {
        updates.duration = duration;
      }
    }

    return from(this.firestore.doc(`videoCalls/${callId}`).update(updates)).pipe(
      catchError(error => {
        console.error(`Error updating call status for ${callId}:`, error);
        throw error;
      })
    );
  }

  /**
   * Send WebRTC offer
   */
  async sendOffer(callId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    if (!callId || !offer) {
      throw new Error('Call ID and offer are required');
    }

    try {
      const callRef = this.firestore.doc(`videoCalls/${callId}`);
      await callRef.update({ 
        offer, 
        status: 'connecting',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp() 
      });
    } catch (error) {
      console.error('Error sending offer:', error);
      throw error;
    }
  }

  /**
   * Send WebRTC answer
   */
  async sendAnswer(callId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    if (!callId || !answer) {
      throw new Error('Call ID and answer are required');
    }

    try {
      const callRef = this.firestore.doc(`videoCalls/${callId}`);
      await callRef.update({ 
        answer, 
        status: 'ongoing', 
        updatedAt: firebase.firestore.FieldValue.serverTimestamp() 
      });
    } catch (error) {
      console.error('Error sending answer:', error);
      throw error;
    }
  }

  /**
   * Send ICE candidate
   */
  async sendIceCandidate(callId: string, currentUserId: string, candidate: RTCIceCandidateInit): Promise<void> {
    if (!callId || !currentUserId || !candidate) {
      throw new Error('Call ID, user ID, and candidate are required');
    }

    try {
      const callDocSnapshot = await firstValueFrom(this.firestore.doc<VideoCall>(`videoCalls/${callId}`).get());
      
      if (!callDocSnapshot || !callDocSnapshot.exists) {
        throw new Error('Call document not found');
      }

      const callData = callDocSnapshot.data() as VideoCall;
      const otherUserId = currentUserId === callData.initiatorId ? callData.receiverId : callData.initiatorId;
      const candidatesCollectionPath = `videoCalls/${callId}/iceCandidatesFor_${otherUserId}`;
      
      await this.firestore.collection(candidatesCollectionPath).add({ 
        ...candidate, 
        createdAt: firebase.firestore.FieldValue.serverTimestamp() 
      });
    } catch (error) {
      console.error(`Error sending ICE candidate for call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Get ICE candidates for a call
   */
  getIceCandidates(callId: string, currentUserId: string): Observable<RTCIceCandidateInit[]> {
    if (!callId || !currentUserId) {
      return of([]);
    }

    const candidatesCollectionPath = `videoCalls/${callId}/iceCandidatesFor_${currentUserId}`;
    
    return this.firestore.collection<RTCIceCandidateInit>(candidatesCollectionPath, ref =>
      ref.orderBy('createdAt', 'asc')
    ).valueChanges({ idField: 'candidateDocId' })
    .pipe(
      catchError(err => {
        console.error(`Error fetching ICE candidates from ${candidatesCollectionPath}:`, err);
        return of([]);
      })
    );
  }

  /**
   * Get notifications for a user
   */
  getNotifications(userId: string): Observable<Notification[]> {
    if (!userId) {
      return of([]);
    }

    return this.firestore.collection<Notification>('notifications', ref =>
      ref.where('userId', '==', userId)
         .orderBy('timestamp', 'desc')
         .limit(50) // Limit to recent notifications
    ).valueChanges({ idField: 'id' })
    .pipe(
      catchError(err => {
        console.error(`Error fetching notifications for user ${userId}:`, err);
        return of([]);
      })
    );
  }

  /**
   * Mark notification as read
   */
  markNotificationAsRead(notificationId: string): Observable<void> {
    if (!notificationId) {
      return from(Promise.reject(new Error('Notification ID is required')));
    }

    return from(this.firestore.collection('notifications').doc(notificationId).update({ 
      read: true,
      readAt: firebase.firestore.FieldValue.serverTimestamp()
    })).pipe(
      catchError(err => {
        console.error(`Error marking notification ${notificationId} as read:`, err);
        throw err;
      })
    );
  }

  /**
   * Create order status notification
   */
  createOrderStatusNotification(userId: string, orderId: string, status: string, statusMessage: string): Observable<string | null> {
    if (!userId || !orderId || !status || !statusMessage) {
      return of(null);
    }

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
      icon: 'cube-outline',
      priority: 'normal'
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

  /**
   * Delete notification
   */
  deleteNotification(notificationId: string): Observable<void> {
    if (!notificationId) {
      return from(Promise.reject(new Error('Notification ID is required')));
    }

    return from(this.firestore.collection('notifications').doc(notificationId).delete()).pipe(
      catchError(err => {
        console.error(`Error deleting notification ${notificationId}:`, err);
        throw err;
      })
    );
  }

  /**
   * Get unread notifications count
   */
  getUnreadNotificationsCount(userId: string): Observable<number> {
    if (!userId) {
      return of(0);
    }

    return this.firestore.collection<Notification>('notifications', ref =>
      ref.where('userId', '==', userId)
         .where('read', '==', false)
    ).valueChanges().pipe(
      map(notifications => notifications.length),
      catchError(err => {
        console.error(`Error fetching unread notifications count for user ${userId}:`, err);
        return of(0);
      })
    );
  }
}

