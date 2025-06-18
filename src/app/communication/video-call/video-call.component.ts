// src/app/communication/video-call/video-call.component.ts
import { Component, OnInit, OnDestroy, ElementRef, ViewChild, NgZone, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common'; // For *ngIf, *ngFor, etc.
import { IonicModule, AlertController, LoadingController, ToastController } from '@ionic/angular'; // Added ToastController

import { Observable, Subscription, of, firstValueFrom } from 'rxjs';
import { first, catchError, filter, tap, switchMap } from 'rxjs/operators';

import { AuthService, User } from '../../auth/auth.service'; // Ensure User is exported
import { CommunicationService, VideoCall } from '../communication.service'; // Ensure VideoCall is exported

@Component({
  selector: 'app-video-call',
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule, // For ion-button, ion-icon, ion-spinner, AlertController, LoadingController etc.
    RouterModule // If using routerLink in template
  ]
})
export class VideoCallComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>; // Use definite assignment if sure it will be there
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;

  callId: string | null = null;
  call: VideoCall | null = null;
  isInitiator = false;
  peerConnection: RTCPeerConnection | null = null;
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  callStatus: 'initializing' | 'connecting' | 'pending' | 'ongoing' | 'ended' | 'failed' = 'initializing';
  errorMessage: string | null = null;

  private routeParamsSubscription: Subscription | undefined;
  private callSubscription: Subscription | undefined;
  private otherUserIceCandidatesSubscription: Subscription | undefined;
  private currentUser: User | null = null;
  private opponentId: string | null = null;

  isLoading = true; // For initial call data loading
  isProcessingAction = false; // For actions like accept/decline/end

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private communicationService: CommunicationService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController, // Added for brief messages
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef // For manually triggering change detection if needed
  ) {}

  async ngOnInit() {
    try {
      this.currentUser = await firstValueFrom(this.authService.currentUser$.pipe(
        filter((user): user is User => user !== null), // Ensure user is not null and type guard
        first() // Take the first non-null user
      ));

      if (!this.currentUser) {
        throw new Error('User not authenticated.');
      }

      this.routeParamsSubscription = this.route.params.pipe(first()).subscribe(params => {
        this.callId = params['id'];
        if (this.callId && this.currentUser) {
          this.loadCall();
        } else {
          this.handleCallEnded('Invalid call link or missing call ID.');
        }
      });
    } catch (error) {
      console.error('Authentication error or no user for call:', error);
      this.handleCallEnded('Authentication required to join the call.');
    }
  }

  ngOnDestroy() {
    this.cleanupCall();
    if (this.routeParamsSubscription) this.routeParamsSubscription.unsubscribe();
    if (this.callSubscription) this.callSubscription.unsubscribe();
    if (this.otherUserIceCandidatesSubscription) this.otherUserIceCandidatesSubscription.unsubscribe();
  }

  async loadCall() {
    if (!this.callId || !this.currentUser) {
      this.isLoading = false;
      this.errorMessage = 'Call ID or user information is missing.';
      return;
    }
    this.isLoading = true;
    this.errorMessage = null;
    this.callStatus = 'connecting';

    if (this.callSubscription) this.callSubscription.unsubscribe();

    this.callSubscription = this.communicationService.getVideoCall(this.callId).pipe(
      catchError(error => {
        console.error('Error fetching call details:', error);
        this.handleCallEnded('Could not load call information.');
        return of(null);
      }),
      // No need for filter(callData => callData !== undefined) if catchError returns of(null)
      tap(() => this.isLoading = false) // Set loading false after first emission or error
    ).subscribe(async callData => {
      if (!callData) {
        if (this.callStatus !== 'ended' && this.callStatus !== 'failed') {
          this.handleCallEnded('Call details not found or the call has already ended.');
        }
        return;
      }

      const previousStatus = this.call?.status;
      this.call = callData; // Assuming VideoCall type matches

      if (!this.currentUser) { // Should not happen if ngOnInit logic is correct
        this.handleCallEnded('User context lost during call load.');
        return;
      }

      this.isInitiator = this.call.initiatorId === this.currentUser.uid;
      this.opponentId = this.isInitiator ? this.call.receiverId : this.call.initiatorId;

      console.log('Call data loaded/updated:', this.call, 'Is Initiator:', this.isInitiator);

      // Handle WebRTC signaling based on updated call data
      if (this.peerConnection && this.call) {
        if (this.isInitiator && this.call.answer && !this.peerConnection.currentRemoteDescription && this.peerConnection.signalingState === 'have-local-offer') {
          console.log('Initiator: Received answer, attempting to set remote description.');
          try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.call.answer));
            console.log("Initiator: Remote answer set successfully.");
          } catch (e) {
            console.error("Initiator: Error setting remote answer:", e);
            this.handleCallEnded("Failed to process call answer.");
          }
        } else if (!this.isInitiator && this.call.offer && !this.peerConnection.currentRemoteDescription && (this.peerConnection.signalingState === 'stable' || this.peerConnection.signalingState === 'have-local-offer')) {
           // Check if we already tried to set this offer to prevent race conditions or re-processing
          if (this.peerConnection.currentRemoteDescription?.sdp !== this.call.offer.sdp) {
            console.log('Receiver: Received offer, attempting to set remote description and create answer.');
            try {
              await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.call.offer));
              await this.createAndSendAnswer();
            } catch (e) {
              console.error("Receiver: Error setting remote offer or creating answer:", e);
              this.handleCallEnded("Failed to process call offer.");
            }
          }
        }
      }

      if (this.call.status !== previousStatus) {
        console.log(`Call status changed from '${previousStatus}' to '${this.call.status}'`);
        this.ngZone.run(async () => { // Ensure UI updates happen in Angular's zone
          this.callStatus = this.call!.status as any; // Update local callStatus
          switch (this.call?.status) {
            case 'pending':
              // UI should show options for receiver to accept/decline
              break;
            case 'accepted':
              if (!this.peerConnection) { // Setup WebRTC only if not already done
                console.log("Call accepted by other party, initiating WebRTC setup.");
                await this.setupWebRTC();
              }
              break;
            case 'declined':
            case 'ended':
              this.handleCallEnded(`Call has been ${this.call.status}.`);
              break;
          }
          this.cdr.detectChanges(); // Manually trigger change detection
        });
      }
    });
  }

  async setupWebRTC() {
    if (this.peerConnection) {
      console.warn('WebRTC setup: peerConnection already exists.');
      return;
    }
    if (!this.currentUser || !this.callId || !this.call || !this.opponentId) {
      this.handleCallEnded("Error during call setup (missing critical data).");
      return;
    }
    console.log("Setting up WebRTC. Is initiator:", this.isInitiator);
    this.callStatus = 'connecting';

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (this.localVideo?.nativeElement) {
        this.localVideo.nativeElement.srcObject = this.localStream;
      } else {
        console.warn('Local video element not available at setup time.');
      }

      const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      this.peerConnection = new RTCPeerConnection(configuration);

      this.localStream.getTracks().forEach(track => this.peerConnection!.addTrack(track, this.localStream!));

      this.peerConnection.ontrack = (event) => {
        this.ngZone.run(() => {
          if (event.streams && event.streams[0]) {
            this.remoteStream = event.streams[0];
            if (this.remoteVideo?.nativeElement) {
              this.remoteVideo.nativeElement.srcObject = this.remoteStream;
              this.callStatus = 'ongoing';
              console.log("Remote stream received, call now ongoing.");
              this.cdr.detectChanges();
            } else {
              this.handleCallEnded('Error displaying remote video.');
            }
          }
        });
      };

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.currentUser && this.callId) {
          this.communicationService.sendIceCandidate(this.callId, this.currentUser.uid, event.candidate.toJSON())
            .catch(err => console.error('Error sending ICE candidate:', err));
        }
      };
      
      this.peerConnection.onconnectionstatechange = () => {
        this.ngZone.run(() => {
          console.log('Peer connection state changed:', this.peerConnection?.connectionState);
          switch (this.peerConnection?.connectionState) {
            case 'connected': this.callStatus = 'ongoing'; break;
            case 'disconnected': /* Handle potential reconnection UI */ break;
            case 'failed':
            case 'closed': this.handleCallEnded(`Call connection ${this.peerConnection.connectionState}.`); break;
          }
          this.cdr.detectChanges();
        });
      };

      if (this.otherUserIceCandidatesSubscription) this.otherUserIceCandidatesSubscription.unsubscribe();
      console.log(`Subscribing to ICE candidates sent BY opponent: ${this.opponentId}`);
      this.otherUserIceCandidatesSubscription = this.communicationService.getIceCandidates(this.callId, this.opponentId)
        .subscribe(candidates => {
          candidates.forEach(candidateObj => {
            if (candidateObj && this.peerConnection && this.peerConnection.signalingState !== 'closed') {
              this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateObj))
                .catch(e => console.error('Error adding received ICE candidate:', e));
            }
          });
        }, err => console.error('Error in ICE candidate subscription:', err));

      if (this.isInitiator) {
        if (this.peerConnection.signalingState === 'stable') {
          const offer = await this.peerConnection.createOffer();
          await this.peerConnection.setLocalDescription(offer);
          await this.communicationService.sendOffer(this.callId, offer);
          console.log("Initiator: Offer sent.");
        }
      } else if (this.call.offer) { // Receiver: if offer already exists
        if (this.peerConnection.signalingState === 'stable') {
            console.log("Receiver: Offer found, setting remote description and creating answer.");
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.call.offer));
            await this.createAndSendAnswer();
        }
      }
    } catch (error) {
      console.error('Error setting up WebRTC:', error);
      this.handleCallEnded('Error setting up video call. Check permissions or devices.');
    }
  }

  private async createAndSendAnswer() {
    if (!this.peerConnection || this.isInitiator || !this.call || !this.call.offer || this.peerConnection.signalingState !== 'have-remote-offer') {
      console.warn("Conditions not met for creating answer. State:", this.peerConnection?.signalingState);
      return;
    }
    console.log("Receiver: Creating answer.");
    try {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      await this.communicationService.sendAnswer(this.callId!, answer); // callId is checked before setupWebRTC
      console.log("Receiver: Answer sent.");
    } catch (error) {
      console.error("Receiver: Error creating or sending answer:", error);
      this.handleCallEnded("Failed to process call answer.");
    }
  }

  async acceptCall() {
    if (!this.callId || this.isInitiator || !this.call || this.call.status !== 'pending') return;
    console.log('Receiver: Accepting call');
    this.isProcessingAction = true;
    this.callStatus = 'connecting';

    try {
      await firstValueFrom(this.communicationService.updateCallStatus(this.callId, 'accepted'));
      console.log('Call status updated to accepted in DB.');
      // The callSubscription should pick up the 'accepted' status and trigger setupWebRTC if needed.
      // Or, if setupWebRTC was already called and waiting for the offer:
      if (this.peerConnection && this.call.offer && this.peerConnection.signalingState === 'stable') {
        console.log('AcceptCall: Re-attempting to set remote offer after accepting.');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.call.offer));
        await this.createAndSendAnswer();
      } else if (!this.peerConnection) {
          await this.setupWebRTC(); // Ensure WebRTC is set up if not already
      }
    } catch (error: any) {
      console.error('Error accepting call:', error);
      this.handleCallEnded(`Could not accept the call: ${error.message}`);
    } finally {
      this.isProcessingAction = false;
    }
  }

  async declineCall() {
    if (!this.callId || !this.call || ['ended', 'declined'].includes(this.call.status)) return;
    console.log('Declining call');
    this.isProcessingAction = true;
    try {
      await firstValueFrom(this.communicationService.updateCallStatus(this.callId, 'declined'));
      // The callSubscription will pick up the 'declined' status and call handleCallEnded.
    } catch (error: any) {
      console.error('Error declining call:', error);
      this.handleCallEnded(`Failed to decline call: ${error.message}`);
    } finally {
      this.isProcessingAction = false;
    }
  }

  async triggerEndCall() {
    console.log("Triggering end call. Current DB status:", this.call?.status, "Local status:", this.callStatus);
    this.isProcessingAction = true;
    if (this.callId && this.call && !['ended', 'declined'].includes(this.call.status)) {
      try {
        await firstValueFrom(this.communicationService.updateCallStatus(this.callId, 'ended'));
        // callSubscription should handle the rest via handleCallEnded
      } catch (err: any) {
        console.error('Error updating call status to ended:', err);
        this.handleCallEnded(`Call ended. Error saving status: ${err.message}`);
      }
    } else {
      // If no callId or call already ended, just cleanup locally
      this.handleCallEnded('Call session cleared locally.');
    }
    this.isProcessingAction = false;
  }

  private cleanupCall() {
    console.log("Cleaning up WebRTC resources...");
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onconnectionstatechange = null;
      // Stop senders more carefully
      this.peerConnection.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop();
        }
        // Don't removeTrack if connection is already closed, can cause errors
        if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
            try { this.peerConnection.removeTrack(sender); } catch (e) { console.warn("Error removing track during cleanup:", e); }
        }
      });
      if (this.peerConnection.signalingState !== 'closed') {
        this.peerConnection.close();
      }
      this.peerConnection = null;
    }

    if (this.otherUserIceCandidatesSubscription) {
      this.otherUserIceCandidatesSubscription.unsubscribe();
      this.otherUserIceCandidatesSubscription = undefined;
    }
    
    this.ngZone.run(() => { 
      this.callStatus = 'ended'; 
      if (this.localVideo?.nativeElement) this.localVideo.nativeElement.srcObject = null;
      if (this.remoteVideo?.nativeElement) this.remoteVideo.nativeElement.srcObject = null;
      this.cdr.detectChanges();
    });
  }

  public async handleCallEnded(reason: string) {
    // Prevent multiple alerts or navigations if already handled or component is being destroyed
    if (this.callStatus === 'ended' && this.router.url.includes('/communication/chats')) {
      console.log("handleCallEnded: Already ended and navigated or on chat list.");
      return;
    }
    
    console.log(`Handling call ended: ${reason}. Current status: ${this.callStatus}`);
    const previousCallStatusBeforeCleanup = this.callStatus;
    
    this.cleanupCall(); // This sets callStatus to 'ended'

    // Dismiss any active overlays only if the call wasn't already considered 'ended' or 'failed'
    if (previousCallStatusBeforeCleanup !== 'ended' && previousCallStatusBeforeCleanup !== 'failed') {
      try {
        const activeLoading = await this.loadingController.getTop();
        if (activeLoading) await activeLoading.dismiss().catch(e => console.warn("Dismiss error in handleCallEnded (loading)", e));
        const activeAlert = await this.alertController.getTop();
        if (activeAlert) await activeAlert.dismiss().catch(e => console.warn("Dismiss error in handleCallEnded (alert)", e));
      } catch (e) { /* no overlay open */ }
    }
    
    this.ngZone.run(async () => { 
      // Navigate only if not already on the chat list page
      if (!this.router.url.includes('/communication/chats')) {
        const alert = await this.alertController.create({
          header: 'Call Ended',
          message: reason,
          backdropDismiss: false,
          buttons: [{ text: 'OK', handler: () => this.router.navigate(['/communication/chats']) }]
        });
        await alert.present();
      }
      this.cdr.detectChanges();
    });
  }

  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.showToast(`Audio ${audioTrack.enabled ? 'unmuted' : 'muted'}`);
      }
    }
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.showToast(`Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
        // Update UI if necessary
        this.cdr.detectChanges();
      }
    }
  }

  async showToast(message: string, duration: number = 2000, color: string = 'medium') {
    const toast = await this.toastController.create({ message, duration, color, position: 'bottom' });
    await toast.present();
  }
}
