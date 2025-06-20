// src/app/communication/communication.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ChatListComponent } from './chat/chat-list.component';
import { ChatDetailComponent } from './chat/chat-detail.component';
import { VideoCallComponent } from './video-call/video-call.component';
import { NotificationsComponent } from './notification/notifications.component'; 

const routes: Routes = [
  { path: 'chats', component: ChatListComponent },
  { path: 'chat/:id', component: ChatDetailComponent },
  { path: 'video-call/:id', component: VideoCallComponent },
  { path: 'notifications', component: NotificationsComponent },
  { path: '', redirectTo: 'chats', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    // Remove standalone components from declarations
    // ChatListComponent,
    // ChatDetailComponent,
    // VideoCallComponent,
    // NotificationsComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    // Add standalone components to imports instead
    ChatListComponent,
    ChatDetailComponent,
    VideoCallComponent,
    NotificationsComponent
  ],
  exports: [RouterModule]
})
export class CommunicationModule { }
