export const dropDownStyles = {
  padding: '0.5rem',
  fontSize: '1rem',
  borderRadius: '10px',
  border: '1px solid gray'
};
export const styleDropdown = (dropdown: HTMLSelectElement) => {
  Object.assign(dropdown.style, dropDownStyles);
}
