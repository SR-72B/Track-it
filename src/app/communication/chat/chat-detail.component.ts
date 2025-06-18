// src/app/communication/chat/chat-detail.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonContent, IonicModule, LoadingController, ToastController, AlertController } from '@ionic/angular'; // AlertController imported
import { Observable, Subscription, of } from 'rxjs'; // Removed firstValueFrom as it's not needed for Promise-returning service methods
import { tap, finalize, catchError, switchMap } from 'rxjs/operators'; // Removed filter as it's not used
import { CommonModule } from '@angular/common';

import { AuthService, User } from '../../auth/auth.service'; // Ensure User is exported
import { CommunicationService, ChatMessage } from '../communication.service'; // Ensure ChatMessage is exported

@Component({
  selector: 'app-chat-detail',
  templateUrl: './chat-detail.component.html',
  styleUrls: ['./chat-detail.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule
  ]
})
export class ChatDetailComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild(IonContent, { static: false }) content!: IonContent;

  partnerId: string | null = null;
  partnerName: string = 'Unknown';
  messages$: Observable<ChatMessage[]> = of([]);
  currentUser: User | null = null;
  newMessage = new FormControl('', [Validators.required, Validators.minLength(1)]);
  isLoading = true;
  isSending = false;
  errorMessage: string | null = null;

  private routeSubscription: Subscription | undefined;
  private currentUserSubscription: Subscription | undefined;
  private messagesSubscription: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private communicationService: CommunicationService,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController, // AlertController is now injected
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.currentUserSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (this.currentUser && this.partnerId) {
        this.loadChatMessages();
      }
    });

    this.routeSubscription = this.route.params.pipe(
      switchMap(params => {
        this.partnerId = params['id'];
        if (!this.partnerId) {
          this.errorMessage = 'Chat partner ID not found.';
          this.isLoading = false;
          return of(null);
        }
        return this.communicationService.getPartnerDetails(this.partnerId).pipe(
            catchError(err => {
                console.error('Error fetching partner details:', err);
                this.partnerName = 'Unknown Contact';
                this.errorMessage = 'Could not load partner details.';
                return of({ name: 'Unknown Contact' });
            })
        );
      })
    ).subscribe(partnerDetails => {
      if (partnerDetails) {
        this.partnerName = partnerDetails.name;
        if (this.currentUser && this.partnerId) {
            this.loadChatMessages();
        } else if (!this.currentUser) {
            this.isLoading = false;
            this.errorMessage = "Waiting for user authentication...";
        }
      } else if (!this.errorMessage) {
        this.errorMessage = 'Could not load chat partner details.';
        this.isLoading = false;
      }
      this.cdr.detectChanges();
    });
  }

  ngAfterViewChecked() {
    // this.scrollToBottom(); // Consider more targeted scroll
  }

  async loadChatMessages(refresherEvent?: any) {
    if (!this.partnerId || !this.currentUser?.uid) {
      this.errorMessage = 'Cannot load messages: Missing chat details or user information.';
      this.isLoading = false;
      if (refresherEvent) refresherEvent.target.complete();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    if (this.messagesSubscription) {
        this.messagesSubscription.unsubscribe();
    }

    this.messages$ = this.communicationService.getMessagesWithUser(this.currentUser.uid, this.partnerId).pipe(
      tap(() => {
        setTimeout(() => this.scrollToBottom(), 100);
      }),
      finalize(() => {
        this.isLoading = false;
        if (refresherEvent) {
          refresherEvent.target.complete();
        }
        this.cdr.detectChanges();
      }),
      catchError(err => {
        console.error('Error loading chat messages:', err);
        this.errorMessage = 'Failed to load messages.';
        return of([]);
      })
    );
  }

  async sendMessage() {
    if (this.newMessage.invalid || !this.newMessage.value?.trim()) {
      this.showToast('Message cannot be empty.', 'warning');
      return;
    }
    if (!this.currentUser || !this.currentUser.uid || !this.partnerId) {
      this.showToast('Cannot send message: User or chat details missing.', 'danger');
      return;
    }

    this.isSending = true;
    const messageText = this.newMessage.value.trim();

    try {
      // Service method `sendMessage` returns a Promise, so just await it.
      await this.communicationService.sendMessage(this.currentUser.uid, this.partnerId, messageText);
      this.newMessage.reset();
      // scrollToBottom will be triggered by the messages$ tap operator
    } catch (error: any) {
      console.error('Error sending message:', error);
      this.showToast(`Failed to send message: ${error.message || 'Unknown error'}`, 'danger');
    } finally {
      this.isSending = false;
      this.cdr.detectChanges();
    }
  }

  scrollToBottom(duration: number = 300) {
    if (this.content && this.content.getScrollElement) {
      this.content.getScrollElement().then(scrollEl => {
        const shouldScroll = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 200;
        if (shouldScroll) {
          this.content.scrollToBottom(duration).catch(e => console.warn("Scroll to bottom failed:", e));
        }
      }).catch(e => console.warn("Failed to get scroll element:", e));
    }
  }

  formatTime(dateInput: any): string {
    if (!dateInput) return '';
    let d: Date;
    if (dateInput && typeof dateInput.seconds === 'number') {
      d = new Date(dateInput.seconds * 1000 + (dateInput.nanoseconds || 0) / 1000000);
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) {
      return 'Invalid Date';
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  async initiateVideoCall() {
    if (!this.partnerId || !this.currentUser?.uid) {
      this.showToast('Cannot initiate call: User or partner details missing.', 'danger');
      return;
    }

    const loading = await this.loadingController.create({ message: 'Initiating call...' });
    await loading.present();

    try {
      // Service method `initiateVideoCall` returns a Promise, so just await it.
      const callId = await this.communicationService.initiateVideoCall(
        this.currentUser.uid,
        this.partnerId,
        this.currentUser.displayName, // Pass current user's name as initiatorName
        this.partnerName // Pass fetched partnerName as receiverName
      );
      await loading.dismiss();
      if (callId) {
        this.router.navigate(['/communication/video-call', callId]);
      } else {
        this.showErrorAlert('Call Failed', 'Could not establish a video call session.');
      }
    } catch (error: any) {
      await loading.dismiss();
      console.error('Error initiating video call:', error);
      this.showErrorAlert('Call Error', `Failed to initiate video call: ${error.message || 'Unknown error'}`);
    }
  }

  doRefresh(event: any) {
    if (this.currentUser && this.partnerId) {
        this.loadChatMessages(event);
    } else {
        if (event) event.target.complete();
    }
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger' | string = 'medium', duration: number = 2000) {
    const toast = await this.toastController.create({ message, duration, color, position: 'top' });
    toast.present();
  }

  async showErrorAlert(header: string, message: string) {
    const alert = await this.alertController.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  ngOnDestroy() {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    if (this.currentUserSubscription) {
      this.currentUserSubscription.unsubscribe();
    }
    if (this.messagesSubscription) {
        this.messagesSubscription.unsubscribe();
    }
  }
}


