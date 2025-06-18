// src/app/shared/components/empty-state/empty-state.component.ts
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.scss']
})
export class EmptyStateComponent {
  @Input() icon: string = 'alert-circle-outline';
  @Input() title: string = 'No Data';
  @Input() message: string = 'No items to display';
  @Input() buttonText: string;
  @Input() buttonLink: string;
  @Input() buttonAction: () => void;
}