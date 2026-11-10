import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from '@shared/utilities/api-errors';

describe('apiErrorMessage', () => {
  it('prefers the first field error of a 422', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: { message: 'The given data was invalid.', errors: { quantity: ['Quantity must be at least 1.'] } },
    });
    expect(apiErrorMessage(error)).toBe('Quantity must be at least 1.');
  });

  it('falls back to the message, then to undefined', () => {
    expect(apiErrorMessage(new HttpErrorResponse({ status: 422, error: { message: 'Not assigned.' } }))).toBe('Not assigned.');
    expect(apiErrorMessage(new HttpErrorResponse({ status: 0 }))).toBeUndefined();
    expect(apiErrorMessage(null)).toBeUndefined();
  });
});
