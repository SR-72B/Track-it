// src/app/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

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
    // Listen for auth state changes
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
    return this.firestore.doc(`users/${uid}`).valueChanges();
  }

  async signup(email: string, password: string, accountType: 'retailer' | 'customer'): Promise<any> {
    try {
      const result = await this.afAuth.createUserWithEmailAndPassword(email, password);
      if (result.user) {
        // Send email verification
        await result.user.sendEmailVerification();
        
        // Create user document in Firestore
        await this.firestore.doc(`users/${result.user.uid}`).set({
          email,
          accountType,
          emailVerified: false,
          hasActiveSubscription: accountType === 'customer', // Customers don't need subscription
          createdAt: new Date()
        });
        
        return result;
      }
    } catch (error) {
      throw error;
    }
  }

  async login(email: string, password: string): Promise<any> {
    try {
      const result = await this.afAuth.signInWithEmailAndPassword(email, password);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async logout(): Promise<void> {
    await this.afAuth.signOut();
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