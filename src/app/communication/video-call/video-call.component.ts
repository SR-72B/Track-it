// src/app/communication/video-call/video-call.component.ts
import { Component, OnInit, OnDestroy, ElementRef, ViewChild, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Observable, Subscription, of } from 'rxjs';
import { first, catchError, filter, tap } from 'rxjs/operators';
import { AuthService, User } from '../../auth/auth.service';
import { CommunicationService, VideoCall } from '../communication.service';

@Component({
  selector: 'app-video-call',
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.scss']
})
export class VideoCallComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo', { static: false }) localVideo: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo', { static: false }) remoteVideo: ElementRef<HTMLVideoElement>;

  callId: string;
  call: VideoCall | null = null;
  isInitiator = false;
  peerConnection: RTCPeerConnection | null = null;
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  callStatus: 'connecting' | 'pending' | 'ongoing' | 'ended' | 'failed' = 'connecting';

  private callSubscription: Subscription | null = null;
  private otherUserIceCandidatesSubscription: Subscription | null = null;
  private currentUser: User | null = null;
  private opponentId: string | null = null;

  isLoading = true;
  isSaving = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private communicationService: CommunicationService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private ngZone: NgZone
  ) { }

  ngOnInit() {
    this.authService.currentUser$.pipe(
      filter(user => user !== null), 
      first() 
    ).subscribe(
      user => {
        this.currentUser = user as User;
        this.route.params.pipe(first()).subscribe(params => {
          this.callId = params['id'];
          if (this.callId && this.currentUser) {
            this.loadCall();
          } else if (!this.callId) {
            console.error('No call ID found in route parameters.');
            this.handleCallEnded('Invalid call link.');
          }
        });
      },
      _error => {
        console.error('User not authenticated for call.');
        this.handleCallEnded('Authentication required.');
      }
    );
  }

  ngOnDestroy() {
    this.cleanupCall(); 
    if (this.callSubscription) {
      this.callSubscription.unsubscribe();
    }
  }

  async loadCall() {
    if (!this.callId || !this.currentUser) {
      console.warn('loadCall aborted: callId or currentUser missing.');
      this.isLoading = false;
      return;
    }
    this.isLoading = true;

    if (this.callSubscription) {
      this.callSubscription.unsubscribe();
    }

    this.callSubscription = this.communicationService.getVideoCall(this.callId).pipe(
      catchError(error => {
        console.error('Error fetching call details:', error);
        this.handleCallEnded('Could not load call information.');
        return of(null);
      }),
      filter(callData => callData !== undefined),
      tap(() => this.isLoading = false)
    ).subscribe(
      async callData => {
        if (!callData) {
          if (this.callStatus !== 'ended' && this.callStatus !== 'failed') {
            this.handleCallEnded('Call details not found or call ended.');
          }
          return;
        }

        const previousStatus = this.call?.status;
        this.call = callData as VideoCall;

        if (!this.currentUser) {
          this.handleCallEnded('User context lost during call load.');
          return;
        }

        this.isInitiator = this.call.initiatorId === this.currentUser.uid;
        this.opponentId = this.isInitiator ? this.call.receiverId : this.call.initiatorId;

        console.log('Call data loaded/updated:', this.call);
        console.log('Current user:', this.currentUser.uid, 'Is initiator:', this.isInitiator, 'Opponent ID:', this.opponentId);

        if (this.peerConnection && this.call) {
          if (this.isInitiator && this.call.answer && !this.peerConnection.currentRemoteDescription && this.peerConnection.signalingState === 'have-local-offer') {
            try {
              console.log('Initiator: Attempting to set remote answer.');
              await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.call.answer));
              console.log("Initiator: Remote answer set successfully.");
            } catch (e) {
              console.error("Initiator: Error setting remote answer:", e);
              this.handleCallEnded("Failed to process call answer.");
            }
          } else if (!this.isInitiator && this.call.offer && !this.peerConnection.currentRemoteDescription && (this.peerConnection.signalingState === 'stable' || this.peerConnection.signalingState === 'have-local-offer')) {
            try {
                console.log('Receiver (in loadCall): Attempting to set remote offer.');
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.call.offer));
                console.log("Receiver (in loadCall): Remote offer set. Ready to create answer.");
                await this.createAndSendAnswer();
            } catch (e) {
                console.error("Receiver (in loadCall): Error setting remote offer:", e);
                this.handleCallEnded("Failed to process call offer.");
            }
          }
        }

        if (this.call.status !== previousStatus) {
          console.log(`Call status changed from '${previousStatus}' to '${this.call.status}'`);
          this.ngZone.run(async () => {
            switch (this.call?.status) {
              case 'pending':
                this.callStatus = 'pending';
                break;
              case 'accepted':
                if (this.callStatus !== 'ongoing' && this.callStatus !== 'failed' && !this.peerConnection) {
                  console.log("Call accepted, initiating WebRTC setup.");
                  await this.setupWebRTC();
                }
                break;
              case 'declined':
              case 'ended':
                this.handleCallEnded(`Call has been ${this.call.status}.`);
                break;
            }
          });
        }
      }
    );
  }

  async setupWebRTC() {
    if (this.peerConnection) {
      console.warn('WebRTC setup: peerConnection already exists.');
      return;
    }
    if (!this.currentUser || !this.callId || !this.call) {
      console.error("WebRTC setup: Prerequisites not met.");
      this.handleCallEnded("Error during call setup (missing data).");
      return;
    }
    console.log("Setting up WebRTC. Is initiator:", this.isInitiator);
    this.callStatus = 'connecting';

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (this.localVideo && this.localVideo.nativeElement) {
        this.localVideo.nativeElement.srcObject = this.localStream;
      } else {
        console.warn('Local video element not available at setup time.');
      }

      const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      this.peerConnection = new RTCPeerConnection(configuration);

      this.localStream.getTracks().forEach(track => {
        if (this.localStream && this.peerConnection) {
            this.peerConnection.addTrack(track, this.localStream);
        }
      });

      this.peerConnection.ontrack = (event) => {
        this.ngZone.run(() => {
          if (event.streams && event.streams[0]) {
            this.remoteStream = event.streams[0];
            if (this.remoteVideo && this.remoteVideo.nativeElement) {
              this.remoteVideo.nativeElement.srcObject = this.remoteStream;
              this.callStatus = 'ongoing';
              console.log("Remote stream received, call now ongoing.");
            } else {
              console.error('Remote video element not available when track received.');
              this.handleCallEnded('Error displaying remote video.');
            }
          }
        });
      };

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.currentUser && this.callId) {
          console.log('Sending ICE candidate:', event.candidate);
          this.communicationService.sendIceCandidate(this.callId, this.currentUser.uid, event.candidate.toJSON())
            .catch(err => console.error('Error sending ICE candidate:', err));
        }
      };
      
      this.peerConnection.onconnectionstatechange = () => {
        if (this.peerConnection) {
          this.ngZone.run(() => {
            console.log('Peer connection state changed:', this.peerConnection?.connectionState);
            switch (this.peerConnection?.connectionState) {
              case 'connected':
                this.callStatus = 'ongoing';
                break;
              case 'disconnected':
                // Could attempt to show a "reconnecting" state or a specific UI
                break;
              case 'failed':
              case 'closed':
                this.handleCallEnded(`Call connection ${this.peerConnection.connectionState}.`);
                break;
            }
          });
        }
      };

      if (this.otherUserIceCandidatesSubscription) {
        this.otherUserIceCandidatesSubscription.unsubscribe();
        this.otherUserIceCandidatesSubscription = null; 
      }
      if (this.opponentId) {
        console.log(`Subscribing to ICE candidates sent BY opponent: ${this.opponentId}`);
        this.otherUserIceCandidatesSubscription = this.communicationService.getIceCandidates(this.callId, this.opponentId)
          .subscribe(candidates => {
            candidates.forEach(candidateObj => {
              if (candidateObj && this.peerConnection && this.peerConnection.signalingState !== 'closed') {
                console.log('Received ICE candidate from opponent:', candidateObj);
                this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateObj))
                  .catch(e => console.error('Error adding received ICE candidate:', e));
              }
            });
          }, err => console.error('Error in ICE candidate subscription:', err));
      } else {
        console.warn("Opponent ID not set, cannot subscribe to their ICE candidates at WebRTC setup.");
      }

      if (this.isInitiator) {
        if (this.peerConnection.signalingState === 'stable') {
          console.log("Initiator: Creating offer.");
          const offer = await this.peerConnection.createOffer();
          await this.peerConnection.setLocalDescription(offer);
          await this.communicationService.sendOffer(this.callId, offer);
          console.log("Initiator: Offer sent.");
        } else {
          console.warn("Initiator: PeerConnection not in stable state to create offer. State:", this.peerConnection.signalingState);
        }
      } else { 
        if (this.call && this.call.offer) {
          console.log("Receiver: Offer found in call details. Attempting to set remote description.");
          if (this.peerConnection.signalingState === 'stable') {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.call.offer));
            console.log("Receiver: Remote offer set.");
            await this.createAndSendAnswer();
          } else {
            console.warn(`Receiver: PeerConnection not in stable state to set remote offer. State: ${this.peerConnection.signalingState}. Will wait for state change or offer update via loadCall.`);
          }
        } else {
          console.log('Receiver: Offer not yet found in call details. Waiting for it via subscription to call document.');
        }
      }
    } catch (error) {
      console.error('Error setting up WebRTC:', error);
      this.handleCallEnded('Error setting up video call. Check permissions or devices.');
      this.callStatus = 'failed';
    }
  }

  private async createAndSendAnswer() {
    if (!this.peerConnection || this.isInitiator || !this.call || !this.call.offer) {
      console.warn("Conditions not met for creating answer (peerConnection, role, or offer missing).");
      return;
    }
    if (this.peerConnection.signalingState === 'have-remote-offer') {
      console.log("Receiver: Creating answer.");
      try {
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        await this.communicationService.sendAnswer(this.callId, answer);
        console.log("Receiver: Answer sent.");
      } catch (error) {
        console.error("Receiver: Error creating or sending answer:", error);
        this.handleCallEnded("Failed to process call answer.");
      }
    } else {
      console.warn(`Receiver: Not in 'have-remote-offer' state to create answer. Current state: ${this.peerConnection.signalingState}`);
    }
  }

  async acceptCall() {
    if (!this.callId || this.isInitiator || !this.call || this.call.status !== 'pending') {
      console.warn('Accept call conditions not met:', {callId: this.callId, isInitiator: this.isInitiator, callStatus: this.call?.status});
      return;
    }
    console.log('Receiver: Accepting call');
    this.isSaving = true;
    this.callStatus = 'connecting';

    try {
      await this.communicationService.updateCallStatus(this.callId, 'accepted').toPromise();
      console.log('Call status updated to accepted in DB.');
      if (!this.peerConnection) {
          await this.setupWebRTC();
      } else if (this.call && this.call.offer && this.peerConnection.signalingState === 'stable') {
          console.log('AcceptCall: Re-attempting to set remote offer after accepting.');
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.call.offer));
          await this.createAndSendAnswer();
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      this.handleCallEnded('Could not accept the call.');
    } finally {
      this.isSaving = false;
    }
  }

  async declineCall() {
    if (!this.callId || !this.call) {
      console.warn('Decline call: callId or call object missing');
      return;
    }
    if (this.call.status === 'ended' || this.call.status === 'declined') {
      console.warn('Decline call: Call already ended or declined');
      return;
    }
    console.log('Declining call');
    this.isSaving = true;

    try {
      await this.communicationService.updateCallStatus(this.callId, 'declined').toPromise();
      this.handleCallEnded('You declined the call.');
    } catch (error) {
      console.error('Error declining call:', error);
      this.handleCallEnded('Failed to decline call.');
    } finally {
      this.isSaving = false;
    }
  }

  async triggerEndCall() {
    if (!this.callId) {
      console.warn('triggerEndCall: No callId');
      this.cleanupCall();
      if (!this.router.url.includes('/communication/chats')) {
        this.router.navigate(['/communication/chats']);
      }
      return;
    }
    console.log("Triggering end call. Current call DB status:", this.call?.status, "Current local status:", this.callStatus);
    this.isSaving = true;

    if (this.call && (this.call.status === 'pending' || this.call.status === 'accepted') || 
        this.callStatus === 'ongoing' || this.callStatus === 'connecting' || this.callStatus === 'pending') {
      try {
        await this.communicationService.updateCallStatus(this.callId, 'ended').toPromise();
        this.handleCallEnded('You ended the call.'); 
      } catch (err) {
        console.error('Error updating call status to ended:', err);
        this.handleCallEnded('Call ended. Error saving status.');
      } finally {
        this.isSaving = false;
      }
    } else {
      this.handleCallEnded('Call session cleared.');
      this.isSaving = false;
    }
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
      this.peerConnection.getSenders().forEach(sender => {
        if (this.peerConnection && sender && sender.track) {
          try { this.peerConnection.removeTrack(sender); } catch (e) { console.warn("Error removing track:", e); }
        }
      });
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.otherUserIceCandidatesSubscription) {
      this.otherUserIceCandidatesSubscription.unsubscribe();
      this.otherUserIceCandidatesSubscription = null;
    }
    
    this.ngZone.run(() => { 
      this.callStatus = 'ended'; 
      if (this.localVideo && this.localVideo.nativeElement) this.localVideo.nativeElement.srcObject = null;
      if (this.remoteVideo && this.remoteVideo.nativeElement) this.remoteVideo.nativeElement.srcObject = null;
    });
  }

  async handleCallEnded(reason: string) {
    if (this.callStatus === 'ended' && this.router.url.includes('/communication/chats')) {
      return; 
    }
    
    console.log(`Handling call ended: ${reason}. Current status: ${this.callStatus}`);
    const previousCallStatusBeforeCleanup = this.callStatus; 
    
    this.cleanupCall(); 

    if (previousCallStatusBeforeCleanup !== 'ended' && previousCallStatusBeforeCleanup !== 'failed') {
      try {
        const activeLoading = await this.loadingController.getTop();
        if (activeLoading) await activeLoading.dismiss();
        const activeAlert = await this.alertController.getTop();
        if (activeAlert) await activeAlert.dismiss(); 
      } catch (e) { /* no overlay open */ }
    }
    
    this.ngZone.run(async () => { 
      if (!this.router.url.includes('/communication/chats')) { 
        const alert = await this.alertController.create({
          header: 'Call Ended',
          message: reason,
          backdropDismiss: false,
          buttons: [{ text: 'OK', handler: () => this.router.navigate(['/communication/chats']) }]
        });
        await alert.present();
      }
    });
  }

  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log(`Audio ${audioTrack.enabled ? 'unmuted' : 'muted'}`);
      }
    }
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log(`Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  }
}