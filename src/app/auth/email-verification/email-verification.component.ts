// src/app/auth/email-verification/email-verification.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AlertController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-email-verification',
  templateUrl: './email-verification.component.html',
  styleUrls: ['./email-verification.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class EmailVerificationComponent implements OnInit, OnDestroy {
  verifying = true;
  verified = false;
  error: string | null = null;

  private queryParamsSubscription: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private afAuth: AngularFireAuth,
    private router: Router,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      const oobCode = params['oobCode'];
      if (oobCode) {
        this.verifyEmail(oobCode);
      } else {
        this.error = 'Invalid or missing verification code in the link.';
        this.verifying = false;
        this.showErrorAlert(this.error);
      }
    });
  }

  async verifyEmail(code: string) {
    this.verifying = true;
    this.error = null;
    
    try {
      await this.afAuth.applyActionCode(code);
      this.verified = true;
      this.verifying = false;
      
      const alert = await this.alertController.create({
        header: 'Success!',
        message: 'Your email has been verified. You can now log in.',
        backdropDismiss: false,
        buttons: [
          {
            text: 'Go to Login',
            handler: () => {
              this.router.navigate(['/auth/login']);
              return true; // Fixed: Added return value
            }
          }
        ]
      });
      await alert.present();
    } catch (err: any) {
      this.error = err.message || 'An unknown error occurred during email verification. The link may be invalid or expired.';
      this.verifying = false;
      this.verified = false;
      this.showErrorAlert(this.error);
    }
  }

  async showErrorAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Verification Failed',
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  ngOnDestroy() {
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
  }
}


