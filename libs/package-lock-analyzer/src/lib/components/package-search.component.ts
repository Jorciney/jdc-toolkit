import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'lib-package-search',
  standalone: true,
  template:`
    <input type="text" (keyup)="searchPackage($event)" placeholder="Search for packages...">
  `,
  styles: [
    `
      input[type=text] {
        width: 100%;
        padding: 12px;
        border: 2px solid #ccc;
        border-radius: 4px;
        font-size: 16px;
      }
    `
  ]
})
export class PackageSearchComponent {
  @Output() searchQuery = new EventEmitter<string>();

  searchPackage(event: KeyboardEvent): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.emit(target.value.toLowerCase());
  }
}
