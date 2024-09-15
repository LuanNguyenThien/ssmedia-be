// error-handler.test.ts
import { NotAuthorizedError, checkAuthorization } from '@global/helpers/error-handler';

describe('checkAuthorization', () => {
  it('should throw NotAuthorizedError when token is not available', () => {
    expect(() => {
      checkAuthorization('alo');
    }).toThrow(NotAuthorizedError);

    expect(() => {
      checkAuthorization(null);
    }).toThrow('Token is not. Please login again.');
  });
});