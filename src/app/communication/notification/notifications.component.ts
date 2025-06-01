// src/app/communication/notifications/notifications.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core'; // Added ChangeDetectorRef
import { Router, RouterModule } from '@angular/router';
import { LoadingController, IonicModule, ToastController } from '@ionic/angular'; // Added ToastController
import { Observable, of, Subscription } from 'rxjs';
import { finalize, first, catchError, switchMap, tap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

import { AuthService, User as AuthUser } from '../../auth/auth.service'; // Using AuthUser alias
import { CommunicationService, Notification } from '../communication.service';

// Local User interface removed as AuthUser from AuthService should be used and sufficient.

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html', // Ensure this file exists (as in notifications_html_updated)
  styleUrls: ['./notifications.component.scss'],   // Ensure this file exists (as in notifications_scss_fixed)
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
  currentUser: AuthUser | null = null;

  private loadNotificationsSubscription: Subscription | undefined; // For manual subscription to notifications$ if needed
  private currentUserSubscription: Subscription | undefined;

  constructor(
    private authService: AuthService,
    private communicationService: CommunicationService,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController, // Added for potential use
    private cdr: ChangeDetectorRef // Injected ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.currentUserSubscription = this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        if (user && user.uid) {
            this.loadNotifications();
        } else {
            this.isLoading = false;
            this.notifications$ = of([]);
            this.errorMessage = "Please log in to view notifications.";
            this.cdr.detectChanges(); // Ensure UI update
        }
    });
  }

  async loadNotifications(refresherEvent?: any) {
    if (!this.currentUser || !this.currentUser.uid) {
      this.isLoading = false;
      this.errorMessage = "User not authenticated. Cannot load notifications.";
      if (refresherEvent) refresherEvent.target.complete();
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    if (!refresherEvent) { // Only show full page loader if not a refresher action
      loader = await this.loadingController.create({
        message: 'Loading notifications...',
        spinner: 'crescent'
      });
      await loader.present();
    }

    // Unsubscribe from previous if any, to prevent multiple calls
    if (this.loadNotificationsSubscription) {
        this.loadNotificationsSubscription.unsubscribe();
    }

    this.notifications$ = this.communicationService.getNotifications(this.currentUser.uid).pipe(
        tap(notifications => {
            if (notifications.length === 0 && !this.errorMessage) {
                // This is a good place to set a "no notifications" message if not handled purely in template
                // For example: this.errorMessage = "You have no new notifications."
                // However, the template (notifications_html_updated) already handles this.
            }
            this.cdr.detectChanges(); // Ensure list updates
        }),
        finalize(() => {
            this.isLoading = false;
            if (loader) {
                loader.dismiss().catch(e => console.warn('Error dismissing loading:', e));
            }
            if (refresherEvent) {
                refresherEvent.target.complete();
            }
            this.cdr.detectChanges(); // Ensure loading state updates view
        }),
        catchError(err => {
            console.error('Error loading notifications:', err);
            this.errorMessage = 'Failed to load notifications. Please try again.';
            this.cdr.detectChanges(); // Ensure error message is displayed
            return of([]); // Return empty array on error
        })
    );
    // If you need to perform actions after the first emission (like marking as seen implicitly),
    // you might subscribe here, but for display, async pipe is usually sufficient.
    // this.loadNotificationsSubscription = this.notifications$.subscribe();
  }

  handleNotification(notification: Notification) {
    if (!notification || !notification.id) {
      console.error('Invalid notification object received by handleNotification:', notification);
      this.showToast('Could not open notification.', 'danger');
      return;
    }

    this.communicationService.markNotificationAsRead(notification.id).pipe(
      first(),
      catchError(err => {
        console.error(`Error marking notification ${notification.id} as read:`, err);
        this.showToast('Failed to mark notification as read.', 'warning');
        return of(null); // Continue navigation even if marking read fails
      })
    ).subscribe(() => {
      console.log(`Notification ${notification.id} marked as read or attempt was made.`);
      this.navigateFromNotification(notification);
    });
  }

  private navigateFromNotification(notification: Notification) {
    if (!this.currentUser) { // Should always have a user if this method is called
        this.showToast('User context lost. Cannot navigate.', 'danger');
        return;
    }
    if (notification.type === 'message' && notification.relatedId) {
      this.router.navigate(['/communication/chat', notification.relatedId]);
    } else if (notification.type === 'call' && notification.relatedId) {
      this.router.navigate(['/communication/video-call', notification.relatedId]);
    } else if ((notification.type === 'order' || notification.type === 'status') && notification.relatedId) {
      if (this.currentUser.accountType === 'retailer') {
        this.router.navigate(['/retailer/orders', notification.relatedId]);
      } else {
        this.router.navigate(['/customer/orders', notification.relatedId]);
      }
    } else {
      console.log(`Unhandled notification type: ${notification.type} or missing relatedId.`);
      this.showToast('Cannot navigate from this notification.', 'medium');
    }
  }

  formatTime(dateInput: any): string {
    if (!dateInput) return 'No date';
    let date: Date;

    if (dateInput && typeof dateInput.toDate === 'function') {
      date = dateInput.toDate();
    } else if (dateInput && typeof dateInput.seconds === 'number') {
      date = new Date(dateInput.seconds * 1000 + (dateInput.nanoseconds || 0) / 1000000);
    } else if (dateInput instanceof Date) {
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
    // Example of more relative time formatting
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);

    if (diffSeconds < 60) return `Just now`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }); // Older than a day
  }

  doRefresh(event: any) {
    if (this.currentUser) {
        this.loadNotifications(event);
    } else {
        if (event) event.target.complete();
        this.errorMessage = "Please log in to refresh notifications.";
        this.showToast(this.errorMessage, 'warning');
        this.cdr.detectChanges();
    }
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger' | string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({ message, duration, color, position: 'top' });
    toast.present();
  }

  ngOnDestroy() {
    if (this.currentUserSubscription) {
      this.currentUserSubscription.unsubscribe();
    }
    if (this.loadNotificationsSubscription) { // If you decide to manually subscribe to notifications$
        this.loadNotificationsSubscription.unsubscribe();
    }
  }
}


