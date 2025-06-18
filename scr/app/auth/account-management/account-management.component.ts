// src/app/auth/account-management/account-management.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-account-management',
  templateUrl: './account-management.component.html',
  styleUrls: ['./account-management.component.scss']
})
export class AccountManagementComponent implements OnInit {
  profileForm: FormGroup;
  passwordForm: FormGroup;
  user: any;
  isLoading = true;
  isSaving = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {
    this.profileForm = this.fb.group({
      displayName: ['', Validators.required],
      phoneNumber: [''],
      email: [{value: '', disabled: true}]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.checkPasswords });
  }

  ngOnInit() {
    this.loadUserProfile();
  }

  async loadUserProfile() {
    this.isLoading = true;
    
    const loading = await this.loadingController.create({
      message: 'Loading profile...',
      spinner: 'crescent'
    });
    await loading.present();

    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.user = user;
        this.profileForm.patchValue({
          displayName: user.displayName || '',
          phoneNumber: user.phoneNumber || '',
          email: user.email
        });
      }
      this.isLoading = false;
      loading.dismiss();
    });
  }

  checkPasswords(group: FormGroup) {
    const password = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;

    return password === confirmPassword ? null : { notSame: true };
  }

  async updateProfile() {
    if (this.profileForm.valid) {
      this.isSaving = true;
      const loading = await this.loadingController.create({
        message: 'Updating profile...',
        spinner: 'crescent'
      });
      await loading.present();

      try {
        const { displayName, phoneNumber } = this.profileForm.value;
        await this.authService.updateProfile(this.user.uid, { 
          displayName, 
          phoneNumber 
        });
        
        await loading.dismiss();
        this.isSaving = false;

        const alert = await this.alertController.create({
          header: 'Success',
          message: 'Your profile has been updated.',
          buttons: ['OK']
        });
        await alert.present();
      } catch (error) {
        await loading.dismiss();
        this.isSaving = false;
        
        const alert = await this.alertController.create({
          header: 'Error',
          message: error.message,
          buttons: ['OK']
        });
        await alert.present();
      }
    }
  }

  async updatePassword() {
    if (this.passwordForm.valid) {
      this.isSaving = true;
      const loading = await this.loadingController.create({
        message: 'Updating password...',
        spinner: 'crescent'
      });
      await loading.present();

      try {
        const { currentPassword, newPassword } = this.passwordForm.value;
        await this.authService.updatePassword(currentPassword, newPassword);
        
        await loading.dismiss();
        this.isSaving = false;

        const alert = await this.alertController.create({
          header: 'Success',
          message: 'Your password has been updated.',
          buttons: ['OK']
        });
        await alert.present();
        
        this.passwordForm.reset();
      } catch (error) {
        await loading.dismiss();
        this.isSaving = false;
        
        const alert = await this.alertController.create({
          header: 'Error',
          message: error.message,
          buttons: ['OK']
        });
        await alert.present();
      }
    }
  }
}