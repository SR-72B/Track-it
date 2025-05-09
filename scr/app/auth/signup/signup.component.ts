// src/app/auth/signup/signup.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent implements OnInit {
  signupForm: FormGroup;
  isSubmitting = false;
  accountTypes = [
    { value: 'customer', label: 'Customer' },
    { value: 'retailer', label: 'Retailer' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {
    this.signupForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      accountType: ['customer', Validators.required]
    }, { validator: this.checkPasswords });
  }

  ngOnInit() {}

  checkPasswords(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;

    return password === confirmPassword ? null : { notSame: true };
  }

  async signup() {
    if (this.signupForm.valid) {
      this.isSubmitting = true;
      const loading = await this.loadingController.create({
        message: 'Creating your account...',
        spinner: 'crescent'
      });
      await loading.present();

      try {
        const { email, password, accountType } = this.signupForm.value;
        await this.authService.signup(email, password, accountType);
        
        await loading.dismiss();
        this.isSubmitting = false;

        const alert = await this.alertController.create({
          header: 'Account Created',
          message: 'Please check your email to verify your account before logging in.',
          buttons: ['OK']
        });
        await alert.present();
        
        this.router.navigate(['/login']);
      } catch (error) {
        await loading.dismiss();
        this.isSubmitting = false;
        
        const alert = await this.alertController.create({
          header: 'Signup Failed',
          message: error.message,
          buttons: ['OK']
        });
        await alert.present();
      }
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
