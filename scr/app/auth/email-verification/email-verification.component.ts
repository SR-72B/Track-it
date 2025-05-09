// src/app/auth/email-verification/email-verification.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-email-verification',
  templateUrl: './email-verification.component.html',
  styleUrls: ['./email-verification.component.scss']
})
export class EmailVerificationComponent implements OnInit {
  verifying = true;
  verified = false;
  error = null;

  constructor(
    private route: ActivatedRoute,
    private afAuth: AngularFireAuth,
    private router: Router,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['oobCode']) {
        this.verifyEmail(params['oobCode']);
      } else {
        this.error = 'Invalid verification link';
        this.verifying = false;
      }
    });
  }

  async verifyEmail(code: string) {
    try {
      await this.afAuth.applyActionCode(code);
      this.verified = true;
      this.verifying = false;
      
      // Show success message and redirect
      const alert = await this.alertController.create({
        header: 'Success',
        message: 'Your email has been verified. You can now log in.',
        buttons: [
          {
            text: 'Go to Login',
            handler: () => {
              this.router.navigate(['/login']);
            }
          }
        ]
      });
      await alert.present();
    } catch (error) {
      this.error = error.message;
      this.verifying = false;
    }
  }
}