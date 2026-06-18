import { Component } from '@angular/core';
import { conventionalCommentsLegend } from '../conventional-comments';

@Component({
  standalone: true,
  selector: 'jdc-toolkit-root',
  template: `
    <div class="legend">
      <h1 class="legend__title">Conventional Comments</h1>
      <ul class="legend__list">
        @for (entry of legend; track entry.key) {
          <li class="legend__item">
            <span
              class="legend__badge"
              [style.background-color]="entry.color"
              >{{ entry.key }}</span
            >
            <span class="legend__description">{{ entry.description }}</span>
          </li>
        }
      </ul>
    </div>
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly legend = conventionalCommentsLegend;
}
