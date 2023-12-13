import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterModule],
  selector: 'jdc-toolkit-root',
  template: `<h1>Welcome colorful-review</h1>
    <router-outlet></router-outlet>`,
  styleUrl: './app.component.scss',
})
export class AppComponent {}
