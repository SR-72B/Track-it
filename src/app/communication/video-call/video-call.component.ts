// src/app/communication/video-call/video-call.component.ts
import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Observable, Subscription } from 'rxjs';
import { first } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import { CommunicationService, VideoCall } from '../communication.service';

@Component({
  selector: 'app-video-call',
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.scss']
})
export class VideoCallComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo', { static: false }) localVideo: ElementRef;
  @ViewChild('remoteVideo', { static: false }) remoteVideo: ElementRef;
  
  callId: string;
  call$: Observable<VideoCall>;
  call: VideoCall | null = null;
  isInitiator = false;
  peerConnection: RTCPeerConnection | null = null;
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  callStatus: 'connecting' | 'ongoing' | 'ended' = 'connecting';
  
  private callSubscription: Subscription | null = null;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private communicationService: CommunicationService,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.callId = params['id'];
      this.loadCall();
    });
  }

  ngOnDestroy() {
    this.endCall();
    if (this.callSubscription) {
      this.callSubscription.unsubscribe();
    }
  }

  loadCall() {
    this.call$ = this.communicationService.getVideoCall(this.callId);
    
    this.callSubscription = this.call$.subscribe(
      call => {
        this.call = call;
        
        // Determine if current user is initiator
        this.authService.currentUser$.pipe(first()).subscribe(user => {
          if (user) {
            this.isInitiator = call.initiatorId === user.uid;
            
            // Handle call status changes
            if (call.status === 'accepted' && this.callStatus === 'connecting') {
              this.setupWebRTC();
            } else if (call.status === 'declined' || call.status === 'ended') {
              this.handleCallEnded('Call ' + call.status);
            }
          }
        });
      },
      error => {
        console.error('Error loading call:', error);
        this.handleCallEnded('Error: ' + error.message);
      }
    );
  }

  async setupWebRTC() {
    try {
      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      if (this.localVideo && this.localVideo.nativeElement) {
        this.localVideo.nativeElement.srcObject = this.localStream;
      }
      
      // Create peer connection
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      };
      
      this.peerConnection = new RTCPeerConnection(configuration);
      
      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
      
      // Listen for remote stream
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        if (this.remoteVideo && this.remoteVideo.nativeElement) {
          this.remoteVideo.nativeElement.srcObject = this.remoteStream;
        }
        this.callStatus = 'ongoing';
      };
      
      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // In a real app, you would send this candidate to the remote peer
          // For demo purposes, we're not implementing the full WebRTC signaling
        }
      };
      
      // Create and send offer (if initiator)
      if (this.isInitiator) {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        
        // In a real app, you would send this offer to the remote peer
        // For demo purposes, we're not implementing the full WebRTC signaling
      }
    } catch (error) {
      console.error('Error setting up WebRTC:', error);
      this.handleCallEnded('Error setting up video call');
    }
  }

  acceptCall() {
    this.communicationService.updateCallStatus(this.callId, 'accepted').subscribe(
      () => {
        this.setupWebRTC();
      },
      error => {
        console.error('Error accepting call:', error);
      }
    );
  }

  declineCall() {
    this.communicationService.updateCallStatus(this.callId, 'declined').subscribe(
      () => {
        this.router.navigate(['/communication/chats']);
      },
      error => {
        console.error('Error declining call:', error);
        this.router.navigate(['/communication/chats']);
      }
    );
  }

  endCall() {
    // Clean up WebRTC
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    // Update call status in database
    if (this.call && this.call.status === 'ongoing') {
      this.communicationService.updateCallStatus(this.callId, 'ended').subscribe();
    }
  }

  async handleCallEnded(reason: string) {
    this.endCall();
    
    const alert = await this.alertController.create({
      header: 'Call Ended',
      message: reason,
      buttons: [
        {
          text: 'OK',
          handler: () => {
            this.router.navigate(['/communication/chats']);
          }
        }
      ]
    });
    
    await alert.present();
  }

  toggleMute() {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        track.enabled = !track.enabled;
      }
    }
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const track = videoTracks[0];
        track.enabled = !track.enabled;
      }
    }
  }
}