// src/app/communication/notifications/notifications.component.ts
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router'; // RouterModule added
import { LoadingController, IonicModule } from '@ionic/angular'; // IonicModule added
import { Observable, of } from 'rxjs';
import { finalize, first, catchError } from 'rxjs/operators';
import { CommonModule } from '@angular/common'; // CommonModule added

import { AuthService } from '../../auth/auth.service'; // Assuming this path is correct
import { CommunicationService, Notification } from '../communication.service'; // Assuming this path is correct

// Define a simple User interface if not globally available
// This might already be defined in your AuthService or a shared models file
export interface User {
  uid: string;
  // other potential user properties like email, displayName, etc.
}

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html', // Ensure this file exists
  styleUrls: ['./notifications.component.scss'],   // Ensure this file exists
  standalone: true, // Mark component as standalone
  imports: [
    CommonModule,     // For *ngIf, *ngFor, async pipe, etc.
    IonicModule,      // For Ionic components (ion-list, ion-item, ion-spinner, ion-icon, etc.) and services
    RouterModule      // For routerLink (if used in the template)
  ]
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

  async loadNotifications(event?: any) { // Added event parameter for ion-refresher
    this.isLoading = true;
    this.errorMessage = null;
    let loading: HTMLIonLoadingElement | undefined;

    // Only show loader if not triggered by refresher
    if (!event) {
      loading = await this.loadingController.create({
        message: 'Loading notifications...',
        spinner: 'crescent'
      });
      await loading.present();
    }

    this.authService.currentUser$.pipe(
      first(), // Take the first emitted value and complete
      catchError(err => {
        console.error('Error getting current user:', err);
        this.errorMessage = 'Could not load user data.';
        return of(null); // Return a null user so the flow can continue to finalize
      })
    ).subscribe(user => {
      const dismissLoader = () => {
        this.isLoading = false;
        if (loading) {
          loading.dismiss().catch(e => console.warn('Error dismissing loading:', e));
        }
        if (event) {
          event.target.complete(); // Complete ion-refresher animation
        }
      };

      if (user) {
        const knownUser = user as User; // Type assertion
        if (knownUser && knownUser.uid) { // Added check for knownUser as well
          this.notifications$ = this.communicationService.getNotifications(knownUser.uid).pipe(
            finalize(() => {
              dismissLoader();
            }),
            catchError(err => {
              console.error('Error loading notifications:', err);
              this.errorMessage = 'Failed to load notifications.';
              dismissLoader();
              return of([]); // Return empty array on error
            })
          );
        } else {
          console.warn('User object received, but UID is missing.');
          this.errorMessage = 'User identifier is missing.';
          this.notifications$ = of([]);
          dismissLoader();
        }
      } else {
        if (!this.errorMessage) {
          this.errorMessage = 'No user logged in to load notifications.';
        }
        this.notifications$ = of([]);
        dismissLoader();
      }
    });
  }

  handleNotification(notification: Notification) {
    if (!notification || !notification.id) {
      console.error('Invalid notification object received by handleNotification:', notification);
      return;
    }

    this.communicationService.markNotificationAsRead(notification.id).pipe(
      first()
    ).subscribe({
      next: () => console.log(`Notification ${notification.id} marked as read.`),
      error: (err) => console.error(`Error marking notification ${notification.id} as read:`, err)
    });

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
    }
  }

  formatTime(dateInput: any): string {
    if (!dateInput) return 'No date';
    let date: Date;

    if (dateInput && typeof dateInput.toDate === 'function') {
      date = dateInput.toDate();
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
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  // For ion-refresher
  doRefresh(event: any) {
    this.loadNotifications(event);
  }
}
