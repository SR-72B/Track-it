// src/app/communication/chat-list/chat-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common'; // For async pipe, *ngIf, *ngFor
import { IonicModule, LoadingController } from '@ionic/angular'; // For Ionic components, LoadingController

import { Observable, Subscription, of } from 'rxjs';
import { map, first, catchError, finalize, switchMap } from 'rxjs/operators';

import { AuthService, User } from '../../auth/auth.service'; // Ensure User is exported
import { CommunicationService, ChatSummary } from '../communication.service'; // Assuming ChatSummary interface

// Define ChatPartner interface locally or import if defined elsewhere (e.g., in CommunicationService)
// This interface might be similar to ChatSummary from CommunicationService
export interface ChatPartner {
  id: string; // This would be the other user's UID or a unique chat ID
  name: string; // Partner's display name
  lastMessage?: string;
  lastMessageTime?: any; // Can be Date, Firebase Timestamp, or string
  unreadCount: number;
  avatarUrl?: string; // Optional
}

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.component.html',
  styleUrls: ['./chat-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule // For routerLink in the template
  ]
})
export class ChatListComponent implements OnInit, OnDestroy {
  chatPartners$: Observable<ChatPartner[]> = of([]);
  isLoading = true;
  errorMessage: string | null = null;
  currentUser: User | null = null;

  private userSubscription: Subscription | undefined;
  private chatsSubscription: Subscription | undefined;

  constructor(
    private authService: AuthService,
    private communicationService: CommunicationService,
    private router: Router,
    private loadingController: LoadingController // Optional: if you want a full page loader
  ) {}

  ngOnInit() {
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadChats();
      } else {
        this.isLoading = false;
        this.chatPartners$ = of([]);
        this.errorMessage = "Please log in to view chats.";
      }
    });
  }

  async loadChats(refresherEvent?: any) {
    if (!this.currentUser || !this.currentUser.uid) {
      this.isLoading = false;
      this.errorMessage = "User not authenticated. Cannot load chats.";
      if (refresherEvent) refresherEvent.target.complete();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    if (!refresherEvent) {
      // Optional: Show a loader for initial load
      // loader = await this.loadingController.create({ message: 'Loading chats...' });
      // await loader.present();
    }

    // Unsubscribe from previous chats subscription if it exists
    if (this.chatsSubscription) {
        this.chatsSubscription.unsubscribe();
    }

    // In a real app, this would fetch a list of chat summaries or partners
    // based on the current user's ID.
    this.chatPartners$ = this.communicationService.getChatList(this.currentUser.uid).pipe(
      map((chatSummaries: ChatSummary[]) => {
        // Transform ChatSummary to ChatPartner if needed, or use ChatSummary directly
        return chatSummaries.map(summary => ({
          id: summary.partnerId, // Assuming partnerId is the other user's UID or a chat ID
          name: summary.partnerName,
          lastMessage: summary.lastMessageSnippet,
          lastMessageTime: summary.lastMessageTimestamp,
          unreadCount: summary.unreadCount || 0,
          avatarUrl: summary.partnerAvatarUrl
        } as ChatPartner));
      }),
      finalize(async () => {
        this.isLoading = false;
        // if (loader) await loader.dismiss().catch(e => console.warn("Loader dismiss error", e));
        if (refresherEvent) refresherEvent.target.complete();
      }),
      catchError(err => {
        console.error('Error loading chat list:', err);
        this.errorMessage = 'Failed to load chats. Please try again.';
        return of([]); // Return an empty array on error
      })
    );
    // If you need to ensure isLoading is false only after the first emission for the template,
    // and you are using async pipe, finalize is generally correct.
    // If not using async pipe, you'd subscribe here:
    // this.chatsSubscription = this.chatPartners$.subscribe();
  }

  openChat(partnerId: string) {
    if (partnerId) {
      this.router.navigate(['/communication/chat', partnerId]);
    } else {
      console.error("Cannot open chat: Partner ID is missing.");
      // Optionally show a toast or alert
    }
  }

  formatTime(dateInput: any): string {
    if (!dateInput) return '';
    let d: Date;

    if (dateInput && typeof dateInput.seconds === 'number') { // Firebase Timestamp
      d = new Date(dateInput.seconds * 1000 + (dateInput.nanoseconds || 0) / 1000000);
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      d = new Date(dateInput); // Attempt to parse if string or number
    }

    if (isNaN(d.getTime())) {
      return 'Invalid Date';
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d >= today) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } else if (d >= yesterday) {
      return 'Yesterday';
    } else {
      // For older dates, show month and day, e.g., "May 30"
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  doRefresh(event: any) {
    if (this.currentUser) {
      this.loadChats(event);
    } else {
      event.target.complete(); // Complete refresher if no user
    }
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.chatsSubscription) {
        this.chatsSubscription.unsubscribe();
    }
  }
}

