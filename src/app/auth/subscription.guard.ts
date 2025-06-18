// src/app/auth/subscription.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    // Allow subscription pages to be accessed regardless of subscription status
    if (state.url.includes('/payment/subscription')) {
      return true;
    }

    return this.authService.hasActiveSubscription().pipe(
      take(1),
      tap(hasSubscription => {
        if (!hasSubscription) {
          this.router.navigate(['/payment/subscription']);
        }
      })
    );
  }
}