// src/app/auth/auth.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';
import { EmailVerificationComponent } from './email-verification/email-verification.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'verify-email', component: EmailVerificationComponent },
];

@NgModule({
  declarations: [
    // Remove standalone components from declarations
    // LoginComponent,
    // SignupComponent,
    // EmailVerificationComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    // Add standalone components to imports instead
    LoginComponent,
    SignupComponent,
    EmailVerificationComponent
  ],
  exports: [RouterModule]
})
export class AuthModule { }
