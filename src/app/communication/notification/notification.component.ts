// src/app/communication/notifications/notifications.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController } from '@ionic/angular';
import { Observable, of } from 'rxjs'; // Added 'of' for potential fallback
import { finalize, first, catchError } from 'rxjs/operators'; // Added 'first' and 'catchError'
import { AuthService } from '../../auth/auth.service'; // Assuming this path is correct
import { CommunicationService, Notification } from '../communication.service'; // Assuming this path is correct

// Define a simple User interface.
// Ideally, this (or a more complete version) should come from your auth models or a shared types file.
export interface User {
  uid: string;
  // other potential user properties like email, displayName, etc.
}

// Define or import your Notification interface if not already done in communication.service
// export interface Notification {
//   id: string;
//   type: 'message' | 'call' | 'order' | 'status' | string; // Add other types as needed
//   relatedId?: string;
//   message: string;
//   date: any; // Consider using a more specific type like Date or a Firestore Timestamp
//   read: boolean;
//   // other notification properties
// }

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit {
  notifications$: Observable<Notification[]>;
  isLoading = true;
  errorMessage: string | null = null;

  constructor(
    private authService: AuthService,
    private communicationService: CommunicationService,
    private router: Router,
    private loadingController: LoadingController
  ) {
    // Initialize notifications$ to an empty array observable to prevent template errors before loading
    this.notifications$ = of([]);
  }

  ngOnInit() {
    this.loadNotifications();
  }

  async loadNotifications() {
    this.isLoading = true;
    this.errorMessage = null;
    const loading = await this.loadingController.create({
      message: 'Loading notifications...',
      spinner: 'crescent'
    });
    await loading.present();

    this.authService.currentUser$.pipe(
      first(), // Take the first emitted value and complete
      catchError(err => {
        console.error('Error getting current user:', err);
        this.errorMessage = 'Could not load user data.';
        return of(null); // Return a null user so the flow can continue to finalize
      })
    ).subscribe(user => {
      if (user) {
        // If currentUser$ is properly typed in AuthService (e.g., Observable<User | null>),
        // the 'as User' assertion might not be needed if 'user' is not null.
        const knownUser = user as User; // Type assertion
        if (knownUser.uid) {
          this.notifications$ = this.communicationService.getNotifications(knownUser.uid).pipe(
            finalize(() => {
              this.isLoading = false;
              loading.dismiss().catch(e => console.warn('Error dismissing loading while notifications loaded:', e));
            }),
            catchError(err => {
              console.error('Error loading notifications:', err);
              this.errorMessage = 'Failed to load notifications.';
              this.isLoading = false;
              loading.dismiss().catch(e => console.warn('Error dismissing loading on notification error:', e));
              return of([]); // Return empty array on error
            })
          );
        } else {
            console.warn('User object received, but UID is missing.');
            this.isLoading = false;
            this.errorMessage = 'User identifier is missing.';
            loading.dismiss().catch(e => console.warn('Error dismissing loading (UID missing):', e));
            this.notifications$ = of([]);
        }
      } else {
        // Handle case where user is null (e.g., not logged in or error fetching user)
        this.isLoading = false;
        if (!this.errorMessage) { // Don't overwrite specific error from currentUser$ catchError
            this.errorMessage = 'No user logged in to load notifications.';
        }
        loading.dismiss().catch(e => console.warn('Error dismissing loading (no user):', e));
        this.notifications$ = of([]); // Set to empty observable
      }
    });
  }

  handleNotification(notification: Notification) {
    if (!notification || !notification.id) {
        console.error('Invalid notification object received by handleNotification:', notification);
        return;
    }

    // Mark notification as read
    this.communicationService.markNotificationAsRead(notification.id).pipe(
        first() // Ensure the subscription completes
    ).subscribe({
      next: () => console.log(`Notification ${notification.id} marked as read.`),
      error: (err) => console.error(`Error marking notification ${notification.id} as read:`, err)
    });

    // Navigate based on notification type
    if (notification.type === 'message' && notification.relatedId) {
      this.router.navigate(['/communication/chat', notification.relatedId]);
    } else if (notification.type === 'call' && notification.relatedId) {
      this.router.navigate(['/communication/video-call', notification.relatedId]);
    } else if ((notification.type === 'order' || notification.type === 'status') && notification.relatedId) {
      this.authService.isRetailer().pipe(first()).subscribe(isRetailer => {
        if (isRetailer) {
          this.router.navigate(['/retailer/orders', notification.relatedId]);
        } else {
          this.router.navigate(['/customer/orders', notification.relatedId]);
        }
      });
    } else {
        console.log(`Unhandled notification type: ${notification.type} or missing relatedId.`);
        // Optionally navigate to a general notifications page or do nothing
    }
  }

  formatTime(dateInput: any): string {
    if (!dateInput) return 'No date';

    let date: Date;

    // Check if it's a Firebase Timestamp object
    if (dateInput && typeof dateInput.toDate === 'function') {
      date = dateInput.toDate();
    }
    // Check if it's already a Date object
    else if (dateInput instanceof Date) {
      date = dateInput;
    }
    // Try to parse it if it's a string or number
    else {
      date = new Date(dateInput);
    }

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    // Format to a user-friendly time string, e.g., "3:45 PM"
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  // Optional: Add a refresh function callable from the template
  refreshNotifications() {
    this.loadNotifications();
  }

} // Closing brace for the NotificationsComponent class