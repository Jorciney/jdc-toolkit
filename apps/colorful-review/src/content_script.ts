import { createDropDownOption, handleDropdownSelection } from './util';
import { styleDropdown } from './stylesUtil';
import { conventionalComments } from './conventional-comments';

//   document.('textarea')?.addEventListener('change', () => {
//     console.log('sup');
//     addDropDownToPage('.md-header-toolbar.gl-display-flex.gl-py-3.gl-flex-wrap.gl-row-gap-3');
// });
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length) {
      mutation.addedNodes.forEach((node) => {
        if ((node as Element)?.classList?.contains('js-temp-notes-holder')) {
          addDropDownToPage('div.md-header-toolbar', node);
        }
      });
    }
  });
});
const appendObserver = () => {
  const config = { childList: true, subtree: true };
  const targetNode = document.querySelector('.merge-request-details');
  if (targetNode) {
    observer.observe(targetNode, config);
  }
  return config;
};

appendObserver();
if (!window.location.href.includes('diff')) {
  addDropDownToPage(
    '.md-header-toolbar.gl-display-flex.gl-py-3.gl-flex-wrap.gl-row-gap-3'
  );
}

function addDropDownToPage(selector: string, node?: Node) {
  const nodeList =
    node?.parentElement?.querySelectorAll(selector) ||
    document.querySelectorAll(selector);
  nodeList.forEach((element) => {
    if (!element?.querySelector('#colorful-review-dropdown')) {
      const dropdown = document.createElement('select');
      dropdown.id = 'colorful-review-dropdown';

      styleDropdown(dropdown);
      Object.keys(conventionalComments).map((key) => {
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

      dropdown.addEventListener(
        'change',
        handleDropdownSelection.bind(null, dropdown, element)
      );

      element?.prepend(dropdown);
    }
  });
}
