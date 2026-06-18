import { conventionalCommentsLegend } from './conventional-comments';

describe('conventionalCommentsLegend', () => {
  it('excludes the placeholder entry that has no color', () => {
    expect(
      conventionalCommentsLegend.some((e) => e.key === 'Select an option')
    ).toBe(false);
  });

  it('gives every entry a non-empty color and description', () => {
    expect(conventionalCommentsLegend.length).toBeGreaterThan(0);
    for (const entry of conventionalCommentsLegend) {
      expect(entry.color).toBeTruthy();
      expect(entry.description).toBeTruthy();
    }
  });

  it('parses the hex color for Praise', () => {
    const praise = conventionalCommentsLegend.find((e) => e.key === 'Praise');
    expect(praise?.color).toBe('#02B532');
  });

  it('parses named colors such as Blocking (red)', () => {
    const blocking = conventionalCommentsLegend.find(
      (e) => e.key === 'Blocking'
    );
    expect(blocking?.color).toBe('red');
  });
});
