import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createUserWithPermissions } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

const RECEIPT_PERMISSIONS = [{ resource: 'recebimentos_compra', action: 'criar' }];

const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

const login = async () => {
  const user = await createUserWithPermissions(RECEIPT_PERMISSIONS);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return { user, token: res.body.data.accessToken as string };
};

const VALID_NFE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35260112345678000199550010000012345123456789" versao="4.00">
      <ide><cUF>35</cUF><nNF>777</nNF><serie>1</serie><dhEmi>2026-09-01T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>12345678000199</CNPJ><xNome>Fornecedor Teste</xNome></emit>
      <det nItem="1">
        <prod><cProd>X1</cProd><xProd>Produto Teste</xProd><uCom>UN</uCom><qCom>10.0000</qCom><vUnCom>5.00</vUnCom></prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

describe('POST /purchase-receipts/parse-nfe', () => {
  beforeEach(async () => {
    clearLicensedModuleCache();
    await setModule('COMPRAS', true);
    clearLicensedModuleCache();
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('retorna 200 com os dados extraídos para um usuário autorizado', async () => {
    const { token } = await login();

    const response = await request(app)
      .post('/api/v1/purchase-receipts/parse-nfe')
      .set('Authorization', `Bearer ${token}`)
      .send({ xml: VALID_NFE_XML });

    expect(response.status).toBe(200);
    expect(response.body.data.supplierCnpj).toBe('12345678000199');
    expect(response.body.data.items).toHaveLength(1);
  });

  it('retorna 400 para XML malformado', async () => {
    const { token } = await login();

    const response = await request(app)
      .post('/api/v1/purchase-receipts/parse-nfe')
      .set('Authorization', `Bearer ${token}`)
      .send({ xml: '<not><valid' });

    expect(response.status).toBe(400);
  });

  it('retorna 400 quando o campo xml não é enviado', async () => {
    const { token } = await login();

    const response = await request(app)
      .post('/api/v1/purchase-receipts/parse-nfe')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
  });

  it('retorna 401 sem token de autenticação', async () => {
    const response = await request(app)
      .post('/api/v1/purchase-receipts/parse-nfe')
      .send({ xml: VALID_NFE_XML });

    expect(response.status).toBe(401);
  });
});
