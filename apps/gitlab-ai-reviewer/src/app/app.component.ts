import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterModule],
  selector: 'jdc-toolkit-root',
  template: `<h1>GitLab AI Code Reviewer</h1>`,
  styleUrl: './app.component.scss',
})
export class AppComponent {}
