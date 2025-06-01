// src/app/communication/communication.routes.ts
import { Routes } from '@angular/router';

// Assuming these components are or will be standalone:
 import { ChatListComponent } from './chat/chat-list.component';
 import { ChatDetailComponent } from './chat/chat-detail.component'; // Note: your error log had 'chat-detail.component.scss'
 import { NotificationsComponent } from './notification/notifications.component'; // You made this standalone
 import { VideoCallComponent } from './video-call/video-call.component';

export const COMMUNICATION_ROUTES: Routes = [
  {
    path: 'chats', // Lists all chats
    loadComponent: () => import('./chat/chat-list.component').then(c => c.ChatListComponent)
  },
  {
    path: 'chat/:chatId', // Detail for a specific chat, using :chatId as a parameter
    loadComponent: () => import('./chat/chat-detail.component').then(c => c.ChatDetailComponent)
  },
  {
    path: 'notifications',
    loadComponent: () => import('./notification/notifications.component').then(c => c.NotificationsComponent)
  },
  {
    path: 'video-call/:callId', // Route for a video call, using :callId as a parameter
    loadComponent: () => import('./video-call/video-call.component').then(c => c.VideoCallComponent)
  },
  // Default route within the 'communication' section
  {
    path: '',
    redirectTo: 'chats', // Or 'notifications', depending on your preferred default
    pathMatch: 'full'
  }
];
