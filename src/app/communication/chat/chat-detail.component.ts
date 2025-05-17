// src/app/communication/chat/chat-detail.component.ts
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
    private communicationService: CommunicationService
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
    if (this.newMessage.valid) {
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
    
    const d = new Date(date.seconds ? date.seconds * 1000 : date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  initiateVideoCall() {
    this.communicationService.initiateVideoCall(this.partnerId, this.partnerName).subscribe(
      callId => {
        // Navigate to video call screen
        this.router.navigate(['/communication/video-call', callId]);
      },
      error => {
        console.error('Error initiating video call:', error);
      }
    );
  }
}
