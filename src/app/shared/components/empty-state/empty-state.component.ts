// src/app/shared/components/empty-state/empty-state.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class EmptyStateComponent {
  @Input() icon: string = 'alert-circle-outline';
  @Input() title: string = 'No Data';
  @Input() message: string = 'No items to display';
  @Input() buttonText?: string;
  @Input() buttonLink?: string;
  @Input() buttonAction?: () => void;
}
