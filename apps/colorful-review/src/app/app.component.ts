import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterModule],
  selector: 'jdc-toolkit-root',
  template: `<h1>Welcome colorful-review</h1>
    <button (click)="updateColor()">Update Color</button>`,
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  ngOnInit(): void {
    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
      if (changeInfo.status === 'complete' && tab.active) {
        chrome.scripting?.executeScript({
          target: { tabId: tabId! },
          func: updateBackgroundColor,
          args: ['red'],
        });
      }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting?.executeScript({
        target: { tabId: tabs[0].id! },
        func: updateBackgroundColor,
        args: ['green'],
      });
    });
  }

  updateColor() {
    console.log('Button clicked');
  }
}
const updateBackgroundColor = (color: string) => {
  const elementById = document.getElementById('user-profile-frame');
  console.log('elemenetFound:', elementById);
  if (elementById) {
    elementById.style.background = color;
  }
};
