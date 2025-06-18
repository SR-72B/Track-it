// src/app/communication/communication.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ChatListComponent } from './chat/chat-list.component';
import { ChatDetailComponent } from './chat/chat-detail.component';
import { VideoCallComponent } from './video-call/video-call.component';
import { NotificationsComponent } from './notifications/notifications.component';

const routes: Routes = [
  { path: 'chats', component: ChatListComponent },
  { path: 'chat/:id', component: ChatDetailComponent },
  { path: 'video-call/:id', component: VideoCallComponent },
  { path: 'notifications', component: NotificationsComponent },
  { path: '', redirectTo: 'chats', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    ChatListComponent,
    ChatDetailComponent,
    VideoCallComponent,
    NotificationsComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class CommunicationModule { }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date >= today) {
      // Today - show time only
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date >= yesterday) {
      // Yesterday
      return 'Yesterday';
    } else {
      // Older - show date
      return date.toLocaleDateString();
    }
  }
}
