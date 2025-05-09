// src/app/auth/login/login.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit() {}

  async login() {
    if (this.loginForm.valid) {
      this.isSubmitting = true;
      const loading = await this.loadingController.create({
        message: 'Logging in...',
        spinner: 'crescent'
      });
      await loading.present();

      try {
        const { email, password } = this.loginForm.value;
        const result = await this.authService.login(email, password);
        
        await loading.dismiss();
        this.isSubmitting = false;

        if (result.user.emailVerified) {
          // Check user type and navigate accordingly
          this.authService.getUserData(result.user.uid).subscribe(userData => {
            if (userData.accountType === 'retailer') {
              this.router.navigate(['/retailer/dashboard']);
            } else {
              this.router.navigate(['/customer/orders']);
            }
          });
        } else {
          const alert = await this.alertController.create({
            header: 'Email Verification Required',
            message: 'Please verify your email before logging in.',
            buttons: [
              {
                text: 'Resend Verification',
                handler: () => {
                  this.authService.sendVerificationEmail();
                }
              },
              {
                text: 'OK',
                role: 'cancel'
              }
            ]
          });
          await alert.present();
          this.authService.logout();
        }
      } catch (error) {
        await loading.dismiss();
        this.isSubmitting = false;
        
        const alert = await this.alertController.create({
          header: 'Login Failed',
          message: error.message,
          buttons: ['OK']
        });
        await alert.present();
      }
    }
  }

  goToSignup() {
    this.router.navigate(['/signup']);
  }

  async forgotPassword() {
    const alert = await this.alertController.create({
      header: 'Reset Password',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Enter your email'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Reset',
          handler: async (data) => {
            if (data.email) {
              try {
                await this.authService.resetPassword(data.email);
                const successAlert = await this.alertController.create({
                  header: 'Success',
                  message: 'Password reset email sent. Check your inbox.',
                  buttons: ['OK']
                });
                await successAlert.present();
              } catch (error) {
                const errorAlert = await this.alertController.create({
                  header: 'Error',
                  message: error.message,
                  buttons: ['OK']
                });
                await errorAlert.present();
              }
            }
          }
        }
      ]
    });
    await alert.present();
  }
}