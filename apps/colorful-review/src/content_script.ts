import { createDropDownOption, handleDropdownSelection } from './util';
import { styleDropdown } from './styles-util';
import { conventionalComments } from './conventional-comments';

// GitLab renders the comment editor's button bar differently per editing mode:
// rich-text mode uses [data-testid="formatting-toolbar"], plain-text mode uses
// [data-testid="md-header-toolbar"]. Both appear on every comment surface (main
// MR box, diff-line replies, discussion replies), so we prepend a
// conventional-comments dropdown to whichever toolbar is currently mounted.
const TOOLBAR_SELECTOR =
  '[data-testid="formatting-toolbar"], [data-testid="md-header-toolbar"]';
const DROPDOWN_CLASS = 'colorful-review-dropdown';

function addDropDownToToolbars(): void {
  document.querySelectorAll(TOOLBAR_SELECTOR).forEach((toolbar) => {
    if (toolbar.querySelector(`.${DROPDOWN_CLASS}`)) {
      return;
    }

    const dropdown = document.createElement('select');
    dropdown.classList.add(DROPDOWN_CLASS);
    styleDropdown(dropdown);

    Object.keys(conventionalComments).forEach((key) => {
      const option = createDropDownOption(
        (
          conventionalComments as {
            [key: string]: {
              description: string;
              innerText: string;
            };
          }
        )[key],
        key
      );
      dropdown.appendChild(option);
    });

    dropdown.addEventListener('change', () => handleDropdownSelection(dropdown));

    toolbar.prepend(dropdown);
  });
}

// Comment editors are mounted lazily and re-mounted on SPA navigation, so watch
// the document and (re)inject whenever new toolbars appear.
const observer = new MutationObserver((mutations) => {
  if (mutations.some((mutation) => mutation.addedNodes.length)) {
    addDropDownToToolbars();
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// Handle any editor already present at load time.
addDropDownToToolbars();
