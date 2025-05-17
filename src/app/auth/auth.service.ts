// src/app/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, from } from 'rxjs'; // Added 'from' for reauthenticateWithCredential
import { map, tap } from 'rxjs/operators';
import firebase from 'firebase/compat/app'; // Import firebase for EmailAuthProvider

export interface User {
  uid: string;
  email: string;
  accountType: 'retailer' | 'customer';
  displayName?: string;
  phoneNumber?: string;
  emailVerified: boolean;
  hasActiveSubscription?: boolean;
  subscriptionEndDate?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router
  ) {
    this.afAuth.authState.subscribe(firebaseUser => {
      if (firebaseUser) {
        this.getUserData(firebaseUser.uid).subscribe(userData => {
          if (userData) {
            const user: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              emailVerified: firebaseUser.emailVerified,
              ...userData
            };
            this.currentUserSubject.next(user);
          } else {
            this.currentUserSubject.next(null);
          }
        });
      } else {
        this.currentUserSubject.next(null);
      }
    });
  }

  getUserData(uid: string): Observable<any> {
    return this.firestore.doc<User>(`users/${uid}`).valueChanges(); // Typed return
  }

  async signup(email: string, password: string, accountType: 'retailer' | 'customer'): Promise<any> {
    try {
      const result = await this.afAuth.createUserWithEmailAndPassword(email, password);
      if (result.user) {
        await result.user.sendEmailVerification();
        await this.firestore.doc(`users/${result.user.uid}`).set({
          email,
          accountType,
          emailVerified: false,
          hasActiveSubscription: accountType === 'customer',
          createdAt: new Date()
        });
        return result;
      } else { // Added else to handle case where result.user is null
        throw new Error('User creation failed.');
      }
    } catch (error) {
      console.error("Signup error:", error); // Log error
      throw error;
    }
  }

  async login(email: string, password: string): Promise<any> {
    try {
      const result = await this.afAuth.signInWithEmailAndPassword(email, password);
      return result;
    } catch (error) {
      console.error("Login error:", error); // Log error
      throw error;
    }
  }

  async logout(): Promise<void> {
    await this.afAuth.signOut();
    this.currentUserSubject.next(null); // Clear current user on logout
    this.router.navigate(['/login']);
  }

  async sendVerificationEmail(): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (user) {
      return user.sendEmailVerification();
    }
    throw new Error('No authenticated user');
  }

  async resetPassword(email: string): Promise<void> {
    return this.afAuth.sendPasswordResetEmail(email);
  }

  async updateProfile(uid: string, data: Partial<User>): Promise<void> {
    return this.firestore.doc(`users/${uid}`).update(data);
  }

  // ADD THIS METHOD
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user || !user.email) { // Check for user and user.email
        throw new Error('No authenticated user or user email is missing.');
      }

      // Create a credential with the user's email and current password
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);

      // Re-authenticate the user with the credential
      await user.reauthenticateWithCredential(credential);

      // If re-authentication is successful, update the password
      await user.updatePassword(newPassword);

    } catch (error) {
      console.error("Password update error:", error); // Log specific error
      // You might want to map specific error codes to user-friendly messages here
      // For example, if error.code === 'auth/wrong-password'
      throw error; 
    }
  }

  isRetailer(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => user?.accountType === 'retailer')
    );
  }

  isCustomer(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => user?.accountType === 'customer')
    );
  }

  hasActiveSubscription(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user?.hasActiveSubscription)
    );
  }
}