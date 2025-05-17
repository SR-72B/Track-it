
// src/app/communication/notifications/notifications.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import { CommunicationService, Notification } from '../communication.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit {
  notifications$: Observable<Notification[]>;
  isLoading = true;

  constructor(
    private authService: AuthService,
    private communicationService: CommunicationService,
    private router: Router,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    this.loadNotifications();
  }

  async loadNotifications() {
    const loading = await this.loadingController.create({
      message: 'Loading notifications...',
      spinner: 'crescent'
    });
    await loading.present();

    this.authService.currentUser$.pipe(
      first()
    ).subscribe(user => {
      if (user) {
        this.notifications$ = this.communicationService.getNotifications(user.uid).pipe(
          finalize(() => {
            this.isLoading = false;
            loading.dismiss();
          })
        );
      } else {
        this.isLoading = false;
        loading.dismiss();
      }
    });
  }

  handleNotification(notification: Notification) {
    // Mark notification as read
    this.communicationService.markNotificationAsRead(notification.id).subscribe();
    
    // Navigate based on notification type
    if (notification.type === 'message' && notification.relatedId) {
      // Navigate to chat with sender
      this.router.navigate(['/communication/chat', notification.relatedId]);
    } else if (notification.type === 'call' && notification.relatedId) {
      // Navigate to call screen
      this.router.navigate(['/communication/video-call', notification.relatedId]);
    } else if ((notification.type === 'order' || notification.type === 'status') && notification.relatedId) {
      // Determine if user is retailer or customer and navigate accordingly
      this.authService.isRetailer().pipe(first()).subscribe(isRetailer => {
        if (isRetailer) {
          this.router.navigate(['/retailer/orders', notification.relatedId]);
        } else {
          this.router.navigate(['/customer/orders', notification.relatedId]);
        }
      });
    }
  }

  formatTime(date: any): string {
    if (!date) return '';
    