// src/app/communication/chat/chat-detail.component.ts
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router'; // Import Router
import { IonContent } from '@ionic/angular';
import { Observable } from 'rxjs';
import { AuthService, User } from '../../auth/auth.service';
import { CommunicationService, ChatMessage } from '../communication.service';

@Component({
  selector: 'app-chat-detail',
  templateUrl: './chat-detail.component.html',
  styleUrls: ['./chat-detail.component.scss']
})
export class ChatDetailComponent implements OnInit {
  @ViewChild(IonContent, { static: false }) content: IonContent;

  partnerId: string;
  partnerName: string;
  messages$: Observable<ChatMessage[]>;
  currentUser: User | null;
  newMessage = new FormControl('', Validators.required);
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private communicationService: CommunicationService,
    private router: Router // Inject Router here
  ) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.partnerId = params['id'];
      this.loadChat();
    });

    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  loadChat() {
    this.isLoading = true;

    // In a real app, you would get the partner details from a service
    // For demo purposes, we're using hardcoded data
    if (this.partnerId === 'partner1') {
      this.partnerName = 'Retailer Support';
    } else if (this.partnerId === 'partner2') {
      this.partnerName = 'Order Assistance';
    } else {
      this.partnerName = 'Unknown';
    }

    this.messages$ = this.communicationService.getMessages(this.partnerId);
    this.messages$.subscribe(() => {
      this.isLoading = false;
      setTimeout(() => this.scrollToBottom(), 300);
    });
  }

  sendMessage() {
    if (this.newMessage.valid && this.newMessage.value) { // Added check for newMessage.value
      const message = this.newMessage.value;
      this.communicationService.sendMessage(this.partnerId, message).subscribe(
        () => {
          this.newMessage.reset();
          setTimeout(() => this.scrollToBottom(), 300);
        },
        error => {
          console.error('Error sending message:', error);
        }
      );
    }
  }

  scrollToBottom() {
    if (this.content) {
      this.content.scrollToBottom(300);
    }
  }

  formatTime(date: any): string {
    if (!date) return '';

    // Check if date is a Firebase Timestamp
    if (date.seconds !== undefined && date.nanoseconds !== undefined) {
      const d = new Date(date.seconds * 1000);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Check if date is already a Date object or a string that can be parsed
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return ''; // Return empty if date format is unrecognized
  }

  initiateVideoCall() {
    if (!this.partnerId || !this.partnerName) {
      console.error('Partner ID or Name is missing, cannot initiate video call.');
      // Optionally, show an alert to the user
      return;
    }
    this.communicationService.initiateVideoCall(this.partnerId, this.partnerName).subscribe(
      callId => {
        if (callId) {
          // Navigate to video call screen
          this.router.navigate(['/communication/video-call', callId]);
        } else {
          console.error('Failed to get a call ID.');
          // Optionally, show an alert to the user
        }
      },
      error => {
        console.error('Error initiating video call:', error);
        // Optionally, show an alert to the user
      }
    );
  }
}
