import { INestApplication } from '@nestjs/common';

/**
 * TASK 2.1 (helpers) - Bootstrap HTTP para Supertest sobre o adaptador Fastify.
 *
 * O `app.getHttpServer()` do NestFastifyApplication e um servidor Node http
 * nu (sem handler interno), entao o Supertest PRECISA ser apontado para
 * `server.listen(0)` + `localhost:{porta}` — decisao de documentada aqui para
 * evitar o erro silencioso "connection refused" em suites futuras.
 */
export async function startTestServer(app: INestApplication): Promise<{ url: string; close: () => Promise<void> }> {
  const server = app.getHttpAdapter().getInstance() as import('http').Server;
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as import('net').AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}
