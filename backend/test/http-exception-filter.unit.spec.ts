import { HttpExceptionFilter, clientErrorStatus } from '../src/common/http/http-exception.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as never;
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  new HttpExceptionFilter().catch(exception, host);
  errSpy.mockRestore();
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
}

describe('HttpExceptionFilter', () => {
  it('maps body-parser 413 to PAYLOAD_TOO_LARGE instead of 500', () => {
    const err = Object.assign(new Error('request entity too large'), { status: 413, expose: true, type: 'entity.too.large' });
    const { status, body } = run(err);
    expect(status).toBe(413);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('maps malformed JSON to a 400 without echoing the parser message', () => {
    const err = Object.assign(new SyntaxError('Unexpected token } in JSON at position 3'), { status: 400, expose: true });
    const { status, body } = run(err);
    expect(status).toBe(400);
    expect(JSON.stringify(body)).not.toContain('Unexpected token');
  });

  it('never leaks internal error messages or SQL', () => {
    const { status, body } = run(new Error('relation "assets" does not exist at SELECT * FROM assets'));
    expect(status).toBe(500);
    expect(body.error.message).toBe('internal_error');
  });

  it('ignores non-exposed or 5xx statuses', () => {
    expect(clientErrorStatus({ status: 503, expose: true })).toBeNull();
    expect(clientErrorStatus({ status: 400 })).toBeNull();
    expect(clientErrorStatus(null)).toBeNull();
  });
});
