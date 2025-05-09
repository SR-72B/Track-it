// src/app/communication/chat/chat-list.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService, User } from '../../auth/auth.service';
import { CommunicationService } from '../communication.service';

interface ChatPartner {
  id: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.component.html',
  styleUrls: ['./chat-list.component.scss']
})
export class ChatListComponent implements OnInit {
  chatPartners$: Observable<ChatPartner[]>;
  isLoading = true;

  constructor(
    private authService: AuthService,
    private communicationService: CommunicationService,
    private router: Router
  ) { }

  ngOnInit() {
    this.loadChats();
  }

  loadChats() {
    this.isLoading = true;
    
    // This is a simplified implementation - in a real app, 
    // you would need to query the unique chat partners from messages
    this.authService.currentUser$.pipe(
      first()
    ).subscribe(user => {
      if (user) {
        // For demo purposes, we're using hardcoded data
        // In a real app, you would get this data from the actual messages
        this.chatPartners$ = of([
          {
            id: 'partner1',
            name: 'Retailer Support',
            lastMessage: 'How can I help you today?',
            lastMessageTime: new Date(),
            unreadCount: 0
          },
          {
            id: 'partner2',
            name: 'Order Assistance',
            lastMessage: 'Your order has been processed.',
            lastMessageTime: new Date(Date.now() - 3600000), // 1 hour ago
            unreadCount: 2
          }
        ]);
        this.isLoading = false;
      } else {
        this.isLoading = false;
      }
    });
  }

  openChat(partnerId: string) {
    this.router.navigate(['/communication/chat', partnerId]);
  }

  formatTime(date: Date): string {
    if (!date) return '';
    
    const d = new Date(date.seconds ? date.seconds * 1000 : date);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (d >= today) {
      // Today - show time only
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (d >= yesterday) {
      // Yesterday
      return 'Yesterday';
    } else {
      // Older - show date
      return d.toLocaleDateString();
    }
  }
}
