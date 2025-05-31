// src/app/communication/notifications/notifications.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core'; // Added OnDestroy
import { Router, RouterModule } from '@angular/router';
import { LoadingController, IonicModule } from '@ionic/angular';
import { Observable, of, Subscription } from 'rxjs'; // Added Subscription
import { finalize, first, catchError, switchMap, tap } from 'rxjs/operators'; // Added switchMap, tap
import { CommonModule } from '@angular/common';

import { AuthService, User as AuthUser } from '../../auth/auth.service'; // Use AuthUser to avoid name clash if User is defined locally
import { CommunicationService, Notification } from '../communication.service';

// Local User interface if needed, or ensure AuthUser from AuthService is sufficient
// If AuthUser is sufficient and has 'uid', this local definition can be removed.
export interface User {
  uid: string;
  // other potential user properties like email, displayName, etc.
}

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications$: Observable<Notification[]> = of([]);
  isLoading = true;
  errorMessage: string | null = null;
  currentUser: AuthUser | null = null; // Use the User type from AuthService

  private loadNotificationsSubscription: Subscription | undefined;
  private currentUserSubscription: Subscription | undefined;


  constructor(
    private authService: AuthService,
    private communicationService: CommunicationService,
    private router: Router,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {
    this.currentUserSubscription = this.authService.currentUser$.subscribe(user => {
        this.currentUser = user; // Keep track of the current user
        if (user && user.uid) {
            this.loadNotifications();
        } else {
            this.isLoading = false;
            this.notifications$ = of([]);
            this.errorMessage = "Please log in to view notifications.";
        }
    });
  }

  async loadNotifications(event?: any) {
    if (!this.currentUser || !this.currentUser.uid) {
      this.isLoading = false;
      this.errorMessage = "User not authenticated. Cannot load notifications.";
      if (event) event.target.complete();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    if (!event) { // Only show full page loader if not a refresher action
      loader = await this.loadingController.create({
        message: 'Loading notifications...',
        spinner: 'crescent'
      });
      await loader.present();
    }

    // Unsubscribe from previous if any, to prevent multiple calls if loadNotifications is called again
    if (this.loadNotificationsSubscription) {
        this.loadNotificationsSubscription.unsubscribe();
    }

    this.notifications$ = this.communicationService.getNotifications(this.currentUser.uid).pipe(
        tap(notifications => {
            if (notifications.length === 0 && !this.errorMessage) {
                // Optionally set a message if no notifications are found,
                // but often it's better to show "No notifications" in the template.
            }
        }),
        finalize(() => {
            this.isLoading = false;
            if (loader) {
            loader.dismiss().catch(e => console.warn('Error dismissing loading:', e));
            }
            if (event) {
            event.target.complete();
            }
        }),
        catchError(err => {
            console.error('Error loading notifications:', err);
            this.errorMessage = 'Failed to load notifications. Please try again.';
            return of([]); // Return empty array on error
        })
    );
    // If you need to perform actions after the first emission (like marking as seen implicitly),
    // you might subscribe here, but for display, async pipe is fine.
    // this.loadNotificationsSubscription = this.notifications$.subscribe();
  }

  handleNotification(notification: Notification) {
    if (!notification || !notification.id) {
      console.error('Invalid notification object received by handleNotification:', notification);
      return;
    }

    // Optimistically navigate and then mark as read, or mark as read first.
    // Marking as read first ensures it's done even if navigation has issues.
    this.communicationService.markNotificationAsRead(notification.id).pipe(
      first(), // Ensure the observable completes
      catchError(err => {
        console.error(`Error marking notification ${notification.id} as read:`, err);
        // Optionally inform user if marking as read fails critically
        return of(null); // Continue navigation even if marking read fails
      })
    ).subscribe(() => {
      console.log(`Notification ${notification.id} marked as read or attempt was made.`);
      // Proceed with navigation after attempting to mark as read
      this.navigateFromNotification(notification);
    });
  }

  private navigateFromNotification(notification: Notification) {
    if (notification.type === 'message' && notification.relatedId) {
      this.router.navigate(['/communication/chat', notification.relatedId]);
    } else if (notification.type === 'call' && notification.relatedId) {
      this.router.navigate(['/communication/video-call', notification.relatedId]);
    } else if ((notification.type === 'order' || notification.type === 'status') && notification.relatedId) {
      // No need to subscribe to isRetailer here again if currentUser already has accountType
      if (this.currentUser && this.currentUser.accountType === 'retailer') {
        this.router.navigate(['/retailer/orders', notification.relatedId]);
      } else {
        this.router.navigate(['/customer/orders', notification.relatedId]);
      }
    } else {
      console.log(`Unhandled notification type: ${notification.type} or missing relatedId.`);
      // Optionally navigate to a default view or show a message
    }
  }

  formatTime(dateInput: any): string {
    if (!dateInput) return 'No date';
    let date: Date;

    if (dateInput && typeof dateInput.toDate === 'function') { // Firebase Timestamp (V9 SDK style)
      date = dateInput.toDate();
    } else if (dateInput && typeof dateInput.seconds === 'number') { // Firebase Timestamp (compat SDK style)
      date = new Date(dateInput.seconds * 1000 + (dateInput.nanoseconds || 0) / 1000000);
    }
    else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      try {
        date = new Date(dateInput);
        if (isNaN(date.getTime())) throw new Error('Invalid date string/number');
      } catch (e) {
        console.warn('Could not parse dateInput:', dateInput, e);
        return 'Invalid date';
      }
    }

    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    // More sophisticated relative time formatting could be added here
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  doRefresh(event: any) {
    if (this.currentUser) {
        this.loadNotifications(event);
    } else {
        event.target.complete();
        this.errorMessage = "Please log in to refresh notifications.";
    }
  }

  ngOnDestroy() {
    if (this.currentUserSubscription) {
      this.currentUserSubscription.unsubscribe();
    }
    if (this.loadNotificationsSubscription) {
        this.loadNotificationsSubscription.unsubscribe();
    }
  }
}

