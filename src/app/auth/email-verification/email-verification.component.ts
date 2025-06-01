// src/app/auth/email-verification/email-verification.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AlertController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-email-verification',
  templateUrl: './email-verification.component.html', // Ensure this file exists (as in Canvas: email_verification_html_updated)
  styleUrls: ['./email-verification.component.scss'],   // Ensure this file exists
  standalone: true, // Mark component as standalone
  imports: [
    CommonModule,     // For *ngIf, *ngFor, async pipe, etc.
    IonicModule,      // For Ionic components and services like AlertController
    RouterModule      // For routerLink, routerOutlet (if used directly in this component's template)
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
    this.error = null; // Reset error before attempting
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
              this.router.navigate(['/auth/login']); // Ensure this is your correct login route
            }
          }
        ]
      });
      await alert.present();
    } catch (err: any) {
      this.error = err.message || 'An unknown error occurred during email verification. The link may be invalid or expired.';
      this.verifying = false;
      this.verified = false; // Ensure verified is false on error
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
    // Unsubscribe from observables to prevent memory leaks
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
  }
}


